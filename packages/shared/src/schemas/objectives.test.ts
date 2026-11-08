import { describe, expect, it } from "vitest";
import {
  createObjectiveBodySchema,
  habitContribution,
  objectivePacePct,
  objectiveProgress,
  objectiveTerm,
  reachProgress,
  type ObjectiveDto,
} from "./objectives";
import { normalizeHabitConfig } from "./habits";

const week = { target: 3, startsOn: "2026-10-19", endsOn: "2026-10-25" };
const days = (entries: Record<string, number>) => new Map(Object.entries(entries));

describe("objectiveTerm", () => {
  it("splits short and long term at a month", () => {
    expect(objectiveTerm("2026-10-19", "2026-10-25")).toBe("short");
    expect(objectiveTerm("2026-10-01", "2026-10-31")).toBe("short");
    expect(objectiveTerm("2026-10-25", "2026-12-31")).toBe("long");
  });
});

describe("objectiveProgress", () => {
  it("sums the window and paces against the days already behind", () => {
    const p = objectiveProgress(week, days({ "2026-10-18": 5, "2026-10-19": 1 }), "2026-10-22");
    // Mon-Wed are behind us: 3/7 of the target expected.
    expect(p).toMatchObject({ current: 1, status: "active", daysLeft: 3, expected: 1.29 });
    expect(p.onPace).toBe(false);
    expect(Math.round(p.pct)).toBe(33);
  });

  it("is on pace on the first day with nothing logged", () => {
    expect(objectiveProgress(week, new Map(), "2026-10-19").onPace).toBe(true);
  });

  it("records the day the target was reached", () => {
    const p = objectiveProgress(
      week,
      days({ "2026-10-19": 1, "2026-10-21": 1, "2026-10-23": 1, "2026-10-24": 1 }),
      "2026-10-24",
    );
    expect(p).toMatchObject({ status: "completed", completedOn: "2026-10-23", pct: 100 });
  });

  it("is upcoming before the window and missed after it", () => {
    expect(objectiveProgress(week, new Map(), "2026-10-10").status).toBe("upcoming");
    const missed = objectiveProgress(week, days({ "2026-10-20": 2 }), "2026-10-27");
    expect(missed).toMatchObject({ status: "missed", daysLeft: -2, expected: 3 });
  });
});

describe("habitContribution", () => {
  it("adds amounts for counts and time, done days otherwise", () => {
    const counter = normalizeHabitConfig("counter", { target: 5, unit: "miles" });
    expect(habitContribution("counter", counter, { num: 3.5, text: null })).toBe(3.5);
    const check = normalizeHabitConfig("checkbox");
    expect(habitContribution("checkbox", check, { num: 1, text: null })).toBe(1);
    expect(habitContribution("checkbox", check, { num: 0, text: null })).toBe(0);
  });
});

describe("createObjectiveBodySchema", () => {
  it("needs a deadline on or after the start and a habit for habit goals", () => {
    const base = { name: "Run", target: 100, endsOn: "2026-12-31" };
    expect(createObjectiveBodySchema.safeParse(base).success).toBe(true);
    expect(createObjectiveBodySchema.safeParse({ ...base, startsOn: "2027-01-01" }).success).toBe(
      false,
    );
    expect(createObjectiveBodySchema.safeParse({ ...base, source: "habit" }).success).toBe(false);
  });
});

describe("reach goals", () => {
  // 10 days to go from 200 down to 190.
  const cut = { target: 190, startValue: 200, startsOn: "2026-11-01", endsOn: "2026-11-10" };

  it("tracks the latest reading between the start and the target", () => {
    const p = reachProgress(cut, days({ "2026-11-02": 199, "2026-11-04": 196 }), "2026-11-06");
    expect(p).toMatchObject({ current: 196, pct: 40, status: "active", completedOn: null });
    // Five days in, an even pace is at 195: 196 is behind.
    expect(p.expected).toBe(195);
    expect(p.onPace).toBe(false);
  });

  it("starts at the start, ignores readings outside the window, and works upward", () => {
    const none = reachProgress(cut, days({ "2026-10-31": 150 }), "2026-11-01");
    expect(none).toMatchObject({ current: 200, pct: 0, onPace: true });
    const up = { ...cut, startValue: 20, target: 30 };
    expect(reachProgress(up, days({ "2026-11-03": 25 }), "2026-11-03").pct).toBe(50);
    // Going the wrong way shows 0, not negative.
    expect(reachProgress(up, days({ "2026-11-03": 18 }), "2026-11-03").pct).toBe(0);
  });

  it("completes the first day the target is reached, even after a bounce", () => {
    const p = reachProgress(cut, days({ "2026-11-05": 189.6, "2026-11-07": 191 }), "2026-11-08");
    expect(p).toMatchObject({ status: "completed", completedOn: "2026-11-05", current: 191 });
  });

  it("puts the pace marker on the reach scale", () => {
    const o = {
      kind: "reach",
      startValue: 200,
      target: 190,
      unit: "lb",
      progress: reachProgress(cut, days({ "2026-11-04": 196.4 }), "2026-11-06"),
    } as ObjectiveDto;
    expect(objectivePacePct(o)).toBe(50);
  });

  it("validates a reach goal's start", () => {
    const base = { name: "Cut", kind: "reach", target: 185, endsOn: "2026-12-31" } as const;
    expect(createObjectiveBodySchema.safeParse(base).success).toBe(false);
    expect(createObjectiveBodySchema.safeParse({ ...base, startValue: 185 }).success).toBe(false);
    expect(createObjectiveBodySchema.safeParse({ ...base, startValue: 200 }).success).toBe(true);
    // Weight goals can start from the latest logged weight; paying something off aims at 0.
    expect(createObjectiveBodySchema.safeParse({ ...base, source: "weight" }).success).toBe(true);
    expect(
      createObjectiveBodySchema.safeParse({ ...base, startValue: 5000, target: 0 }).success,
    ).toBe(true);
    expect(createObjectiveBodySchema.safeParse({ ...base, source: "habit" }).success).toBe(false);
    expect(
      createObjectiveBodySchema.safeParse({ name: "Run", target: 0, endsOn: "2026-12-31" }).success,
    ).toBe(false);
  });
});
