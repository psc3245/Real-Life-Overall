import { describe, expect, it } from "vitest";
import { BADGE_CATALOG, earnedTiers, tierFor, type BadgeMetrics } from "./badges";

const metrics = (over: Partial<BadgeMetrics> = {}): BadgeMetrics => ({
  bestLoggingStreak: 0,
  recappedDays: 0,
  habitCompletions: 0,
  bestHabitStreak: 0,
  biggestGain: 0,
  lowestCategory: 0,
  bestAttribute: 0,
  weeklyReviews: 0,
  ...over,
});

describe("badge rules", () => {
  it("picks the highest tier reached", () => {
    const loggedIn = BADGE_CATALOG.find((b) => b.key === "logged-in")!;
    expect(tierFor(loggedIn, metrics({ bestLoggingStreak: 2 }))).toBeNull();
    expect(tierFor(loggedIn, metrics({ bestLoggingStreak: 7 }))).toBe("silver");
    expect(tierFor(loggedIn, metrics({ bestLoggingStreak: 400 }))).toBe("hof");
  });

  it("lists every earned tier, lower ones included", () => {
    expect(earnedTiers(metrics({ recappedDays: 25, bestAttribute: 85.2 }))).toEqual([
      { key: "closer", tier: "bronze" },
      { key: "closer", tier: "silver" },
      { key: "elite", tier: "bronze" },
      { key: "elite", tier: "silver" },
    ]);
  });

  it("has unique keys and ascending thresholds", () => {
    expect(new Set(BADGE_CATALOG.map((b) => b.key)).size).toBe(BADGE_CATALOG.length);
    for (const b of BADGE_CATALOG) {
      expect([...b.thresholds].sort((x, y) => x - y)).toEqual(b.thresholds);
    }
  });
});
