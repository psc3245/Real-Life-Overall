import { z } from "zod";
import { isValidDate } from "../dates";
import {
  EXERCISE_CATEGORIES,
  EXERCISE_TRACKING,
  type ExerciseCategory,
  type ExerciseTracking,
} from "../exercises";
import {
  distanceUnit,
  formatDuration,
  toDisplayDistance,
  toDisplayWeight,
  weightUnit,
  type UnitSystem,
} from "../units";

/**
 * Workouts (DESIGN.md §7.5), modeled on set-by-set gym loggers: exercises hold sets, sets are
 * checked off as they're done, and templates prefill a workout. Weights are kg, distances m,
 * durations s.
 */

/** Warm-up, drop and failure sets are tagged; normal sets are numbered. */
export const SET_KINDS = ["normal", "warmup", "drop", "failure"] as const;
export type SetKind = (typeof SET_KINDS)[number];
export const SET_KIND_LABELS: Record<SetKind, string> = {
  normal: "Normal",
  warmup: "Warm-up",
  drop: "Drop set",
  failure: "Failure",
};
export const SET_KIND_TAGS: Record<Exclude<SetKind, "normal">, string> = {
  warmup: "W",
  drop: "D",
  failure: "F",
};

export const MAX_WORKOUT_EXERCISES = 40;
export const MAX_SETS_PER_EXERCISE = 30;
export const MAX_WORKOUT_NOTES = 2000;

export interface WorkoutSetDto {
  kind: SetKind;
  weightKg: number | null;
  /** Reps, or makes for makes/attempts. */
  reps: number | null;
  durationS: number | null;
  distanceM: number | null;
  attempts: number | null;
  done: boolean;
}

export interface WorkoutExerciseDto {
  /** A catalog slug or a custom exercise's uuid. */
  exerciseId: string;
  notes: string;
  sets: WorkoutSetDto[];
}

export interface ExerciseDto {
  id: string;
  name: string;
  category: ExerciseCategory;
  tracking: ExerciseTracking;
  custom: boolean;
  /** Completed workouts that included it. */
  timesDone: number;
  lastDone: string | null;
}

export interface WorkoutSummaryDto {
  /** Seconds from start to finish (or to now, while in progress). */
  durationS: number;
  /** Σ weight × reps over done sets, kg. */
  volumeKg: number;
  doneSets: number;
  /** Personal records set in this workout, e.g. "Bench Press (Barbell): heaviest weight". */
  prs: { exerciseId: string; label: string }[];
}

export interface WorkoutDto {
  id: string;
  name: string;
  notes: string;
  /** The day it counts for (the user's local date it started). */
  localDate: string;
  startedAt: string;
  /** Null while in progress. */
  endedAt: string | null;
  templateId: string | null;
  exercises: WorkoutExerciseDto[];
  summary: WorkoutSummaryDto;
  /** The sets from the last completed workout with each exercise (the "Previous" column). */
  previous: Record<string, WorkoutSetDto[]>;
}

export interface WorkoutTemplateDto {
  id: string;
  name: string;
  notes: string;
  exercises: WorkoutExerciseDto[];
  lastUsedAt: string | null;
}

export interface WorkoutHistoryDto {
  workouts: WorkoutDto[];
  /** Pass as `before` for the next page; null at the end. */
  nextBefore: string | null;
}

/** One exercise's bests (only the ones that apply to its tracking kind are set). */
export interface ExerciseRecordsDto {
  heaviestKg: number | null;
  /** Estimated one-rep max (Epley), kg. */
  best1RmKg: number | null;
  bestSetVolumeKg: number | null;
  mostReps: number | null;
  longestS: number | null;
  longestM: number | null;
  /** Best makes/attempts percentage (0-100), with at least 5 attempts. */
  bestPct: number | null;
}

export interface ExerciseDetailDto {
  exercise: ExerciseDto;
  records: ExerciseRecordsDto;
  /** Newest first. */
  history: {
    workoutId: string;
    workoutName: string;
    localDate: string;
    sets: WorkoutSetDto[];
    /** The session's headline number for charts (1RM, reps, time, distance or %). */
    best: number | null;
  }[];
}

/** A workout as the day log and recap see it. */
export interface DayWorkoutDto {
  id: string;
  name: string;
  durationS: number;
  volumeKg: number;
  /** "Bench Press (Barbell): 3 sets, best 185 lb × 5" */
  lines: string[];
  prs: string[];
}

// Math

