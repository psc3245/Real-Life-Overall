import { z } from "zod";
import { addDays, daysBetween, isValidDate } from "../dates";
import {
  isAvoid,
  isHabitDone,
  MAX_HABIT_LINKS,
  type HabitConfig,
  type HabitEntryValue,
  type HabitType,
} from "./habits";

/**
 * Goals with a deadline. Called objectives in code so they don't clash with goal ratings
 * (Potential). Two kinds:
 * - total: a target total to add up to ("Run 100 miles before New Year's", "Gym 3 times this
 *   week"), from what the user logs on the goal itself (manual), a habit's entries, or completed
 *   workouts inside the window.
 * - reach: get a number from where it starts to a target, up or down ("200 lb to 185 lb by
 *   June", "Pay the card down to 0"), from readings logged on the goal or the user's body weight.
 */
export const OBJECTIVE_KINDS = ["total", "reach"] as const;
export type ObjectiveKind = (typeof OBJECTIVE_KINDS)[number];
export const OBJECTIVE_KIND_LABELS: Record<ObjectiveKind, string> = {
  total: "Add up to a total",
  reach: "Reach a number",
};
export const OBJECTIVE_KIND_HINTS: Record<ObjectiveKind, string> = {
  total: "Run 100 miles, go to the gym 12 times.",
  reach: "Go from 200 lb down to 185, or a 5K time from 30 minutes to 25.",
};

export const OBJECTIVE_SOURCES = ["manual", "habit", "workouts", "weight"] as const;
export type ObjectiveSource = (typeof OBJECTIVE_SOURCES)[number];
export const OBJECTIVE_SOURCE_LABELS: Record<ObjectiveSource, string> = {
  manual: "Log progress on the goal",
  habit: "Count a habit",
  workouts: "Count workouts",
  weight: "Follow my logged weight",
};
/** Where each kind's progress can come from. */
export const KIND_SOURCES: Record<ObjectiveKind, readonly ObjectiveSource[]> = {
  total: ["manual", "habit", "workouts"],
  reach: ["manual", "weight"],
};

/** Goals spanning up to this many days are short term; longer ones are long term. */
export const SHORT_TERM_MAX_DAYS = 31;
/** The longest window a goal may span. */
export const MAX_OBJECTIVE_DAYS = 3 * 366;
export const MAX_OBJECTIVE_TARGET = 10_000_000;

export type ObjectiveTerm = "short" | "long";
export const OBJECTIVE_TERM_LABELS: Record<ObjectiveTerm, string> = {
  short: "Short term",
  long: "Long term",
};

/** Days in a goal's window, both ends included. */
export function objectiveLength(startsOn: string, endsOn: string): number {
  return daysBetween(startsOn, endsOn) + 1;
}

export function objectiveTerm(startsOn: string, endsOn: string): ObjectiveTerm {
  return objectiveLength(startsOn, endsOn) <= SHORT_TERM_MAX_DAYS ? "short" : "long";
}

/** upcoming: starts later. active: in its window. completed: target reached. missed: deadline passed. */
export type ObjectiveStatus = "upcoming" | "active" | "completed" | "missed";

export interface ObjectiveProgressDto {
  /** Total inside the window so far; for reach goals, the latest reading (or the start). */
  current: number;
  /** 0-100, capped. */
  pct: number;
  status: ObjectiveStatus;
  /** The day the running total first reached the target. */
  completedOn: string | null;
  /** Days from today to the deadline (0 = due today, negative = past). */
  daysLeft: number;
  /** Where an even pace would have `current` by the start of today. */
  expected: number;
  /** At or ahead of an even pace (always true once completed). */
  onPace: boolean;
}

/** How much one habit entry adds to a goal: amounts for counts and time, otherwise done days. */
export function habitContribution(
  type: HabitType,
  config: HabitConfig,
  entry: HabitEntryValue,
): number {
  // Avoid habits count kept days, not amounts.
  if (!isAvoid(config) && (type === "counter" || type === "duration")) {
    return Math.max(0, entry.num ?? 0);
  }
  return isHabitDone(type, config, entry) ? 1 : 0;
}

