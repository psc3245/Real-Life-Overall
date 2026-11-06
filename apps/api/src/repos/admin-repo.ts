import type { SeasonMode, UserRole } from "@rlo/shared";
import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  ilike,
  isNotNull,
  lte,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import type { Database, Executor } from "../db/client";
import {
  authAccounts,
  authSessions,
  authUsers,
  dayLogs,
  llmCalls,
  recaps,
  seasons,
  users,
} from "../db/schema";

const num = (expr: SQL) => sql<number>`coalesce(${expr}, 0)`.mapWith(Number);

/** LLM calls with the caller's username, newest first. */
export async function findCalls(
  db: Executor,
  filter: { userId?: string; errorsOnly?: boolean; purpose?: string; from?: Date; to?: Date },
  limit: number,
) {
  return db
    .select({
      id: llmCalls.id,
      userId: llmCalls.userId,
      username: users.username,
      purpose: llmCalls.purpose,
      provider: llmCalls.provider,
      model: llmCalls.model,
      promptVersion: llmCalls.promptVersion,
      inputTokens: llmCalls.inputTokens,
      outputTokens: llmCalls.outputTokens,
      costUsd: llmCalls.costUsd,
      latencyMs: llmCalls.latencyMs,
      error: llmCalls.error,
      createdAt: llmCalls.createdAt,
    })
    .from(llmCalls)
    .leftJoin(users, eq(users.id, llmCalls.userId))
    .where(
      and(
        filter.userId ? eq(llmCalls.userId, filter.userId) : undefined,
        filter.errorsOnly ? isNotNull(llmCalls.error) : undefined,
        filter.purpose ? eq(llmCalls.purpose, filter.purpose) : undefined,
        filter.from ? gte(llmCalls.createdAt, filter.from) : undefined,
        filter.to ? lte(llmCalls.createdAt, filter.to) : undefined,
      ),
    )
    .orderBy(desc(llmCalls.createdAt))
    .limit(limit);
}

/** Calls, errors, tokens and cost since `since`, grouped by a column (or not at all). */
export async function usage(db: Executor, since: Date, by?: "purpose" | "model" | "day") {
  const key =
    by === "purpose"
      ? llmCalls.purpose
      : by === "model"
        ? sql<string>`${llmCalls.provider} || ':' || ${llmCalls.model}`
        : by === "day"
          ? sql<string>`to_char(${llmCalls.createdAt} at time zone 'UTC', 'YYYY-MM-DD')`
          : sql<string>`'all'`;
  return db
    .select({
      key: sql<string>`${key}`,
      calls: count(),
      errors: num(sql`count(${llmCalls.error})`),
      inputTokens: num(sql`sum(${llmCalls.inputTokens})`),
      outputTokens: num(sql`sum(${llmCalls.outputTokens})`),
      costUsd: num(sql`sum(${llmCalls.costUsd})`),
      avgLatencyMs: num(sql`round(avg(${llmCalls.latencyMs}))`),
    })
    .from(llmCalls)
    .where(gte(llmCalls.createdAt, since))
    .groupBy(sql`1`)
    .orderBy(by === "day" ? asc(sql`1`) : desc(sql`6`));
}

export async function counts(db: Executor, activeSince: string) {
  const [u] = await db
    .select({
      users: count(),
      admins: num(sql`count(*) filter (where ${users.role} = 'admin')`),
    })
    .from(users);
  const [s] = await db
    .select({ activeSeasons: count() })
    .from(seasons)
    .where(eq(seasons.status, "active"));
  const [a] = await db
    .select({ activeUsers: num(sql`count(distinct ${dayLogs.userId})`) })
    .from(dayLogs)
    .where(gte(dayLogs.localDate, activeSince));
  return { ...u!, activeSeasons: s!.activeSeasons, activeUsers7d: a!.activeUsers };
}

export interface UserFilter {
  q?: string;
  role?: UserRole;
  id?: string;
}