/** Epley estimate; a single rep is its own max. */
export function estimatedOneRm(weightKg: number, reps: number): number {
  if (reps <= 0) return 0;
  return reps === 1 ? weightKg : weightKg * (1 + reps / 30);
}

const isWork = (s: WorkoutSetDto) => s.done;

export function setVolume(s: WorkoutSetDto): number {
  return (s.weightKg ?? 0) * (s.reps ?? 0);
}

export function workoutVolume(exercises: WorkoutExerciseDto[]): number {
  return exercises.reduce(
    (sum, e) => sum + e.sets.filter(isWork).reduce((v, s) => v + setVolume(s), 0),
    0,
  );
}

const max = (values: (number | null | undefined)[]) => {
  const nums = values.filter((v): v is number => typeof v === "number" && v > 0);
  return nums.length ? Math.max(...nums) : null;
};

/** Bests over done sets. */
export function recordsFromSets(
  tracking: ExerciseTracking,
  sets: WorkoutSetDto[],
): ExerciseRecordsDto {
  const done = sets.filter(isWork);
  const pct = done
    .filter((s) => (s.attempts ?? 0) >= 5 && s.reps !== null)
    .map((s) => (100 * s.reps!) / s.attempts!);
  return {
    heaviestKg: tracking === "weight_reps" ? max(done.map((s) => s.weightKg)) : null,
    best1RmKg:
      tracking === "weight_reps"
        ? max(done.map((s) => estimatedOneRm(s.weightKg ?? 0, s.reps ?? 0)))
        : null,
    bestSetVolumeKg: tracking === "weight_reps" ? max(done.map(setVolume)) : null,
    mostReps:
      tracking === "weight_reps" || tracking === "reps" || tracking === "makes_attempts"
        ? max(done.map((s) => s.reps))
        : null,
    longestS:
      tracking === "duration" || tracking === "distance_duration"
        ? max(done.map((s) => s.durationS))
        : null,
    longestM: tracking === "distance_duration" ? max(done.map((s) => s.distanceM)) : null,
    bestPct: tracking === "makes_attempts" ? max(pct) : null,
  };
}

export const RECORD_LABELS: Record<keyof ExerciseRecordsDto, string> = {
  heaviestKg: "Heaviest weight",
  best1RmKg: "Best est. 1RM",
  bestSetVolumeKg: "Best set volume",
  mostReps: "Most reps",
  longestS: "Longest time",
  longestM: "Longest distance",
  bestPct: "Best percentage",
};

/** The headline record per tracking kind (charts, history rows). */
export const HEADLINE_RECORD: Record<ExerciseTracking, keyof ExerciseRecordsDto> = {
  weight_reps: "best1RmKg",
  reps: "mostReps",
  duration: "longestS",
  distance_duration: "longestM",
  makes_attempts: "bestPct",
};

/** Records `next` beats in `prior` (a first-ever session sets no records). */
export function brokenRecords(
  prior: ExerciseRecordsDto | null,
  next: ExerciseRecordsDto,
): (keyof ExerciseRecordsDto)[] {
  if (!prior) return [];
  return (Object.keys(next) as (keyof ExerciseRecordsDto)[]).filter((k) => {
    const n = next[k];
    const p = prior[k];
    // A tiny margin keeps unit round-trips from counting as records.
    return n !== null && (p === null || n > p + 1e-6);
  });
}

export function mergeRecords(
  a: ExerciseRecordsDto | null,
  b: ExerciseRecordsDto,
): ExerciseRecordsDto {
  if (!a) return b;
  const out = { ...a };
  for (const k of Object.keys(b) as (keyof ExerciseRecordsDto)[]) out[k] = max([a[k], b[k]]);
  return out;
}

/** "185 lb × 5", "3.1 mi · 25:00", "8/10", "1:30" */
export function formatSet(
  tracking: ExerciseTracking,
  s: WorkoutSetDto,
  system: UnitSystem,
): string {
  const w =
    s.weightKg !== null ? `${toDisplayWeight(s.weightKg, system)} ${weightUnit(system)}` : null;
  const d =
    s.distanceM !== null
      ? `${toDisplayDistance(s.distanceM, system)} ${distanceUnit(system)}`
      : null;
  const t = s.durationS !== null ? formatDuration(s.durationS) : null;
  switch (tracking) {
    case "weight_reps":
      return [w ?? "—", s.reps ?? "—"].join(" × ");
    case "reps":
      return `${s.reps ?? "—"} reps`;
    case "duration":
      return t ?? "—";
    case "distance_duration":
      return [d, t].filter(Boolean).join(" · ") || "—";
    case "makes_attempts":
      return `${s.reps ?? "—"}/${s.attempts ?? "—"}`;
  }
}