/** The unit a habit-sourced goal counts in. */
export function habitObjectiveUnit(type: HabitType, config: HabitConfig): string {
  if (isAvoid(config)) return "days";
  if (type === "counter") return config.unit ?? "times";
  if (type === "duration") return "min";
  return "days";
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Progress from per-day amounts (dates outside the window are ignored). */
export function objectiveProgress(
  goal: { target: number; startsOn: string; endsOn: string },
  daily: Map<string, number>,
  today: string,
): ObjectiveProgressDto {
  const dates = [...daily.keys()].filter((d) => d >= goal.startsOn && d <= goal.endsOn).sort();
  let current = 0;
  let completedOn: string | null = null;
  for (const date of dates) {
    current += daily.get(date) ?? 0;
    if (completedOn === null && current >= goal.target) completedOn = date;
  }
  current = round2(current);
  const total = objectiveLength(goal.startsOn, goal.endsOn);
  // Days fully behind us inside the window (today is still in play).
  const before = Math.min(total, Math.max(0, daysBetween(goal.startsOn, today)));
  const expected = round2((goal.target * before) / total);
  const status: ObjectiveStatus = completedOn
    ? "completed"
    : today < goal.startsOn
      ? "upcoming"
      : today > goal.endsOn
        ? "missed"
        : "active";
  return {
    current,
    pct: Math.min(100, goal.target > 0 ? (100 * current) / goal.target : 0),
    status,
    completedOn,
    daysLeft: daysBetween(today, goal.endsOn),
    expected,
    onPace: completedOn !== null || current >= expected,
  };
}

/**
 * Progress for a reach goal from dated readings: where the latest one in the window (or the
 * start) sits between the start and the target, going either way. Reaching the target once
 * completes it.
 */
export function reachProgress(
  goal: { target: number; startValue: number; startsOn: string; endsOn: string },
  readings: Map<string, number>,
  today: string,
): ObjectiveProgressDto {
  const span = goal.target - goal.startValue;
  const up = span > 0;
  const dates = [...readings.keys()].filter((d) => d >= goal.startsOn && d <= goal.endsOn).sort();
  let current = goal.startValue;
  let completedOn: string | null = null;
  for (const date of dates) {
    current = readings.get(date)!;
    if (completedOn === null && (up ? current >= goal.target : current <= goal.target)) {
      completedOn = date;
    }
  }
  const total = objectiveLength(goal.startsOn, goal.endsOn);
  const before = Math.min(total, Math.max(0, daysBetween(goal.startsOn, today)));
  const expected = round2(goal.startValue + (span * before) / total);
  return {
    current: round2(current),
    pct: span === 0 ? 0 : Math.min(100, Math.max(0, (100 * (current - goal.startValue)) / span)),
    status: completedOn
      ? "completed"
      : today < goal.startsOn
        ? "upcoming"
        : today > goal.endsOn
          ? "missed"
          : "active",
    completedOn,
    daysLeft: daysBetween(today, goal.endsOn),
    expected,
    onPace: completedOn !== null || (up ? current >= expected : current <= expected),
  };
}

/** Where an even pace puts the goal today, 0-100 along the bar. */
export function objectivePacePct(o: ObjectiveDto): number {
  const from = o.startValue ?? 0;
  const span = o.target - from;
  if (span === 0) return 0;
  return Math.min(100, Math.max(0, (100 * (o.progress.expected - from)) / span));
}

export interface ObjectiveDto {
  id: string;
  name: string;
  kind: ObjectiveKind;
  /** reach only: where it started. */
  startValue: number | null;
  /** What the target counts, e.g. "miles", "sessions". */
  unit: string;
  target: number;
  startsOn: string;
  /** The deadline, inclusive. */
  endsOn: string;
  term: ObjectiveTerm;
  source: ObjectiveSource;
  /** source "habit": the habit whose entries count. */
  habitId: string | null;
  habitName: string | null;
  /** Rated attributes (current-season node ids) this goal builds. */
  links: string[];
  progress: ObjectiveProgressDto;
}

/** A goal on one day's log: what that day added. */
export interface DayObjectiveDto {
  objective: ObjectiveDto;
  /** source "manual": the amount (or reading) logged on this day, if any. */
  logged: number | null;
  /** What this day added, from any source; for reach goals, that day's reading (0 for none). */
  dayAmount: number;
}

// Request bodies

const dateSchema = z.string().refine(isValidDate, "Use a valid YYYY-MM-DD date");
// Reach goals may aim for 0 ("pay it off"); totals need a positive target (checked below).
const targetSchema = z.number().finite().min(0).max(MAX_OBJECTIVE_TARGET);

function validWindow(v: { startsOn?: string; endsOn?: string }) {
  if (!v.startsOn || !v.endsOn) return true;
  return v.endsOn >= v.startsOn && v.endsOn <= addDays(v.startsOn, MAX_OBJECTIVE_DAYS - 1);
}
const windowMessage = {
  message: "The deadline must be on or after the start, and within 3 years",
  path: ["endsOn"],
};

export const createObjectiveBodySchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    kind: z.enum(OBJECTIVE_KINDS).default("total"),
    target: targetSchema,
    /** reach only: where it starts. Weight goals default to the latest logged weight. */
    startValue: targetSchema.optional(),
    /** Ignored for habit and weight goals (they count in the habit's or the body's unit). */
    unit: z.string().trim().max(20).default(""),
    /** Defaults to the user's today. */
    startsOn: dateSchema.optional(),
    endsOn: dateSchema,
    source: z.enum(OBJECTIVE_SOURCES).default("manual"),
    habitId: z.uuid().optional(),
    links: z.array(z.uuid()).max(MAX_HABIT_LINKS).default([]),
  })
  .refine(validWindow, windowMessage)
  .refine((v) => v.source !== "habit" || v.habitId, {
    message: "Pick the habit this goal counts",
    path: ["habitId"],
  })
  .refine((v) => KIND_SOURCES[v.kind].includes(v.source), {
    message: "That goal can't count that",
    path: ["source"],
  })
  .refine((v) => v.kind !== "total" || v.target > 0, {
    message: "Aim for more than 0",
    path: ["target"],
  })
  .refine((v) => v.kind !== "reach" || v.startValue !== undefined || v.source === "weight", {
    message: "Where are you starting from?",
    path: ["startValue"],
  })
  .refine((v) => v.kind !== "reach" || v.startValue !== v.target, {
    message: "The target has to differ from the start",
    path: ["target"],
  });

export const updateObjectiveBodySchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    target: targetSchema,
    startValue: targetSchema,
    unit: z.string().trim().max(20),
    startsOn: dateSchema,
    endsOn: dateSchema,
    links: z.array(z.uuid()).max(MAX_HABIT_LINKS),
  })
  .partial()
  .refine(validWindow, windowMessage);

export const saveObjectiveEntryBodySchema = z.object({
  /** null clears the day's amount; so does 0 on a total goal (a reach goal's reading can be 0). */
  value: z.number().finite().min(0).max(MAX_OBJECTIVE_TARGET).nullable(),
});
