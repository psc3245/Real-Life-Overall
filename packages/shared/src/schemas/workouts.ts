import { z } from "zod";
import { boxScoreSchema, type BoxScoreDto } from "./box-score";
import { isValidDate } from "../dates";
import {
  EXERCISE_CATEGORIES,
  EXERCISE_STATS,
  isValidStatLine,
  SPORTS,
  STAT_PRESETS,
  STAT_PRESET_KEYS,
  usesLength,
  type ExerciseCategory,
  type ExerciseStat,
  type SetField,
  type Sport,
  type StatPreset,
} from "../exercises";
import {
  defaultHeadline,
  LOWER_WINS,
  RECORD_KEYS,
  trackedRecords,
  type ExerciseRecordsDto,
  type RecordKey,
} from "../records";
import {
  distanceUnit,
  formatDuration,
  fromDisplayDistance,
  fromDisplayHeight,
  fromDisplayLength,
  fromDisplayWeight,
  heightUnit,
  parseDuration,
  lengthUnit,
  toDisplayDistance,
  toDisplayHeight,
  toDisplayLength,
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

/**
 * Strength workouts and sport practices are logged set by set (practices start from sport
 * templates and drills); cardio sessions are one activity's distance and time.
 */
export const WORKOUT_KINDS = ["strength", "cardio", "sport"] as const;
export type WorkoutKind = (typeof WORKOUT_KINDS)[number];

/** The kinds that run live and have templates. */
export const LIVE_WORKOUT_KINDS = ["strength", "sport"] as const;
export type LiveWorkoutKind = (typeof LIVE_WORKOUT_KINDS)[number];

export const MAX_WORKOUT_EXERCISES = 40;
export const MAX_SETS_PER_EXERCISE = 30;
export const MAX_WORKOUT_NOTES = 2000;
export const MIN_REST_S = 15;
export const MAX_REST_S = 600;

export interface WorkoutSetDto {
  kind: SetKind;
  weightKg: number | null;
  /** Reps, or makes for makes/attempts. */
  reps: number | null;
  durationS: number | null;
  distanceM: number | null;
  attempts: number | null;
  /** Grade, %. Optional: sets saved before the stat line don't have the newer fields. */
  inclinePct?: number | null;
  heightCm?: number | null;
  /** Machine level or resistance. */
  level?: number | null;
  /** Rate of perceived exertion, 1-10. */
  rpe?: number | null;
  done: boolean;
}

/** The set property each column reads and writes. */
export const SET_FIELD_KEYS: Record<SetField, keyof WorkoutSetDto> = {
  weight: "weightKg",
  reps: "reps",
  duration: "durationS",
  distance: "distanceM",
  length: "distanceM",
  attempts: "attempts",
  incline: "inclinePct",
  height: "heightCm",
  level: "level",
  rpe: "rpe",
};

/** A set table's column header ("lb", "Reps", "Att.", "Inc. %"). */
export function setFieldHeader(field: SetField, system: UnitSystem, makes: boolean): string {
  switch (field) {
    case "weight":
      return weightUnit(system);
    case "reps":
      return makes ? "Makes" : "Reps";
    case "duration":
      return "Time";
    case "distance":
      return distanceUnit(system);
    case "length":
      return lengthUnit(system);
    case "attempts":
      return "Att.";
    case "incline":
      return "Inc. %";
    case "height":
      return heightUnit(system);
    case "level":
      return "Level";
    case "rpe":
      return "RPE";
  }
}

/** Stored value (kg, m, cm, s or a count) → the text shown in a set cell. */
export function displaySetValue(field: SetField, value: number | null, system: UnitSystem): string {
  if (value === null) return "";
  switch (field) {
    case "weight":
      return String(toDisplayWeight(value, system));
    case "distance":
      return String(toDisplayDistance(value, system));
    case "length":
      return String(toDisplayLength(value, system));
    case "height":
      return String(toDisplayHeight(value, system));
    case "duration":
      return formatDuration(value, true);
    default:
      return String(value);
  }
}

/** Set cell text → stored value; null when empty, undefined when it doesn't parse. */
export function parseSetValue(
  field: SetField,
  text: string,
  system: UnitSystem,
): number | null | undefined {
  const t = text.trim();
  if (!t) return null;
  if (field === "duration") return parseDuration(t) ?? undefined;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0) return undefined;
  switch (field) {
    case "weight":
      return fromDisplayWeight(n, system);
    case "distance":
      return fromDisplayDistance(n, system);
    case "length":
      return fromDisplayLength(n, system);
    case "height":
      return fromDisplayHeight(n, system);
    case "incline":
      return Math.round(n * 10) / 10;
    case "rpe":
      return n > 10 ? undefined : Math.round(n * 2) / 2;
    case "level":
      return Math.round(n * 2) / 2;
    default:
      return Math.round(n);
  }
}

