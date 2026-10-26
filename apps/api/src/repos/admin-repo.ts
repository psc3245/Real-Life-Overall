import { and, asc, count, desc, eq, gte, isNotNull, lte, sql, type SQL } from "drizzle-orm";
import type { Executor } from "../db/client";
import { dayLogs, llmCalls, recaps, seasons, users } from "../db/schema";

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

/** Every account with its role, last logged day and LLM spend. */
export async function findUsers(db: Executor) {
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
  return db
    .select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      email: users.email,
      role: users.role,
      timezone: users.timezone,
      createdAt: users.createdAt,
      lastLogged: lastLogged.last,
      llmCalls: sql<number>`coalesce(${spend.calls}, 0)`.mapWith(Number),
      costUsd: sql<number>`coalesce(${spend.cost}, 0)`.mapWith(Number),
    })
    .from(users)
    .leftJoin(lastLogged, eq(lastLogged.userId, users.id))
    .leftJoin(spend, eq(spend.userId, users.id))
    .orderBy(desc(users.createdAt));
}

export async function setRole(db: Executor, id: string, role: "user" | "admin") {
  const rows = await db
    .update(users)
    .set({ role })
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
