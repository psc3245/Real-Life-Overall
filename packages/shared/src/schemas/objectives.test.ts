import { describe, expect, it } from "vitest";
import {
  createObjectiveBodySchema,
  habitContribution,
  objectiveProgress,
  objectiveTerm,
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