/** What scoring and formatting need from an exercise: its stat line and headline record. */
export interface StatLine {
  stats: readonly ExerciseStat[];
  headline: RecordKey;
}

/** A preset's stat line with its default headline. */
export const presetLine = (preset: StatPreset): StatLine => ({
  stats: STAT_PRESETS[preset],
  headline: defaultHeadline(STAT_PRESETS[preset]),
});

export interface WorkoutExerciseDto {
  /** A catalog slug or a custom exercise's uuid. */
  exerciseId: string;
  notes: string;
  sets: WorkoutSetDto[];
  /** Rest countdown after checking off a set, in seconds; null (or missing on older rows) is off. */
  restS?: number | null;
}

export interface ExerciseDto {
  id: string;
  name: string;
  category: ExerciseCategory;
  /** The stat line: what each set records, in column order. */
  stats: ExerciseStat[];
  /** The record it's scored by. */
  headline: RecordKey;
  /** Sport & skill drills' sport; null otherwise. */
  sport: Sport | null;
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
  /** Missing from older API responses means "strength". */
  kind: WorkoutKind;
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
  /** Heart rate, calories and effort from the box score (or a cardio session); null if skipped. */
  boxScore: BoxScoreDto | null;
}

export interface WorkoutTemplateDto {
  id: string;
  /** Missing from older API responses means "strength". */
  kind: LiveWorkoutKind;
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
  kind: WorkoutKind;
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

const positives = (values: (number | null | undefined)[]) =>
  values.filter((v): v is number => typeof v === "number" && v > 0);
const max = (values: (number | null | undefined)[]) => {
  const nums = positives(values);
  return nums.length ? Math.max(...nums) : null;
};
const min = (values: (number | null | undefined)[]) => {
  const nums = positives(values);
  return nums.length ? Math.min(...nums) : null;
};

/** A set's value for a record (higher is better unless LOWER_WINS); null if it has none. */
export function setRecordValue(key: RecordKey, s: WorkoutSetDto): number | null {
  const pos = (v: number | null | undefined) => (typeof v === "number" && v > 0 ? v : null);
  switch (key) {
    case "best1RmKg":
      return pos(estimatedOneRm(s.weightKg ?? 0, s.reps ?? 0));
    case "bestPct":
      return s.attempts && s.reps !== null ? (100 * s.reps) / s.attempts : null;
    case "heaviestKg":
      return pos(s.weightKg);
    case "bestSetVolumeKg":
      return pos(setVolume(s));
    case "mostReps":
      return pos(s.reps);
    case "longestM":
      return pos(s.distanceM);
    case "longestS":
    case "fastestS":
      return pos(s.durationS);
    case "steepestPct":
      return pos(s.inclinePct);
    case "highestCm":
      return pos(s.heightCm);
    case "highestLevel":
      return pos(s.level);
  }
}

const emptyRecords = (): ExerciseRecordsDto =>
  Object.fromEntries(RECORD_KEYS.map((k) => [k, null])) as ExerciseRecordsDto;

/** Bests over done sets. Make percentages count with at least 5 attempts. */
export function recordsFromSets(line: StatLine, sets: WorkoutSetDto[]): ExerciseRecordsDto {
  const done = sets.filter(isWork);
  const out = emptyRecords();
  for (const k of trackedRecords(line.stats, line.headline)) {
    const pool = k === "bestPct" ? done.filter((s) => (s.attempts ?? 0) >= 5) : done;
    const values = pool.map((s) => setRecordValue(k, s));
    out[k] = LOWER_WINS.has(k) ? min(values) : max(values);
  }
  return out;
}

/** Records `next` beats in `prior` (a first-ever session sets no records). */
export function brokenRecords(
  prior: ExerciseRecordsDto | null,
  next: ExerciseRecordsDto,
): RecordKey[] {
  if (!prior) return [];
  return RECORD_KEYS.filter((k) => {
    const n = next[k];
    const p = prior[k] ?? null;
    if (n === null) return false;
    if (p === null) return true;
    // A tiny margin keeps unit round-trips from counting as records.
    return LOWER_WINS.has(k) ? n < p - 1e-6 : n > p + 1e-6;
  });
}

export function mergeRecords(
  a: ExerciseRecordsDto | null,
  b: ExerciseRecordsDto,
): ExerciseRecordsDto {
  if (!a) return b;
  const out = { ...a };
  for (const k of RECORD_KEYS) {
    out[k] = LOWER_WINS.has(k) ? min([a[k], b[k]]) : max([a[k], b[k]]);
  }
  return out;
}

const statText = (stat: ExerciseStat, s: WorkoutSetDto, system: UnitSystem): string | null => {
  switch (stat) {
    case "weight":
      return s.weightKg != null
        ? `${toDisplayWeight(s.weightKg, system)} ${weightUnit(system)}`
        : null;
    case "reps":
      return s.reps != null ? `${s.reps} reps` : null;
    case "makes":
      return `${s.reps ?? "—"}/${s.attempts ?? "—"}`;
    case "duration":
      return s.durationS != null ? formatDuration(s.durationS, true) : null;
    case "distance":
      return s.distanceM != null
        ? `${toDisplayDistance(s.distanceM, system)} ${distanceUnit(system)}`
        : null;
    case "length":
      return s.distanceM != null
        ? `${toDisplayLength(s.distanceM, system)} ${lengthUnit(system)}`
        : null;
    case "incline":
      return s.inclinePct != null ? `${s.inclinePct}% incline` : null;
    case "height":
      return s.heightCm != null
        ? `${toDisplayHeight(s.heightCm, system)} ${heightUnit(system)}`
        : null;
    case "level":
      return s.level != null ? `level ${s.level}` : null;
    case "rpe":
      return s.rpe != null ? `RPE ${s.rpe}` : null;
  }
};

/** "185 lb × 5", "3.1 mi · 25:00", "8/10", "90 lb · 120 ft · 0:50 · 5% incline" */
export function formatSet(
  line: Pick<StatLine, "stats">,
  s: WorkoutSetDto,
  system: UnitSystem,
): string {
  const { stats } = line;
  const lift = stats.includes("weight") && stats.includes("reps");
  const parts = stats.flatMap((stat) => {
    if (lift && stat === "weight") {
      const w =
        s.weightKg != null ? `${toDisplayWeight(s.weightKg, system)} ${weightUnit(system)}` : "—";
      return [`${w} × ${s.reps ?? "—"}`];
    }
    if (lift && stat === "reps") return [];
    if (stat === "reps" && stats.length === 1) return [`${s.reps ?? "—"} reps`];
    return [statText(stat, s, system)];
  });
  return parts.filter(Boolean).join(" · ") || "—";
}

/**
 * The set that best represents a session: the best by the headline record, ties broken by the
 * stat line's stats in order (the heaviest carry, then the longest at that weight).
 */
export function bestSet(line: StatLine, sets: WorkoutSetDto[]): WorkoutSetDto | null {
  const done = sets.filter(isWork);
  if (!done.length) return null;
  const fields = line.stats.map((st) => SET_FIELD_KEYS[st === "makes" ? "reps" : st]);
  const score = (s: WorkoutSetDto): number[] => {
    const head = setRecordValue(line.headline, s);
    const h = head === null ? -Infinity : LOWER_WINS.has(line.headline) ? -head : head;
    return [h, ...fields.map((f) => Number(s[f] ?? 0))];
  };
  const better = (a: number[], b: number[]) => {
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i]! > b[i]!;
    return false;
  };
  return done.reduce((best, s) => (better(score(s), score(best)) ? s : best));
}