/** Accounts matching the search, newest first, with role, sign-in, last logged day and LLM spend. */
export async function findUsers(db: Executor, filter: UserFilter = {}, limit = 200) {
  const lastLogged = db
    .select({ userId: dayLogs.userId, last: sql<string>`max(${dayLogs.localDate})`.as("last") })
    .from(dayLogs)
    .groupBy(dayLogs.userId)
    .as("last_logged");
  const spend = db
    .select({
      userId: llmCalls.userId,
      calls: sql<number>`count(*)`.mapWith(Number).as("calls"),
      cost: sql<number>`coalesce(sum(${llmCalls.costUsd}), 0)`.mapWith(Number).as("cost"),
    })
    .from(llmCalls)
    .groupBy(llmCalls.userId)
    .as("spend");
  const providers = db
    .select({
      userId: authAccounts.userId,
      list: sql<
        string[]
      >`array_agg(${authAccounts.providerId} order by ${authAccounts.providerId})`.as("list"),
    })
    .from(authAccounts)
    .groupBy(authAccounts.userId)
    .as("providers");
  const pattern = filter.q ? `%${filter.q.replace(/[\\%_]/g, (m) => `\\${m}`)}%` : undefined;
  return db
    .select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      email: users.email,
      role: users.role,
      seasonMode: sql<SeasonMode | null>`(
        select ${seasons.mode} from ${seasons}
        where ${seasons.userId} = ${users.id} and ${seasons.status} = 'active'
        order by ${seasons.startsOn} desc limit 1
      )`,
      emailVerified: authUsers.emailVerified,
      signIn: sql<string[]>`coalesce(${providers.list}, '{}')`,
      timezone: users.timezone,
      createdAt: users.createdAt,
      lastLogged: lastLogged.last,
      llmCalls: sql<number>`coalesce(${spend.calls}, 0)`.mapWith(Number),
      costUsd: sql<number>`coalesce(${spend.cost}, 0)`.mapWith(Number),
    })
    .from(users)
    .leftJoin(authUsers, eq(authUsers.id, users.authSubject))
    .leftJoin(providers, eq(providers.userId, users.authSubject))
    .leftJoin(lastLogged, eq(lastLogged.userId, users.id))
    .leftJoin(spend, eq(spend.userId, users.id))
    .where(
      and(
        pattern
          ? or(
              ilike(users.username, pattern),
              ilike(users.displayName, pattern),
              ilike(users.email, pattern),
            )
          : undefined,
        filter.role ? eq(users.role, filter.role) : undefined,
        filter.id ? eq(users.id, filter.id) : undefined,
      ),
    )
    .orderBy(desc(users.createdAt))
    .limit(limit);
}

/** The app user and its auth identity (if any), for account management. */
export async function findAccount(db: Executor, id: string) {
  const [row] = await db
    .select({
      id: users.id,
      username: users.username,
      email: users.email,
      role: users.role,
      authSubject: users.authSubject,
      authEmail: authUsers.email,
      emailVerified: authUsers.emailVerified,
    })
    .from(users)
    .leftJoin(authUsers, eq(authUsers.id, users.authSubject))
    .where(eq(users.id, id));
  return row ?? null;
}

/** Whether an app user or an auth identity already has this email. */
export async function emailTaken(db: Executor, email: string) {
  const [app] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
  const [auth] = await db
    .select({ id: authUsers.id })
    .from(authUsers)
    .where(eq(authUsers.email, email));
  return Boolean(app ?? auth);
}

/**
 * Deletes the app user (every table cascades from `users`; `llm_calls` keep their cost with a null
 * user) and its auth identity (sessions and accounts cascade from `auth_users`).
 */
export async function deleteAccount(db: Database, id: string, authSubject: string | null) {
  await db.transaction(async (tx) => {
    await tx.delete(users).where(eq(users.id, id));
    if (authSubject) await tx.delete(authUsers).where(eq(authUsers.id, authSubject));
  });
}

export async function markEmailVerified(db: Executor, authSubject: string) {
  await db
    .update(authUsers)
    .set({ emailVerified: true, updatedAt: new Date() })
    .where(eq(authUsers.id, authSubject));
}

export async function deleteSessions(db: Executor, authSubject: string) {
  await db.delete(authSessions).where(eq(authSessions.userId, authSubject));
}

/** Also keeps `premium_since`: set on the way up from Free, kept between paid types, cleared on Free. */
export async function setRole(db: Executor, id: string, role: UserRole) {
  const rows = await db
    .update(users)
    .set({ role, premiumSince: premiumSinceFor(role) })
    .where(eq(users.id, id))
    .returning({ id: users.id });
  return rows[0] ?? null;
}

/** A recap of any user (admins only), with every run for the same period. */
export async function findRecap(db: Executor, id: string) {
  const [row] = await db.select().from(recaps).where(eq(recaps.id, id));
  if (!row) return null;
  const runs = await db
    .select({ id: recaps.id, status: recaps.status, createdAt: recaps.createdAt })
    .from(recaps)
    .where(
      and(
        eq(recaps.userId, row.userId),
        eq(recaps.kind, row.kind),
        eq(recaps.periodStart, row.periodStart),
      ),
    )
    .orderBy(asc(recaps.createdAt));
  return { row, runs };
}

export const premiumSinceFor = (role: UserRole) =>
  role === "user" ? null : sql`coalesce(${users.premiumSince}, now())`;
