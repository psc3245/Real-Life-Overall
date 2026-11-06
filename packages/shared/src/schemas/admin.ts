import { z } from "zod";
import { USER_ROLES, type UserRole } from "./account";

export interface LlmCallDto {
  id: string;
  userId: string | null;
  username: string | null;
  purpose: string;
  provider: string;
  model: string;
  promptVersion: string;
  inputTokens: number | null;
  outputTokens: number | null;
  costUsd: number | null;
  latencyMs: number;
  error: string | null;
  createdAt: string;
}

export interface UsageRowDto {
  key: string;
  calls: number;
  errors: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  avgLatencyMs: number;
}

export interface AdminOverviewDto {
  users: number;
  admins: number;
  activeSeasons: number;
  /** Users with a day log in the window. */
  activeUsers7d: number;
  windows: { label: "24h" | "7d" | "30d"; calls: number; errors: number; costUsd: number }[];
  /** Last 30 days. */
  byPurpose: UsageRowDto[];
  byModel: UsageRowDto[];
  byDay: { date: string; calls: number; costUsd: number }[];
  recentErrors: LlmCallDto[];
}

export interface AdminUserDto {
  id: string;
  username: string;
  displayName: string;
  email: string;
  role: UserRole;
  /** Null for accounts with no sign-in (dev-mode users). */
  emailVerified: boolean | null;
  /** How the account signs in: "credential" (email + password), "google". Empty for dev-mode users. */
  signIn: string[];
  timezone: string;
  createdAt: string;
  lastLogged: string | null;
  llmCalls: number;
  costUsd: number;
}

export interface RecapDebugDto {
  id: string;
  kind: "daily" | "weekly";
  periodStart: string;
  periodEnd: string;
  status: "active" | "superseded";
  promptVersion: string;
  createdAt: string;
  /** The stored, normalized model output. */
  output: unknown;
  /** Every recap for the same period, oldest first (re-runs supersede). */
  runs: { id: string; status: string; createdAt: string }[];
  /** LLM calls for this user and purpose close to when the recap was written. */
  calls: LlmCallDto[];
}

// Account management in the Front Office (DESIGN.md §8.7)

/** Same minimum as Better Auth's `minPasswordLength` in apps/api/src/auth/auth.ts. */
export const ADMIN_MIN_PASSWORD = 8;

export const adminUsersQuerySchema = z.object({
  /** Matches username, display name or email, case-insensitively. */
  q: z.string().trim().max(100).optional(),
  role: z.enum(USER_ROLES).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(200),
});

export const createAccountBodySchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email")),
  name: z.string().trim().min(1, "Enter a name").max(60),
  password: z
    .string()
    .min(ADMIN_MIN_PASSWORD, `At least ${ADMIN_MIN_PASSWORD} characters`)
    .max(128),
  role: z.enum(USER_ROLES).default("user"),
  /** Skip the confirmation email: the account can sign in straight away. */
  verified: z.boolean().default(true),
});
export type CreateAccountBody = z.input<typeof createAccountBodySchema>;

/** One-off actions on an account's sign-in. */
export const ACCOUNT_ACTIONS = [
  "verify-email",
  "resend-verification",
  "send-password-reset",
  "sign-out-everywhere",
] as const;
export type AccountAction = (typeof ACCOUNT_ACTIONS)[number];
export const accountActionBodySchema = z.object({ action: z.enum(ACCOUNT_ACTIONS) });

/** DELETE /admin/users/:id needs the username typed back, so a slip of the mouse can't do it. */
export const deleteAccountBodySchema = z.object({ confirm: z.string().trim().toLowerCase() });
