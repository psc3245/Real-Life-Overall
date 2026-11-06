import {
  addDays,
  type AccountAction,
  type AdminOverviewDto,
  type AdminUserDto,
  type LlmCallDto,
  type RecapDebugDto,
  type createAccountBodySchema,
  type UserRole,
} from "@rlo/shared";
import type { z } from "zod";
import type { Auth } from "../auth/auth";
import type { Database } from "../db/client";
import { badRequest, conflict, notFound } from "../errors";
import * as adminRepo from "../repos/admin-repo";
import * as userRepo from "../repos/user-repo";

const DAY_MS = 86_400_000;
const round = (n: number, places = 4) => Math.round(n * 10 ** places) / 10 ** places;

type CallRow = Awaited<ReturnType<typeof adminRepo.findCalls>>[number];
const toCallDto = (r: CallRow): LlmCallDto => ({ ...r, createdAt: r.createdAt.toISOString() });

export async function overview(db: Database, now = new Date()): Promise<AdminOverviewDto> {
  const ago = (days: number) => new Date(now.getTime() - days * DAY_MS);
  const today = now.toISOString().slice(0, 10);
  const [counts, w1, w7, w30, byPurpose, byModel, byDay, errors] = await Promise.all([
    adminRepo.counts(db, addDays(today, -6)),
    adminRepo.usage(db, ago(1)),
    adminRepo.usage(db, ago(7)),
    adminRepo.usage(db, ago(30)),
    adminRepo.usage(db, ago(30), "purpose"),
    adminRepo.usage(db, ago(30), "model"),
    adminRepo.usage(db, ago(30), "day"),
    adminRepo.findCalls(db, { errorsOnly: true }, 20),
  ]);
  const window = (label: "24h" | "7d" | "30d", rows: typeof w1) => ({
    label,
    calls: rows[0]?.calls ?? 0,
    errors: rows[0]?.errors ?? 0,
    costUsd: round(rows[0]?.costUsd ?? 0),
  });
  return {
    ...counts,
    windows: [window("24h", w1), window("7d", w7), window("30d", w30)],
    byPurpose: byPurpose.map((r) => ({ ...r, costUsd: round(r.costUsd) })),
    byModel: byModel.map((r) => ({ ...r, costUsd: round(r.costUsd) })),
    // Every day of the window, so quiet days show as gaps rather than disappearing.
    byDay: Array.from({ length: 30 }, (_, i) => {
      const date = addDays(today, i - 29);
      const r = byDay.find((d) => d.key === date);
      return { date, calls: r?.calls ?? 0, costUsd: round(r?.costUsd ?? 0) };
    }),
    recentErrors: errors.map(toCallDto),
  };
}

export async function listCalls(
  db: Database,
  filter: { userId?: string; errorsOnly?: boolean; purpose?: string },
  limit: number,
): Promise<LlmCallDto[]> {
  return (await adminRepo.findCalls(db, filter, limit)).map(toCallDto);
}

export async function listUsers(
  db: Database,
  filter: adminRepo.UserFilter = {},
  limit?: number,
): Promise<AdminUserDto[]> {
  return (await adminRepo.findUsers(db, filter, limit)).map((u) => ({
    ...u,
    createdAt: u.createdAt.toISOString(),
    lastLogged: u.lastLogged ?? null,
    costUsd: round(u.costUsd),
  }));
}

/** Changes a user's role. Admins can't demote themselves, so there's always a way back in. */
export async function setRole(db: Database, actorId: string, userId: string, role: UserRole) {
  if (actorId === userId && role !== "admin") {
    throw badRequest("You can't remove your own admin role");
  }
  if (!(await adminRepo.setRole(db, userId, role))) throw notFound("User not found");
}

/** Where links in admin-triggered emails land: the same pages the sign-in screens use. */
export interface AuthLinks {
  /** The web origin (PUBLIC_URL). */
  origin: string;
}

/**
 * Creates an email + password account by hand. Pre-verified accounts can sign in straight away;
 * otherwise the confirmation email goes out as if they'd signed up. Needs AUTH_MODE=better-auth.
 */
