import {
  addDays,
  type BadgesDto,
  type DayDto,
  type HabitDto,
  type WeeklyStateDto,
} from "@rlo/shared";
import { describe, expect, it } from "vitest";
import { ratingEvents, userBadges } from "../src/db/schema";
import { bestHabitStreak, longestRun } from "../src/services/badge-service";
import { createRatedApp, json } from "./flows";
import { jsonResult } from "./helpers";

const body = async <T>(res: Response) => (await res.json()) as T;

describe("streak helpers", () => {
  it("finds the longest run of consecutive dates", () => {
    expect(longestRun(["2026-10-01", "2026-10-02", "2026-10-04", "2026-10-05", "2026-10-06"])).toBe(
      3,
    );
    expect(longestRun([])).toBe(0);
  });

  it("counts habit streaks over scheduled days only, ignoring an unfinished today", () => {
    // Mon/Wed/Fri habit. 2026-10-12 is a Monday.
    const done = new Set(["2026-10-12", "2026-10-14", "2026-10-16", "2026-10-21"]);
    expect(bestHabitStreak("2026-10-12", [1, 3, 5], done, "2026-10-23")).toBe(3); // missed Mon 19
    expect(bestHabitStreak("2026-10-19", [1, 3, 5], new Set(["2026-10-21"]), "2026-10-23")).toBe(1);
    expect(bestHabitStreak("2026-10-21", [3, 5], new Set(["2026-10-21"]), "2026-10-23")).toBe(1);
  });
});

describe("badges", () => {
  const recap = (ref: string, delta: number) =>
    jsonResult({
      changes: [{ ref, delta, reason: "r", evidence: "e" }],
      narrative: "Day.",
      flags: [],
      nextPrompts: [],
    });

  it("awards catalog tiers as they are reached and shows them on the recap", async () => {
    const t = await createRatedApp([recap("n3", 3), recap("n3", 3), recap("n3", 3)]);
    const today = (await body<DayDto>(await t.request("/days/today"))).today;
    const habit = await body<HabitDto>(
      await t.request("/habits", {
        method: "POST",
        ...json({ name: "Run", type: "checkbox", startsOn: addDays(today, -3) }),
      }),
    );
    let last: DayDto | null = null;
    for (const offset of [-2, -1, 0]) {
      const date = addDays(today, offset);
      await t.request(`/days/${date}/habits/${habit.id}`, { method: "PUT", ...json({ num: 1 }) });
      last = await body<DayDto>(await t.request(`/days/${date}/recap`, { method: "POST" }));
    }
    // Three logged days in a row; Cardio rose 70 -> 79 (above the 5-point silver Climber).
    expect(last!.recap!.badges.map((b) => b.name).sort()).toEqual(["Logged In · Bronze"]);

    const badges = await body<BadgesDto>(await t.request("/badges"));
    const progress = new Map(badges.progress.map((p) => [p.key, p]));
    expect(progress.get("logged-in")).toMatchObject({
      value: 3,
      tier: "bronze",
      next: 7,
      thresholds: [3, 7, 30, 90],
    });
    expect(progress.get("logged-in")!.earned.map((e) => e.tier)).toEqual(["bronze"]);
    expect(progress.get("logged-in")!.hint).toMatch(/every day/);
    expect(progress.get("climber")).toMatchObject({ value: 9, tier: "silver", next: 10 });
    expect(progress.get("iron-will")).toMatchObject({ value: 3, tier: null, next: 5 });
    expect(progress.get("closer")).toMatchObject({ value: 3, tier: null, next: 5 });
    expect(progress.get("elite")).toMatchObject({ value: 80, tier: "bronze" });
    expect(badges.recent.length).toBeGreaterThan(0);

    // Idempotent: asking again earns nothing new.
    const before = (await t.db.select().from(userBadges)).length;
    await t.request("/badges");
    expect(await t.db.select().from(userBadges)).toHaveLength(before);
  });

  it("weekly reviews can award a personal badge alongside catalog tiers", async () => {
    const review = (name: string | null) =>
      jsonResult({
        narrative: "Week.",
        corrections: [],
        decayRevisions: [],
        focusGoals: [{ title: "Go", detail: "Do it.", refs: [] }],
        habitProposals: [],
        profileSummary: "Profile.",
        projections: [],
        archetype: null,
        personalBadge: name ? { name, description: "First 10k run." } : null,
        scoutingReport: { aspirations: [], priorities: [], focuses: [], constraints: [] },
        weightShifts: [],
        treeChange: null,
      });
    const t = await createRatedApp([review("Ten-K Club")]);
    await t.db.update(ratingEvents).set({ createdAt: new Date(Date.now() - 14 * 86_400_000) });
    const state = await body<WeeklyStateDto>(await t.request("/weekly/run", { method: "POST" }));
    const names = state.review!.badges.map((b) => b.name);
    expect(names).toContain("Ten-K Club");
    expect(names).toContain("Week Warrior · Bronze");
    const badges = await body<BadgesDto>(await t.request("/badges"));
    expect(badges.personal).toEqual([
      expect.objectContaining({ kind: "personal", name: "Ten-K Club", tier: null }),
    ]);
  });
});
