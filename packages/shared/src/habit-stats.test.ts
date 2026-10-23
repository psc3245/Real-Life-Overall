import { describe, expect, it } from "vitest";
import { habitStats, habitStreaks, statPeriod } from "./habit-stats";
import type { HabitDto, HabitEntryValue } from "./schemas/habits";

// 2026-10-12 is a Monday.
const habit = (over: Partial<HabitDto> = {}): HabitDto => ({
  id: "h",
  name: "Run",
  type: "checkbox",
  config: { target: null, unit: null, min: null, max: null },
  days: [1, 3, 5],
  links: [],
  sortOrder: 0,
  startsOn: "2026-10-01",
  ...over,
});
const done = (...dates: string[]) =>
  new Map<string, HabitEntryValue>(dates.map((d) => [d, { num: 1, text: null }]));

describe("statPeriod", () => {
  it("finds the week, month and season around a date", () => {
    expect(statPeriod("week", "2026-10-22", 1)).toEqual({ start: "2026-10-19", end: "2026-10-25" });
    expect(statPeriod("week", "2026-10-22", 0)).toEqual({ start: "2026-10-18", end: "2026-10-24" });
    expect(statPeriod("month", "2026-02-10", 1)).toEqual({
      start: "2026-02-01",
      end: "2026-02-28",
    });
    expect(statPeriod("month", "2026-12-31", 1)).toEqual({
      start: "2026-12-01",
      end: "2026-12-31",
    });
    expect(statPeriod("season", "2026-10-22", 1)).toEqual({
      start: "2026-10-01",
      end: "2026-12-31",
    });
  });
});

describe("habitStreaks", () => {
  it("tracks the current and best runs; an unfinished today doesn't break them", () => {
    const dates = new Set(["2026-10-12", "2026-10-14", "2026-10-16", "2026-10-21"]);
    expect(habitStreaks("2026-10-12", [1, 3, 5], dates, "2026-10-23")).toEqual({
      current: 1, // Wed 21 done, Fri 23 (today) not yet
      best: 3,
      bestEnd: "2026-10-16",
    });
  });
});

describe("habitStats", () => {
  it("counts the period so far and what's left", () => {
    // Week of Mon 19 – Sun 25, today Wed 21: Mon done, Wed (today) open, Fri ahead.
    const stats = habitStats(
      habit(),
      done("2026-10-19", "2026-10-20"),
      { start: "2026-10-19", end: "2026-10-25" },
      "2026-10-21",
    );
    expect(stats).toMatchObject({ scheduled: 1, completed: 1, bonus: 1, remaining: 2, rate: 1 });
    expect(stats.days.map((d) => d.done)).toEqual([true, true, false, false, false, false, false]);
    expect(stats.days[4]).toMatchObject({ date: "2026-10-23", scheduled: true, future: true });
  });

  it("averages numeric habits and lists recent entries newest first", () => {
    const entries = new Map<string, HabitEntryValue>([
      ["2026-10-19", { num: 20, text: null }],
      ["2026-10-21", { num: 40, text: null }],
    ]);
    const stats = habitStats(
      habit({ type: "duration", config: { target: 30, unit: null, min: null, max: null } }),
      entries,
      { start: "2026-10-19", end: "2026-10-25" },
      "2026-10-22",
    );
    expect(stats).toMatchObject({ average: 30, target: 30, scheduled: 2, completed: 1 });
    expect(stats.recent).toEqual([
      { date: "2026-10-21", value: "40/30 min" },
      { date: "2026-10-19", value: "20/30 min" },
    ]);
  });

  it("ignores days before the habit started", () => {
    const stats = habitStats(
      habit({ startsOn: "2026-10-21" }),
      done(),
      { start: "2026-10-19", end: "2026-10-25" },
      "2026-10-24",
    );
    expect(stats).toMatchObject({ scheduled: 2, completed: 0, rate: 0 }); // Wed 21 and Fri 23
    expect(stats.days[0]).toMatchObject({ scheduled: false, future: true });
  });
});
