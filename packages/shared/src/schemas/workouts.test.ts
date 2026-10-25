import { describe, expect, it } from "vitest";
import {
  bestSet,
  brokenRecords,
  emptySet,
  estimatedOneRm,
  formatSet,
  mergeRecords,
  recordsFromSets,
  workoutVolume,
  type WorkoutSetDto,
} from "./workouts";

const set = (over: Partial<WorkoutSetDto>): WorkoutSetDto => ({
  ...emptySet(),
  done: true,
  ...over,
});

describe("workout math", () => {
  it("estimates one-rep maxes and volume from done sets", () => {
    expect(estimatedOneRm(100, 1)).toBe(100);
    expect(estimatedOneRm(100, 6)).toBe(120);
    expect(
      workoutVolume([
        {
          exerciseId: "bench-press-barbell",
          notes: "",
          sets: [set({ weightKg: 60, reps: 10 }), set({ weightKg: 80, reps: 5, done: false })],
        },
      ]),
    ).toBe(600);
  });

  it("finds records that apply to the tracking kind", () => {
    const r = recordsFromSets("weight_reps", [
      set({ weightKg: 100, reps: 5 }),
      set({ weightKg: 110, reps: 1 }),
    ]);
    expect(r).toMatchObject({ heaviestKg: 110, mostReps: 5, longestS: null, bestPct: null });
    expect(r.best1RmKg).toBeCloseTo(116.67, 1);
    const shots = recordsFromSets("makes_attempts", [
      set({ reps: 7, attempts: 10 }),
      set({ reps: 3, attempts: 3 }), // too few attempts to count as a percentage
    ]);
    expect(shots).toMatchObject({ bestPct: 70, mostReps: 7, heaviestKg: null });
  });

  it("reports broken records, but never on a first session", () => {
    const before = recordsFromSets("weight_reps", [set({ weightKg: 100, reps: 5 })]);
    const after = recordsFromSets("weight_reps", [set({ weightKg: 105, reps: 3 })]);
    expect(brokenRecords(null, after)).toEqual([]);
    expect(brokenRecords(before, after)).toEqual(["heaviestKg"]);
    expect(mergeRecords(before, after)).toMatchObject({ heaviestKg: 105, mostReps: 5 });
  });

  it("formats sets and picks the best one", () => {
    const sets = [set({ weightKg: 61.235, reps: 8 }), set({ weightKg: 83.91, reps: 3 })];
    expect(formatSet("weight_reps", sets[0]!, "imperial")).toBe("135 lb × 8");
    expect(bestSet("weight_reps", sets)).toBe(sets[1]);
    expect(
      formatSet("distance_duration", set({ distanceM: 5000, durationS: 1500 }), "metric"),
    ).toBe("5 km · 25:00");
    expect(formatSet("makes_attempts", set({ reps: 8, attempts: 10 }), "metric")).toBe("8/10");
  });
});
