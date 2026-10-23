export const BADGE_TIERS = ["bronze", "silver", "gold", "hof"] as const;
export type BadgeTier = (typeof BADGE_TIERS)[number];
export const BADGE_TIER_LABELS: Record<BadgeTier, string> = {
  bronze: "Bronze",
  silver: "Silver",
  gold: "Gold",
  hof: "Hall of Fame",
};

/** Personal (LLM-awarded) badges per season (DESIGN.md §7.1). */
export const MAX_PERSONAL_BADGES_PER_SEASON = 6;

/** Numbers the catalog rules read; computed from the user's history by the API. */
export interface BadgeMetrics {
  bestLoggingStreak: number;
  recappedDays: number;
  habitCompletions: number;
  bestHabitStreak: number;
  /** Largest rise of one attribute above its starting rating this season. */
  biggestGain: number;
  /** Lowest category rating (0 with no categories). */
  lowestCategory: number;
  /** Highest attribute rating. */
  bestAttribute: number;
  weeklyReviews: number;
}

export interface CatalogBadge {
  key: string;
  name: string;
  description: string;
  metric: keyof BadgeMetrics;
  unit: string;
  /** How to move toward the next tier, shown on the badge's detail. */
  hint: string;
  /** Thresholds for bronze, silver, gold, Hall of Fame. */
  thresholds: [number, number, number, number];
}

export const BADGE_CATALOG: CatalogBadge[] = [
  {
    key: "logged-in",
    name: "Logged In",
    description: "Log something several days in a row.",
    hint: "Log anything (a journal line, a habit, an answer) every day. One missed day resets the streak.",
    metric: "bestLoggingStreak",
    unit: "day streak",
    thresholds: [3, 7, 30, 90],
  },
  {
    key: "closer",
    name: "Closer",
    description: "Finish your days with a recap.",
    hint: "Hit “End my day” each evening, or let the 4am auto-recap catch days you logged.",
    metric: "recappedDays",
    unit: "days recapped",
    thresholds: [5, 20, 60, 150],
  },
  {
    key: "habit-machine",
    name: "Habit Machine",
    description: "Complete habits, any of them, again and again.",
    hint: "Every habit done counts, scheduled or bonus. More habits, more chances.",
    metric: "habitCompletions",
    unit: "completions",
    thresholds: [10, 50, 150, 400],
  },
  {
    key: "iron-will",
    name: "Iron Will",
    description: "Never miss a habit on its scheduled days.",
    hint: "Keep one habit going on every day it is scheduled; an unfinished today never breaks it.",
    metric: "bestHabitStreak",
    unit: "scheduled days in a row",
    thresholds: [5, 14, 30, 60],
  },
  {
    key: "climber",
    name: "Climber",
    description: "Raise one attribute above where it started this season.",
    hint: "Pick one attribute and log the work that builds it; recaps raise it a little each time.",
    metric: "biggestGain",
    unit: "points gained",
    thresholds: [2, 5, 10, 15],
  },
  {
    key: "well-rounded",
    name: "Well-Rounded",
    description: "Keep every category up, not just your favorites.",
    hint: "Lift your lowest category. It is the only one this badge looks at.",
    metric: "lowestCategory",
    unit: "lowest category",
    thresholds: [50, 60, 70, 80],
  },
  {
    key: "elite",
    name: "Elite",
    description: "Reach the top of the scale in any attribute.",
    hint: "Push your strongest attribute higher; consistency beats one big day under the daily caps.",
    metric: "bestAttribute",
    unit: "best attribute",
    thresholds: [80, 85, 90, 95],
  },
  {
    key: "week-warrior",
    name: "Week Warrior",
    description: "Complete weekly reviews.",
    hint: "Finish a full week, then run the review on the Week page (or let it run automatically).",
    metric: "weeklyReviews",
    unit: "weekly reviews",
    thresholds: [1, 4, 8, 12],
  },
];

/** Highest tier reached for a badge, or null. */
export function tierFor(badge: CatalogBadge, metrics: BadgeMetrics): BadgeTier | null {
  const value = metrics[badge.metric];
  let tier: BadgeTier | null = null;
  badge.thresholds.forEach((t, i) => {
    if (value >= t) tier = BADGE_TIERS[i]!;
  });
  return tier;
}

/** Every (badge, tier) pair the metrics qualify for, lower tiers included. */
export function earnedTiers(metrics: BadgeMetrics): { key: string; tier: BadgeTier }[] {
  return BADGE_CATALOG.flatMap((badge) =>
    badge.thresholds.flatMap((t, i) =>
      metrics[badge.metric] >= t ? [{ key: badge.key, tier: BADGE_TIERS[i]! }] : [],
    ),
  );
}

export interface EarnedBadgeDto {
  key: string;
  kind: "catalog" | "personal";
  name: string;
  description: string;
  tier: BadgeTier | null;
  earnedAt: string;
}

export interface BadgeProgressDto {
  key: string;
  name: string;
  description: string;
  unit: string;
  value: number;
  tier: BadgeTier | null;
  /** Value needed for the next tier, or null at Hall of Fame. */
  next: number | null;
  hint: string;
  /** Values needed for bronze, silver, gold and Hall of Fame. */
  thresholds: [number, number, number, number];
  /** Tiers earned so far, with when. */
  earned: { tier: BadgeTier; earnedAt: string }[];
}

export interface BadgesDto {
  progress: BadgeProgressDto[];
  personal: EarnedBadgeDto[];
  recent: EarnedBadgeDto[];
}