export async function createAccount(
  db: Database,
  auth: Auth | null,
  links: AuthLinks,
  body: z.output<typeof createAccountBodySchema>,
): Promise<AdminUserDto> {
  if (!auth) throw badRequest("Creating accounts needs AUTH_MODE=better-auth");
  if (await adminRepo.emailTaken(db, body.email)) {
    throw conflict("An account with that email already exists");
  }
  const ctx = await auth.$context;
  // The same two steps as Better Auth's own email sign-up.
  const identity = await ctx.internalAdapter.createUser(
    { email: body.email, name: body.name, emailVerified: body.verified },
    { method: "email-password" },
  );
  await ctx.internalAdapter.linkAccount({
    userId: identity.id,
    providerId: "credential",
    accountId: identity.id,
    password: await ctx.password.hash(body.password),
  });
  // The app user would also be created on first sign-in; doing it now lets the type be set.
  const user = await userRepo.createForAuth(db, identity);
  if (body.role !== "user") await adminRepo.setRole(db, user.id, body.role);
  if (!body.verified) {
    await auth.api.sendVerificationEmail({
      body: { email: body.email, callbackURL: `${links.origin}/signin?next=/onboarding` },
    });
  }
  const [created] = await listUsers(db, { id: user.id });
  return created!;
}

/** Deletes an account and everything in it. The username must be typed back to confirm. */
export async function deleteAccount(
  db: Database,
  actorId: string,
  userId: string,
  confirm: string,
) {
  if (actorId === userId) throw badRequest("You can't delete your own account from here");
  const account = await adminRepo.findAccount(db, userId);
  if (!account) throw notFound("User not found");
  if (confirm !== account.username) throw badRequest(`Type ${account.username} to confirm`);
  await adminRepo.deleteAccount(db, account.id, account.authSubject);
}

/** One-off fixes to an account's sign-in (DESIGN.md §8.7). */
export async function accountAction(
  db: Database,
  auth: Auth | null,
  links: AuthLinks,
  userId: string,
  action: AccountAction,
) {
  const account = await adminRepo.findAccount(db, userId);
  if (!account) throw notFound("User not found");
  if (!auth || !account.authSubject || !account.authEmail) {
    throw badRequest("This account has no sign-in to manage");
  }
  const email = account.authEmail;
  switch (action) {
    case "verify-email":
      await adminRepo.markEmailVerified(db, account.authSubject);
      return;
    case "resend-verification":
      if (account.emailVerified) throw badRequest("That email is already confirmed");
      await auth.api.sendVerificationEmail({
        body: { email, callbackURL: `${links.origin}/signin?next=/onboarding` },
      });
      return;
    case "send-password-reset":
      await auth.api.requestPasswordReset({
        body: { email, redirectTo: `${links.origin}/reset-password` },
      });
      return;
    case "sign-out-everywhere":
      await adminRepo.deleteSessions(db, account.authSubject);
      return;
  }
}

/** A recap's stored output, its re-runs, and the LLM calls that most likely produced it. */
export async function recapDebug(db: Database, id: string): Promise<RecapDebugDto> {
  const found = await adminRepo.findRecap(db, id);
  if (!found) throw notFound("Recap not found");
  const { row, runs } = found;
  // llm_calls has no recap id; calls for this user and purpose shortly before it was saved.
  const calls = await adminRepo.findCalls(
    db,
    {
      userId: row.userId,
      purpose: row.kind === "daily" ? "recap.daily" : "recap.weekly",
      from: new Date(row.createdAt.getTime() - 5 * 60_000),
      to: new Date(row.createdAt.getTime() + 5_000),
    },
    5,
  );
  return {
    id: row.id,
    kind: row.kind,
    periodStart: row.periodStart,
    periodEnd: row.periodEnd,
    status: row.status,
    promptVersion: row.promptVersion,
    createdAt: row.createdAt.toISOString(),
    output: row.output,
    runs: runs.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
    calls: calls.map(toCallDto),
  };
}
