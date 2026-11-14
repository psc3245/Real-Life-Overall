import type { ExerciseStat } from "./exercises";

/**
 * Exercise records (DESIGN.md §7.5). Which ones apply follows from an exercise's stat line; its
 * headline record scores it (charts, history rows, "best" sets).
 */
export const RECORD_KEYS = [
  "best1RmKg",
  "bestPct",
  "heaviestKg",
  "bestSetVolumeKg",
  "mostReps",
  "longestM",
  "longestS",
  "fastestS",
  "steepestPct",
  "highestCm",
  "highestLevel",
] as const;
export type RecordKey = (typeof RECORD_KEYS)[number];

/** One exercise's bests (only the ones that apply to its stat line are set). */
export type ExerciseRecordsDto = Record<RecordKey, number | null>;

export const RECORD_LABELS: Record<RecordKey, string> = {
  best1RmKg: "Best est. 1RM",
  bestPct: "Best percentage",
  heaviestKg: "Heaviest weight",
  bestSetVolumeKg: "Best set volume",
  mostReps: "Most reps",
  longestM: "Longest distance",
  longestS: "Longest time",
  fastestS: "Fastest time",
  steepestPct: "Steepest incline",
  highestCm: "Highest",
  highestLevel: "Highest level",
};

/** Records where the smaller number is the better one. */
export const LOWER_WINS: ReadonlySet<RecordKey> = new Set(["fastestS"]);

/**
 * The records a stat line can set, most telling first (the first is its default headline).
 * Time offers both longest and fastest; only the one the exercise is scored by is kept.
 */
export function availableRecords(stats: readonly ExerciseStat[]): RecordKey[] {
  const has = (s: ExerciseStat) => stats.includes(s);
  const out: RecordKey[] = [];
  if (has("weight") && has("reps")) out.push("best1RmKg");
  if (has("makes")) out.push("bestPct");
  if (has("weight")) out.push("heaviestKg");
  if (has("weight") && has("reps")) out.push("bestSetVolumeKg");
  if (has("reps") || has("makes")) out.push("mostReps");
  if (has("distance") || has("length")) out.push("longestM");
  if (has("duration")) out.push("longestS", "fastestS");
  if (has("incline")) out.push("steepestPct");
  if (has("height")) out.push("highestCm");
  if (has("level")) out.push("highestLevel");
  return out;
}

/** The record an exercise is scored by unless it picks another. */
export function defaultHeadline(stats: readonly ExerciseStat[]): RecordKey {
  return availableRecords(stats)[0] ?? "mostReps";
}

/** The records kept for an exercise: its available ones, minus the time record it isn't scored by. */
export function trackedRecords(stats: readonly ExerciseStat[], headline: RecordKey): RecordKey[] {
  const skip: RecordKey = headline === "fastestS" ? "longestS" : "fastestS";
  return availableRecords(stats).filter((k) => k !== skip);
}
