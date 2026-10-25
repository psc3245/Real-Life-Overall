import { z } from "zod";
import { addDays, daysBetween, isValidDate } from "../dates";
import {
  isHabitDone,
  MAX_HABIT_LINKS,
  type HabitConfig,
  type HabitEntryValue,
  type HabitType,
} from "./habits";

/**
 * Goals: a target total to reach by a deadline ("Run 100 miles before New Year's", "Gym 3 times
 * this week"). Called objectives in code so they don't clash with goal ratings (Potential).
 *
 * Progress comes from what the user logs each day on the goal itself (manual) or from a habit's
 * entries inside the goal's window.
 */
export const OBJECTIVE_SOURCES = ["manual", "habit"] as const;
export type ObjectiveSource = (typeof OBJECTIVE_SOURCES)[number];
export const OBJECTIVE_SOURCE_LABELS: Record<ObjectiveSource, string> = {
  manual: "Log progress on the goal",
  habit: "Count a habit",
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
  /** Total inside the window so far. */
  current: number;
  /** 0-100, capped. */
  pct: number;
  status: ObjectiveStatus;
  /** The day the running total first reached the target. */
  completedOn: string | null;
  /** Days from today to the deadline (0 = due today, negative = past). */
  daysLeft: number;
  /** Where an even pace would have the total by the start of today. */
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
  if (type === "counter" || type === "duration") return Math.max(0, entry.num ?? 0);
  return isHabitDone(type, config, entry) ? 1 : 0;
}

/** The unit a habit-sourced goal counts in. */
export function habitObjectiveUnit(type: HabitType, config: HabitConfig): string {
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

export interface ObjectiveDto {
  id: string;
  name: string;
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
  /** source "manual": the amount logged on this day, if any. */
  logged: number | null;
  /** What this day added, from either source. */
  dayAmount: number;
}

// Request bodies

const dateSchema = z.string().refine(isValidDate, "Use a valid YYYY-MM-DD date");
const targetSchema = z.number().finite().positive().max(MAX_OBJECTIVE_TARGET);

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
    target: targetSchema,
    /** Ignored for habit goals (they count in the habit's unit). */
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
  });

export const updateObjectiveBodySchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    target: targetSchema,
    unit: z.string().trim().max(20),
    startsOn: dateSchema,
    endsOn: dateSchema,
    links: z.array(z.uuid()).max(MAX_HABIT_LINKS),
  })
  .partial()
  .refine(validWindow, windowMessage);

export const saveObjectiveEntryBodySchema = z.object({
  /** null (or 0) clears the day's amount. */
  value: z.number().finite().min(0).max(MAX_OBJECTIVE_TARGET).nullable(),
});