export const emptySet = (kind: SetKind = "normal"): WorkoutSetDto => ({
  kind,
  weightKg: null,
  reps: null,
  durationS: null,
  distanceM: null,
  attempts: null,
  inclinePct: null,
  heightCm: null,
  level: null,
  rpe: null,
  done: false,
});

/** How a workout differs from the template it started from. */
export type TemplateChange = "none" | "values" | "structure";

const SET_VALUES = [
  "kind",
  "weightKg",
  "reps",
  "durationS",
  "distanceM",
  "attempts",
  "inclinePct",
  "heightCm",
  "level",
  "rpe",
] as const;

/**
 * "structure" when exercises were added, removed or reordered or an exercise's set count changed;
 * "values" when only the numbers (or set kinds) in its sets did; otherwise "none".
 */
export function templateChange(
  plan: WorkoutExerciseDto[],
  exercises: WorkoutExerciseDto[],
): TemplateChange {
  if (
    plan.length !== exercises.length ||
    plan.some(
      (e, i) =>
        e.exerciseId !== exercises[i]!.exerciseId || e.sets.length !== exercises[i]!.sets.length,
    )
  ) {
    return "structure";
  }
  const changed = plan.some((e, i) =>
    e.sets.some((s, j) =>
      SET_VALUES.some((k) => (s[k] ?? null) !== (exercises[i]!.sets[j]![k] ?? null)),
    ),
  );
  return changed ? "values" : "none";
}

