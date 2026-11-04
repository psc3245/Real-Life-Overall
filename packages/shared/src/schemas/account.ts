import { z } from "zod";
import type { Feature } from "./preferences";

/**
 * Account types (DESIGN.md §8.9), stored as `users.role`. "user" is a free account; premium, dev
 * and admin accounts all get premium features. Dev accounts are play testers: lifetime premium,
 * features still in testing and bug reports. Admins also get /admin and the debug panels.
 */
export const USER_ROLES = ["user", "premium", "dev", "admin"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const ROLE_LABELS: Record<UserRole, string> = {
  user: "Free",
  premium: "Premium",
  dev: "Dev",
  admin: "Admin",
};

export const ROLE_DETAILS: Record<UserRole, string> = {
  user: "Growth seasons, daily recaps and weekly reviews, and the Combine for starting ratings.",
  premium: "Everything: Rating seasons, the coach, the scout, AI write-ups and suggestions.",
  dev: "Play tester: lifetime Premium, features in testing and bug reports.",
  admin: "Premium plus the control room and debug tools.",
};

/** "3 weeks Premium": how long the account has been premium, in weeks (days in the first). */
export function premiumTenure(since: string | null, now = new Date()): string | null {
  if (!since) return null;
  const days = Math.max(0, Math.floor((now.getTime() - new Date(since).getTime()) / 86_400_000));
  if (days < 1) return "New to Premium";
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} Premium`;
  const weeks = Math.floor(days / 7);
  return `${weeks} week${weeks === 1 ? "" : "s"} Premium`;
}

/** What Premium adds, for the upgrade page and the settings account card. */
export const PREMIUM_PERKS = [
  "Rating seasons, plus peeking at your rating in a Growth season",
  "The coach: advice from your own data, with one-tap habits and goals",
  "The AI scout at onboarding: an interview, a drafted tree and tailored questions",
  "AI report write-ups and suggestions",
  "AI suggestions for which attributes a habit builds",
  "A bigger daily AI budget",
] as const;

export const setRoleBodySchema = z.object({ role: z.enum(USER_ROLES) });

export const isPremiumRole = (role: UserRole) => role !== "user";
/** Dev and admin accounts: features in testing and bug reports. */
export const isTesterRole = (role: UserRole) => role === "dev" || role === "admin";

/** Features only premium accounts get. Free accounts see them locked rather than switched off. */
export const PREMIUM_FEATURES: readonly Feature[] = ["coach"];
/** Features still in testing: only dev and admin accounts see them. Move them out to ship. */
export const BETA_FEATURES: readonly Feature[] = [];

export type FeatureLock = "premium" | "beta";

/** Why each feature is unavailable to this account; features it can use are absent. */
export function lockedFeatures(role: UserRole): Partial<Record<Feature, FeatureLock>> {
  const locked: Partial<Record<Feature, FeatureLock>> = {};
  if (!isTesterRole(role)) for (const f of BETA_FEATURES) locked[f] = "beta";
  if (!isPremiumRole(role)) for (const f of PREMIUM_FEATURES) locked[f] ??= "premium";
  return locked;
}

// Bug reports from dev and admin accounts (DESIGN.md §8.9)

export const BUG_REPORT_STATUSES = ["open", "resolved"] as const;
export type BugReportStatus = (typeof BUG_REPORT_STATUSES)[number];
export const MAX_BUG_REPORT = 2000;

export const bugReportBodySchema = z.object({
  message: z.string().trim().min(1, "Describe the bug").max(MAX_BUG_REPORT),
  /** Where it happened: the web route or the iOS screen. */
  page: z.string().trim().max(200).default(""),
  platform: z.enum(["web", "ios"]),
  appVersion: z.string().trim().max(60).nullish(),
  /** User agent on the web, model and OS on iOS. */
  device: z.string().trim().max(300).nullish(),
});
export type BugReportBody = z.input<typeof bugReportBodySchema>;

export const updateBugReportBodySchema = z.object({ status: z.enum(BUG_REPORT_STATUSES) });

export interface BugReportDto {
  id: string;
  userId: string;
  username: string;
  message: string;
  page: string;
  platform: "web" | "ios";
  appVersion: string | null;
  device: string | null;
  status: BugReportStatus;
  createdAt: string;
  resolvedAt: string | null;
}