/** The set that best represents a session: the headline record's set. */
export function bestSet(tracking: ExerciseTracking, sets: WorkoutSetDto[]): WorkoutSetDto | null {
  const done = sets.filter(isWork);
  if (!done.length) return null;
  const score = (s: WorkoutSetDto) => {
    switch (tracking) {
      case "weight_reps":
        return estimatedOneRm(s.weightKg ?? 0, s.reps ?? 0);
      case "reps":
        return s.reps ?? 0;
      case "duration":
        return s.durationS ?? 0;
      case "distance_duration":
        return s.distanceM ?? s.durationS ?? 0;
      case "makes_attempts":
        return s.attempts ? (s.reps ?? 0) / s.attempts : 0;
    }
  };
  return done.reduce((best, s) => (score(s) > score(best) ? s : best));
}

export const emptySet = (kind: SetKind = "normal"): WorkoutSetDto => ({
  kind,
  weightKg: null,
  reps: null,
  durationS: null,
  distanceM: null,
  attempts: null,
  done: false,
});

// Request bodies

const positive = (cap: number) => z.number().finite().min(0).max(cap).nullable().default(null);

export const workoutSetSchema = z.object({
  kind: z.enum(SET_KINDS).default("normal"),
  weightKg: positive(2000),
  reps: positive(10_000),
  durationS: positive(24 * 3600),
  distanceM: positive(1_000_000),
  attempts: positive(10_000),
  done: z.boolean().default(false),
});

export const workoutExerciseSchema = z.object({
  exerciseId: z.string().min(1).max(64),
  notes: z.string().max(500).default(""),
  sets: z.array(workoutSetSchema).max(MAX_SETS_PER_EXERCISE).default([]),
});

const exercisesSchema = z.array(workoutExerciseSchema).max(MAX_WORKOUT_EXERCISES);
const dateSchema = z.string().refine(isValidDate, "Use a valid YYYY-MM-DD date");

export const startWorkoutBodySchema = z.object({
  templateId: z.uuid().optional(),
  name: z.string().trim().min(1).max(80).optional(),
});

export const updateWorkoutBodySchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    notes: z.string().max(MAX_WORKOUT_NOTES),
    exercises: exercisesSchema,
    /** Completed workouts only: move it to another day. */
    localDate: dateSchema,
    /** Completed workouts only: how long it took. */
    durationS: z
      .number()
      .int()
      .min(60)
      .max(24 * 3600),
  })
  .partial();

export const finishWorkoutBodySchema = z.object({
  /** Overwrite the template it started from with what was done. */
  updateTemplate: z.boolean().default(false),
});

export const templateBodySchema = z.object({
  name: z.string().trim().min(1).max(80),
  notes: z.string().max(MAX_WORKOUT_NOTES).default(""),
  exercises: exercisesSchema.default([]),
});

/** Updates without defaults, so a missing field keeps its saved value. */
export const updateTemplateBodySchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    notes: z.string().max(MAX_WORKOUT_NOTES),
    exercises: exercisesSchema,
  })
  .partial();

export const createTemplateBodySchema = z.union([
  z.object({ fromWorkoutId: z.uuid(), name: z.string().trim().min(1).max(80).optional() }),
  templateBodySchema,
]);

export const exerciseBodySchema = z.object({
  name: z.string().trim().min(1).max(60),
  category: z.enum(EXERCISE_CATEGORIES),
  tracking: z.enum(EXERCISE_TRACKING),
});

/** A record in display units, as a plain number for charts (time in minutes). */
export function recordChartValue(
  key: keyof ExerciseRecordsDto,
  value: number,
  system: UnitSystem,
): number {
  if (key === "heaviestKg" || key === "best1RmKg" || key === "bestSetVolumeKg") {
    return toDisplayWeight(value, system);
  }
  if (key === "longestM") return toDisplayDistance(value, system);
  if (key === "longestS") return Math.round(value / 6) / 10;
  return Math.round(value * 10) / 10;
}

/** The unit recordChartValue returns. */
export function recordChartUnit(key: keyof ExerciseRecordsDto, system: UnitSystem): string {
  if (key === "heaviestKg" || key === "best1RmKg" || key === "bestSetVolumeKg") {
    return weightUnit(system);
  }
  if (key === "longestM") return distanceUnit(system);
  if (key === "longestS") return "min";
  if (key === "bestPct") return "%";
  return "reps";
}