/**
 * The template with the numbers from the workout's checked-off sets copied into it, keeping its
 * own exercises, order and set counts. Exercises match by id (the nth of an id to the nth) and
 * sets by position; a template set with no done match keeps its numbers.
 */
export function withTemplateValues(
  plan: WorkoutExerciseDto[],
  exercises: WorkoutExerciseDto[],
): WorkoutExerciseDto[] {
  const seen = new Map<string, number>();
  return plan.map((e) => {
    const nth = seen.get(e.exerciseId) ?? 0;
    seen.set(e.exerciseId, nth + 1);
    const match = exercises.filter((w) => w.exerciseId === e.exerciseId)[nth];
    if (!match) return e;
    return {
      ...e,
      sets: e.sets.map((s, j) => {
        const done = match.sets[j];
        if (!done?.done) return s;
        return { ...s, ...Object.fromEntries(SET_VALUES.map((k) => [k, done[k]])) };
      }),
    };
  });
}

// Request bodies

const positive = (cap: number) => z.number().finite().min(0).max(cap).nullable().default(null);

export const workoutSetSchema = z.object({
  kind: z.enum(SET_KINDS).default("normal"),
  weightKg: positive(2000),
  reps: positive(10_000),
  durationS: positive(24 * 3600),
  distanceM: positive(1_000_000),
  attempts: positive(10_000),
  inclinePct: positive(100),
  heightCm: positive(500),
  level: positive(1000),
  rpe: positive(10),
  done: z.boolean().default(false),
});

export const workoutExerciseSchema = z.object({
  exerciseId: z.string().min(1).max(64),
  notes: z.string().max(500).default(""),
  sets: z.array(workoutSetSchema).max(MAX_SETS_PER_EXERCISE).default([]),
  restS: z.number().int().min(MIN_REST_S).max(MAX_REST_S).nullable().default(null),
});

const exercisesSchema = z.array(workoutExerciseSchema).max(MAX_WORKOUT_EXERCISES);
const dateSchema = z.string().refine(isValidDate, "Use a valid YYYY-MM-DD date");

/** A finished workout recorded in one go (a coach draft the player saves). */
export const logWorkoutBodySchema = z.object({
  name: z.string().trim().min(1).max(80),
  notes: z.string().max(MAX_WORKOUT_NOTES).default(""),
  localDate: dateSchema,
  durationS: z.number().int().min(60).max(86_400),
  exercises: exercisesSchema.min(1),
});

export const startWorkoutBodySchema = z.object({
  templateId: z.uuid().optional(),
  /** Without a template; a template's own kind wins. */
  kind: z.enum(LIVE_WORKOUT_KINDS).optional(),
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
    /** Completed workouts only: fix the box score. */
    boxScore: boxScoreSchema,
  })
  .partial();

/**
 * What finishing does to templates: "values" copies the numbers into the template's existing
 * sets, "overwrite" replaces the template with what was done, "new" saves what was done as a new
 * template.
 */
export const TEMPLATE_ACTIONS = ["none", "values", "overwrite", "new"] as const;
export type TemplateAction = (typeof TEMPLATE_ACTIONS)[number];

export interface TemplateOption {
  value: TemplateAction;
  label: string;
  detail: string;
}

/**
 * The template choices offered when finishing, "none" first: save-as-new for a workout with no
 * template; for one with a template, only what fits how far today strayed from it.
 */
