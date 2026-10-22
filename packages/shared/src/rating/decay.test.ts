import { describe, expect, it } from "vitest";
import { computeDecay, type DecayInput } from "./decay";

const base = (over: Partial<DecayInput> = {}): DecayInput => ({
  from: "2026-10-02",
  through: "2026-10-08",
  baseline: "2026-10-01",
  rules: new Map([["cardio", { graceDays: 3, perDay: 0.5, floor: 60 }]]),
  values: new Map([["cardio", 62]]),
  activity: new Map(),
  isPaused: () => false,
  ...over,
});

const summary = (days: ReturnType<typeof computeDecay>) =>
  days.flatMap((d) => d.changes.map((c) => `${d.date}:${c.delta}@${c.idleDays}`));

describe("computeDecay", () => {
  it("fades after the grace period, down to the floor", () => {
    // Idle days 1-3 are grace; 4..7 decay 0.5 each but stop at the floor of 60.
    expect(summary(computeDecay(base()))).toEqual([
      "2026-10-05:-0.5@4",
      "2026-10-06:-0.5@5",
      "2026-10-07:-0.5@6",
      "2026-10-08:-0.5@7",
    ]);
    expect(summary(computeDecay(base({ values: new Map([["cardio", 61.2]]) })))).toEqual([
      "2026-10-05:-0.5@4",
      "2026-10-06:-0.5@5",
      "2026-10-07:-0.2@6",
    ]);
  });

  it("resets on activity", () => {
    const activity = new Map([["cardio", new Set(["2026-10-04"])]]);
    expect(summary(computeDecay(base({ activity })))).toEqual(["2026-10-08:-0.5@4"]);
  });

  it("does not count paused days as idle", () => {
    const paused = new Set(["2026-10-03", "2026-10-04", "2026-10-05"]);
    const days = computeDecay(base({ isPaused: (d) => paused.has(d) }));
    expect(summary(days)).toEqual(["2026-10-08:-0.5@4"]);
    expect(days.filter((d) => d.paused).map((d) => d.date)).toEqual([...paused]);
  });

  it("counts idle days that happened before the processed range", () => {
    // Last activity Oct 1 (baseline); processing starts Oct 6, already 4 idle days in.
    expect(summary(computeDecay(base({ from: "2026-10-06" })))).toEqual([
      "2026-10-06:-0.5@5",
      "2026-10-07:-0.5@6",
      "2026-10-08:-0.5@7",
    ]);
  });

  it("ignores leaves without a value or already at the floor", () => {
    expect(computeDecay(base({ values: new Map() })).flatMap((d) => d.changes)).toEqual([]);
    expect(
      computeDecay(base({ values: new Map([["cardio", 60]]) })).flatMap((d) => d.changes),
    ).toEqual([]);
  });
});
