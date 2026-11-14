import { describe, expect, it } from "vitest";
import {
  bestSet,
  brokenRecords,
  emptySet,
  estimatedOneRm,
  formatSet,
  mergeRecords,
  presetLine,
  recordsFromSets,
  templateChange,
  withTemplateValues,
  workoutVolume,
  type WorkoutExerciseDto,
  type WorkoutSetDto,
  exerciseBodySchema,
} from "./workouts";
import { boxScoreLine, emptyBoxScore, hasBoxScore, trainingLoad } from "./box-score";
import { isValidStatLine, statClash, statFields } from "../exercises";
import { availableRecords, defaultHeadline } from "../records";

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
    const r = recordsFromSets(presetLine("weight_reps"), [
      set({ weightKg: 100, reps: 5 }),
      set({ weightKg: 110, reps: 1 }),
    ]);
    expect(r).toMatchObject({ heaviestKg: 110, mostReps: 5, longestS: null, bestPct: null });
    expect(r.best1RmKg).toBeCloseTo(116.67, 1);
    const shots = recordsFromSets(presetLine("makes_attempts"), [
      set({ reps: 7, attempts: 10 }),
      set({ reps: 3, attempts: 3 }), // too few attempts to count as a percentage
    ]);
    expect(shots).toMatchObject({ bestPct: 70, mostReps: 7, heaviestKg: null });
  });

  it("reports broken records, but never on a first session", () => {
    const before = recordsFromSets(presetLine("weight_reps"), [set({ weightKg: 100, reps: 5 })]);
    const after = recordsFromSets(presetLine("weight_reps"), [set({ weightKg: 105, reps: 3 })]);
    expect(brokenRecords(null, after)).toEqual([]);
    expect(brokenRecords(before, after)).toEqual(["heaviestKg"]);
    expect(mergeRecords(before, after)).toMatchObject({ heaviestKg: 105, mostReps: 5 });
  });

  it("formats sets and picks the best one", () => {
    const sets = [set({ weightKg: 61.235, reps: 8 }), set({ weightKg: 83.91, reps: 3 })];
    expect(formatSet(presetLine("weight_reps"), sets[0]!, "imperial")).toBe("135 lb × 8");
    expect(bestSet(presetLine("weight_reps"), sets)).toBe(sets[1]);
    expect(
      formatSet(
        presetLine("distance_duration"),
        set({ distanceM: 5000, durationS: 1500 }),
        "metric",
      ),
    ).toBe("5 km · 25:00");
    expect(formatSet(presetLine("makes_attempts"), set({ reps: 8, attempts: 10 }), "metric")).toBe(
      "8/10",
    );
  });
});

describe("template changes", () => {
  const ex = (exerciseId: string, sets: Partial<WorkoutSetDto>[]): WorkoutExerciseDto => ({
    exerciseId,
    notes: "",
    restS: null,
    sets: sets.map((s) => set({ done: false, ...s })),
  });
  const plan = [
    ex("bench", [
      { weightKg: 60, reps: 8 },
      { weightKg: 60, reps: 8 },
    ]),
    ex("row", [{}]),
  ];

  it("tells unchanged, value-only and structural edits apart", () => {
    // Checking sets off doesn't count as an edit.
    const checked = plan.map((e) => ({ ...e, sets: e.sets.map((s) => ({ ...s, done: true })) }));
    expect(templateChange(plan, checked)).toBe("none");
    const heavier = [
      ex("bench", [
        { weightKg: 65, reps: 8 },
        { weightKg: 60, reps: 8 },
      ]),
      plan[1]!,
    ];
    expect(templateChange(plan, heavier)).toBe("values");
    expect(templateChange(plan, [plan[1]!, plan[0]!])).toBe("structure");
    expect(templateChange(plan, [plan[0]!])).toBe("structure");
    expect(templateChange(plan, [ex("bench", [{ weightKg: 60, reps: 8 }]), plan[1]!])).toBe(
      "structure",
    );
  });

  it("copies done numbers into the template's own sets", () => {
    const workout = [
      ex("row", [{ weightKg: 50, reps: 10, done: true }]),
      ex("bench", [{ weightKg: 70, reps: 5, done: true }, { weightKg: 99, reps: 1 }, { reps: 3 }]),
      ex("curl", [{ weightKg: 15, reps: 12, done: true }]),
    ];
    const next = withTemplateValues(plan, workout);
    expect(next.map((e) => e.exerciseId)).toEqual(["bench", "row"]);
    // The unchecked second set keeps the template's numbers; the extra third set isn't added.
    expect(next[0]!.sets.map((s) => [s.weightKg, s.reps, s.done])).toEqual([
      [70, 5, false],
      [60, 8, false],
    ]);
    expect(next[1]!.sets[0]).toMatchObject({ weightKg: 50, reps: 10, done: false });
  });
});