export function finishTemplateOptions(
  templateName: string | null,
  change: TemplateChange,
): TemplateOption[] {
  if (templateName === null) {
    return [
      { value: "none", label: "Don't save it", detail: "Just log today's workout." },
      { value: "new", label: "Save as a template", detail: "Start it again from your templates." },
    ];
  }
  if (change === "none") return [];
  const leave: TemplateOption = {
    value: "none",
    label: `Leave "${templateName}" as is`,
    detail: "No changes to the template.",
  };
  const values: TemplateOption = {
    value: "values",
    label: "Update just the numbers",
    detail:
      change === "values"
        ? "Today's weights and reps go into its sets."
        : "Today's weights and reps go into its sets; its exercises and set counts stay.",
  };
  if (change === "values") return [leave, values];
  return [
    leave,
    values,
    {
      value: "overwrite",
      label: `Replace "${templateName}"`,
      detail: "With today's exercises, sets and numbers.",
    },
    {
      value: "new",
      label: "Save as a new template",
      detail: `Keeps "${templateName}" as is.`,
    },
  ];
}

export const finishWorkoutBodySchema = z.object({
  template: z.enum(TEMPLATE_ACTIONS).optional(),
  /** What the box score after the workout collected. */
  boxScore: boxScoreSchema.optional(),
  /** The new template's name ("new" only); defaults to the workout's. */
  templateName: z.string().trim().min(1).max(80).optional(),
  /** Older apps: true means "overwrite". */
  updateTemplate: z.boolean().default(false),
});

export const templateBodySchema = z.object({
  kind: z.enum(LIVE_WORKOUT_KINDS).default("strength"),
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

const statsSchema = z
  .array(z.enum(EXERCISE_STATS))
  .refine(isValidStatLine, "Pick 1-4 stats, without both reps and makes or two distances");

/**
 * Creating a custom exercise. Older apps send a preset `tracking` instead of `stats`; the
 * headline defaults to the stat line's first record.
 */
export const exerciseBodySchema = z
  .object({
    name: z.string().trim().min(1).max(60),
    category: z.enum(EXERCISE_CATEGORIES),
    stats: statsSchema.optional(),
    tracking: z.enum(STAT_PRESET_KEYS as [string, ...string[]]).optional(),
    headline: z.enum(RECORD_KEYS).optional(),
    sport: z.enum(SPORTS).nullable().default(null),
  })
  .transform(({ tracking, ...rest }) => ({
    ...rest,
    stats:
      rest.stats ??
      (tracking ? [...STAT_PRESETS[tracking as keyof typeof STAT_PRESETS]] : undefined),
  }))
  .refine((b) => b.stats !== undefined, { message: "Pick what each set records", path: ["stats"] })
  .refine((b) => !b.headline || trackedRecords(b.stats!, b.headline).includes(b.headline), {
    message: "That record doesn't fit these stats",
    path: ["headline"],
  });

/** Editing a custom exercise; a missing field keeps its saved value. */
export const updateExerciseBodySchema = z
  .object({
    name: z.string().trim().min(1).max(60),
    category: z.enum(EXERCISE_CATEGORIES),
    stats: statsSchema,
    headline: z.enum(RECORD_KEYS),
    sport: z.enum(SPORTS).nullable(),
  })
  .partial();

/**
 * A record in display units, as a plain number for charts (time in minutes, fastest times in
 * seconds). Pass the stat line so short distances come out in feet or meters.
 */
export function recordChartValue(
  key: RecordKey,
  value: number,
  system: UnitSystem,
  stats?: readonly ExerciseStat[],
): number {
  if (key === "heaviestKg" || key === "best1RmKg" || key === "bestSetVolumeKg") {
    return toDisplayWeight(value, system);
  }
  if (key === "longestM") {
    return stats && usesLength(stats)
      ? toDisplayLength(value, system)
      : toDisplayDistance(value, system);
  }
  if (key === "longestS") return Math.round(value / 6) / 10;
  if (key === "highestCm") return toDisplayHeight(value, system);
  return Math.round(value * 10) / 10;
}

/** The unit recordChartValue returns. */
export function recordChartUnit(
  key: RecordKey,
  system: UnitSystem,
  stats?: readonly ExerciseStat[],
): string {
  switch (key) {
    case "heaviestKg":
    case "best1RmKg":
    case "bestSetVolumeKg":
      return weightUnit(system);
    case "longestM":
      return stats && usesLength(stats) ? lengthUnit(system) : distanceUnit(system);
    case "longestS":
      return "min";
    case "fastestS":
      return "s";
    case "bestPct":
    case "steepestPct":
      return "%";
    case "highestCm":
      return heightUnit(system);
    case "highestLevel":
      return "level";
    case "mostReps":
      return "reps";
  }
}
