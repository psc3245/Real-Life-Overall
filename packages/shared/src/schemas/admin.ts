import { z } from "zod";

/** Account roles (DESIGN.md §8.7). Admins see /admin and the debug panels. */
export const USER_ROLES = ["user", "admin"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const setRoleBodySchema = z.object({ role: z.enum(USER_ROLES) });

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