describe("weight + time, weight + distance and distance sets", () => {
  it("records the heaviest weight and the longest time or distance", () => {
    const carries = [set({ weightKg: 40, durationS: 60 }), set({ weightKg: 50, durationS: 30 })];
    expect(recordsFromSets(presetLine("weight_duration"), carries)).toMatchObject({
      heaviestKg: 50,
      longestS: 60,
      longestM: null,
      best1RmKg: null,
    });
    expect(bestSet(presetLine("weight_duration"), carries)).toBe(carries[1]);
    expect(formatSet(presetLine("weight_duration"), carries[1]!, "metric")).toBe("50 kg · 0:30");
    // Older duration-only sets still read.
    expect(formatSet(presetLine("weight_duration"), set({ durationS: 45 }), "metric")).toBe("0:45");

    const sled = [set({ weightKg: 100, distanceM: 20 }), set({ weightKg: 100, distanceM: 30 })];
    expect(recordsFromSets(presetLine("weight_distance"), sled)).toMatchObject({
      heaviestKg: 100,
      longestM: 30,
    });
    expect(bestSet(presetLine("weight_distance"), sled)).toBe(sled[1]);

    const jumps = [set({ distanceM: 5.2 }), set({ distanceM: 5.6 })];
    expect(recordsFromSets(presetLine("distance"), jumps).longestM).toBe(5.6);
    expect(formatSet(presetLine("distance"), jumps[1]!, "metric")).toBe("5.6 m");
    expect(formatSet(presetLine("weight_distance"), sled[1]!, "imperial")).toBe(
      "220.5 lb · 98.4 ft",
    );
  });
});

describe("stat lines", () => {
  const walk = {
    stats: ["weight", "length", "duration", "incline"] as const,
    headline: "heaviestKg" as const,
  };

  it("validates stat lines and offers the records that fit", () => {
    expect(isValidStatLine(["weight", "length", "duration", "incline"])).toBe(true);
    expect(isValidStatLine(["reps", "makes"])).toBe(false);
    expect(isValidStatLine(["distance", "length"])).toBe(false);
    expect(isValidStatLine(["weight", "reps", "duration", "incline", "rpe"])).toBe(false);
    expect(isValidStatLine([])).toBe(false);
    expect(statClash(["reps"], "makes")).toBe("reps");
    expect(availableRecords(walk.stats)).toEqual([
      "heaviestKg",
      "longestM",
      "longestS",
      "fastestS",
      "steepestPct",
    ]);
    expect(defaultHeadline(["weight", "reps"])).toBe("best1RmKg");
    expect(statFields(["makes", "rpe"])).toEqual(["reps", "attempts", "rpe"]);
  });

  it("scores and formats a weighted farmer's walk up an incline", () => {
    const sets = [
      set({ weightKg: 40, distanceM: 30, durationS: 40, inclinePct: 5 }),
      set({ weightKg: 45, distanceM: 20, durationS: 30, inclinePct: 3 }),
      set({ weightKg: 45, distanceM: 25, durationS: 35, inclinePct: 8 }),
    ];
    const r = recordsFromSets(walk, sets);
    expect(r).toMatchObject({ heaviestKg: 45, longestM: 30, longestS: 40, steepestPct: 8 });
    expect(r.fastestS).toBeNull();
    expect(r.best1RmKg).toBeNull();
    expect(bestSet(walk, sets)).toBe(sets[2]);
    expect(formatSet(walk, sets[2]!, "metric")).toBe("45 kg · 25 m · 0:35 · 8% incline");
  });

  it("scores sprints by the fastest time", () => {
    const dash = { stats: ["duration"] as const, headline: "fastestS" as const };
    const sets = [set({ durationS: 5.1 }), set({ durationS: 4.8 }), set({ durationS: null })];
    expect(recordsFromSets(dash, sets)).toMatchObject({ fastestS: 4.8, longestS: null });
    expect(bestSet(dash, sets)).toBe(sets[1]);
    const before = recordsFromSets(dash, [set({ durationS: 5 })]);
    expect(brokenRecords(before, recordsFromSets(dash, sets))).toEqual(["fastestS"]);
    expect(mergeRecords(before, recordsFromSets(dash, sets)).fastestS).toBe(4.8);
    expect(formatSet(dash, sets[1]!, "imperial")).toBe("0:04.8");
  });

  it("formats the newer stats", () => {
    const line = { stats: ["reps", "height", "level", "rpe"] as const };
    expect(formatSet(line, set({ reps: 5, heightCm: 61, level: 8, rpe: 7 }), "imperial")).toBe(
      "5 reps · 24 in · level 8 · RPE 7",
    );
  });

  it("takes a stat line or an older app's preset when creating an exercise", () => {
    const fromStats = exerciseBodySchema.parse({
      name: "Hill carry",
      category: "full_body",
      stats: ["weight", "length", "duration", "incline"],
    });
    expect(fromStats.stats).toHaveLength(4);
    const fromPreset = exerciseBodySchema.parse({
      name: "Floaters",
      category: "sport",
      tracking: "makes_attempts",
    });
    expect(fromPreset.stats).toEqual(["makes"]);
    expect(
      exerciseBodySchema.safeParse({
        name: "x",
        category: "core",
        stats: ["reps"],
        headline: "heaviestKg",
      }).success,
    ).toBe(false);
    expect(exerciseBodySchema.safeParse({ name: "x", category: "core" }).success).toBe(false);
  });
});

describe("box score", () => {
  it("works out training load and its line", () => {
    expect(trainingLoad(7, 3600)).toBe(420);
    expect(trainingLoad(null, 3600)).toBeNull();
    expect(
      boxScoreLine({ ...emptyBoxScore(), avgHeartRate: 140, maxHeartRate: 171, effort: 8 }),
    ).toBe("avg HR 140 · max 171 · effort 8/10");
    expect(hasBoxScore(emptyBoxScore())).toBe(false);
  });
});
