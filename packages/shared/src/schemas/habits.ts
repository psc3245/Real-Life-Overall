import { z } from "zod";
import { DATE_PATTERN, isValidDate } from "../dates";
import type { UnitSystem } from "../units";
import type { DayBodyDto } from "./body";
import type { DayObjectiveDto } from "./objectives";
import type { DayWorkoutDto } from "./workouts";
import type { GuidedPromptDto, RecapDto } from "./recaps";

export const HABIT_TYPES = [
  "checkbox",
  "checknote",
  "counter",
  "duration",
  "time",
  "slider",
  "rating",
  "shorttext",
  "journal",
  "group",
] as const;
export type HabitType = (typeof HABIT_TYPES)[number];

/**
 * A group holds sub-habits and is done by a rule over them. It has no entries of its own, its
 * sub-habits share its schedule, and links go on the sub-habits. Groups don't nest (yet).
 */
export const GROUP_RULES = ["all", "any", "count"] as const;
export type GroupRule = (typeof GROUP_RULES)[number];
export const GROUP_RULE_LABELS: Record<GroupRule, string> = {
  all: "All done",
  any: "Any done",
  count: "At least N done",
};

export const HABIT_TYPE_LABELS: Record<HabitType, string> = {
  checkbox: "Done / not done",
  checknote: "Done + note",
  counter: "Count",
  duration: "Time spent",
  time: "Time of day",
  slider: "Scale",
  rating: "Stars",
  shorttext: "Short answer",
  journal: "Long entry",
  group: "Group of sub-habits",
};

/**
 * build: do it (done when the entry meets the goal). avoid: don't (DESIGN.md §7.6). An avoid
 * habit is kept on a day unless the entry crosses its line: checked as a slip, over its limit,
 * or a written slip for text types. A day with no entry counts as kept.
 */
export const HABIT_DIRECTIONS = ["build", "avoid"] as const;
export type HabitDirection = (typeof HABIT_DIRECTIONS)[number];
export const HABIT_DIRECTION_LABELS: Record<HabitDirection, string> = {
  build: "Build",
  avoid: "Avoid",
};

/**
 * How a build habit's entry meets its target: reach it, beat it, or stay under it. Missing on
 * older habits, which all meant "atLeast". For time-of-day habits, less is earlier.
 */
export const HABIT_COMPARES = ["atLeast", "moreThan", "atMost", "lessThan"] as const;
export type HabitCompare = (typeof HABIT_COMPARES)[number];
export const HABIT_COMPARE_LABELS: Record<HabitCompare, string> = {
  atLeast: "At least",
  moreThan: "More than",
  atMost: "At most",
  lessThan: "Less than",
};
export const TIME_COMPARE_LABELS: Record<HabitCompare, string> = {
  atLeast: "At or after",
  moreThan: "After",
  atMost: "By",
  lessThan: "Before",
};
/** How a goal reads after a slash: "6/8", "1800/≤2000". "At least" is implied. */
export const COMPARE_SYMBOLS: Record<HabitCompare, string> = {
  atLeast: "",
  moreThan: ">",
  atMost: "≤",
  lessThan: "<",
};

/** Types whose build goal is a number with a comparison. */
export const TARGETED_TYPES: readonly HabitType[] = [
  "counter",
  "duration",
  "slider",
  "rating",
  "time",
];
/** Types where the target is optional: without one, logging anything counts as done. */
export const OPTIONAL_TARGET_TYPES: readonly HabitType[] = ["slider", "rating", "time"];

export const MINUTES_PER_DAY = 1440;

/** "6:05 AM" from minutes after midnight. */
export function formatTimeOfDay(minutes: number): string {
  const m = ((Math.round(minutes) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const h = Math.floor(m / 60);
  return `${h % 12 || 12}:${String(m % 60).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

/** "06:05" (an <input type="time"> value) from minutes after midnight. */
export function timeInputValue(minutes: number): string {
  const m = ((Math.round(minutes) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/**
 * Minutes after midnight from "6:05", "06:05", "6:05 pm", "18:05" or "6pm"; null if unreadable.
 */
export function parseTimeOfDay(input: string): number | null {
  const match = input
    .trim()
    .toLowerCase()
    .match(/^(\d{1,2})(?::(\d{2}))?\s*(a|p|am|pm)?$/);
  if (!match) return null;
  let h = Number(match[1]);
  const m = Number(match[2] ?? 0);
  const half = match[3]?.[0];
  if (m > 59 || h > 23 || (half && (h < 1 || h > 12))) return null;
  if (half === "a" && h === 12) h = 0;
  if (half === "p" && h < 12) h += 12;
  return h * 60 + m;
}

/**
 * How far `minutes` is past `target` on the clock, from -720 to 720, so a time just after
 * midnight reads as later than a late-night target (bedtimes) rather than 23 hours earlier.
 */
export function clockOffset(minutes: number, target: number): number {
  const d = (((minutes - target) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  return d > MINUTES_PER_DAY / 2 ? d - MINUTES_PER_DAY : d;
}

/** The average time of day, measured around `anchor` so bedtimes either side of midnight work. */
export function averageTimeOfDay(values: number[], anchor = values[0] ?? 0): number | null {
  if (!values.length) return null;
  const mean = values.reduce((sum, v) => sum + clockOffset(v, anchor), 0) / values.length;
  return ((Math.round(anchor + mean) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
}

function meets(n: number, target: number, compare: HabitCompare): boolean {
  switch (compare) {
    case "moreThan":
      return n > target;
    case "atMost":
      return n <= target;
    case "lessThan":
      return n < target;
    default:
      return n >= target;
  }
}

export const MAX_HABIT_NOTE = 280;
export const MAX_HABIT_SHORT_TEXT = 200;
export const MAX_HABIT_JOURNAL = 5000;
/** Room for big daily counts like steps. */
export const MAX_HABIT_COUNT = 1_000_000;
export const MAX_DAY_JOURNAL = 10_000;
export const MAX_HABIT_LINKS = 4;
export const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

/** Type-specific settings. Fields that don't apply to a type are null. */
export interface HabitConfig {
  /**
   * counter: daily goal count; duration: daily goal minutes. For avoid habits it's the daily
   * limit instead (counter, duration, and the highest acceptable slider or star value).
   */
  target: number | null;
  /** counter only, e.g. "pages", "glasses". */
  unit: string | null;
  /** slider: scale bounds. rating: max stars (min is always 1). */
  min: number | null;
  max: number | null;
  /** group only: how sub-habits decide the group (with `target` as N for "count"). */
  rule?: GroupRule | null;
  /** Missing on older habits, which are all "build". Groups have none. */
  direction?: HabitDirection | null;
  /** Build habits with a target (TARGETED_TYPES): how an entry meets it. */
  compare?: HabitCompare | null;
}

export const isAvoid = (config: HabitConfig) => config.direction === "avoid";

// No per-field defaults: on update, a missing key must mean "keep the current value".
const optionalNumber = z.number().finite().nullable().optional();
export const habitConfigInputSchema = z
  .object({
    target: optionalNumber,
    unit: z.string().trim().max(20).nullable().optional(),
    min: optionalNumber,
    max: optionalNumber,
    rule: z.enum(GROUP_RULES).nullable().optional(),
    direction: z.enum(HABIT_DIRECTIONS).nullable().optional(),
    compare: z.enum(HABIT_COMPARES).nullable().optional(),
  })
  .default({});

/** Applies per-type defaults and drops settings that don't apply. */
export function normalizeHabitConfig(
  type: HabitType,
  input: Partial<HabitConfig> = {},
): HabitConfig {
  const none: HabitConfig = { target: null, unit: null, min: null, max: null };
  if (type === "group") {
    const rule = input.rule ?? "all";
    const target = rule === "count" ? Math.round(positive(input.target, 1)) : null;
    return { ...none, rule, target };
  }
  if (type === "time") {
    // Earlier or later is the goal either way, so time habits are always "build".
    const target =
      input.target == null ? null : clamp(Math.round(input.target), 0, MINUTES_PER_DAY - 1);
    return { ...none, direction: "build", compare: input.compare ?? "atMost", target };
  }
  const direction: HabitDirection = input.direction ?? "build";
  const avoid = direction === "avoid";
  const compare: HabitCompare = input.compare ?? "atLeast";
  const goal = avoid ? {} : { compare };
  // A limit can be zero ("no cigarettes"), as can "at most" or "more than" goals; the rest can't.
  const zeroOk = avoid || compare === "atMost" || compare === "moreThan";
  const amount = (fallback: number) =>
    zeroOk
      ? Math.max(0, Math.round(input.target ?? fallback))
      : Math.round(positive(input.target, fallback));
  switch (type) {
    case "counter":
      return {
        ...none,
        direction,
        ...goal,
        target: amount(avoid ? 0 : 1),
        unit: input.unit || "times",
      };
    case "duration":
      return { ...none, direction, ...goal, target: amount(30) };
    case "slider": {
      const ok = (input.min ?? 0) < (input.max ?? 10);
      const min = ok ? (input.min ?? 0) : 0;
      const max = ok ? (input.max ?? 10) : 10;
      // Build goals are optional here: without one, any logged level counts.
      const target = avoid
        ? clamp(input.target ?? Math.round((min + max) / 2), min, max)
        : input.target == null
          ? null
          : clamp(input.target, min, max);
      return { ...none, direction, ...goal, min, max, target };
    }
    case "rating": {
      const max = Math.min(10, Math.max(3, Math.round(input.max ?? 5)));
      const target = avoid
        ? clamp(Math.round(input.target ?? Math.floor(max / 2)), 1, max)
        : input.target == null
          ? null
          : clamp(Math.round(input.target), 1, max);
      return { ...none, direction, ...goal, min: 1, max, target };
    }
    default:
      return { ...none, direction };
  }
}

/** A build habit's comparison (older habits have none and meant "at least"). */
export function habitCompare(type: HabitType, config: HabitConfig): HabitCompare {
  return config.compare ?? (type === "time" ? "atMost" : "atLeast");
}

/**
 * The goal in words for "goal …": "8 glasses" (at least is implied), "at most 2000 cal",
 * "by 6:30 AM", "4 of 5 stars". Null without one.
 */
export function describeHabitGoal(type: HabitType, config: HabitConfig): string | null {
  if (!TARGETED_TYPES.includes(type) || config.target === null || isAvoid(config)) return null;
  const compare = habitCompare(type, config);
  if (type === "time") {
    return `${TIME_COMPARE_LABELS[compare].toLowerCase()} ${formatTimeOfDay(config.target)}`;
  }
  const unit =
    type === "counter"
      ? ` ${config.unit ?? ""}`.trimEnd()
      : type === "duration"
        ? " min"
        : type === "rating"
          ? ` of ${config.max ?? 5} stars`
          : "";
  const words = compare === "atLeast" ? "" : `${HABIT_COMPARE_LABELS[compare].toLowerCase()} `;
  return `${words}${config.target}${unit}`;
}

function positive(n: number | null | undefined, fallback: number) {
  return n != null && n > 0 ? n : fallback;
}

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}

export interface HabitEntryValue {
  num: number | null;
  text: string | null;
}

/** Returns an error message, or null if `value` is a valid entry for this habit. */
export function validateHabitEntry(
  type: HabitType,
  config: HabitConfig,
  value: HabitEntryValue,
): string | null {
  const { num, text } = value;
  const isInt = (n: number | null): n is number => n !== null && Number.isInteger(n);
  switch (type) {
    case "checkbox":
      return num === 1 || num === 0 ? null : "Mark it done or not done";
    case "checknote":
      if (num !== 1 && num !== 0) return "Mark it done or not done";
      return (text ?? "").length <= MAX_HABIT_NOTE ? null : "Note is too long";
    case "counter":
      return isInt(num) && num >= 0 && num <= MAX_HABIT_COUNT
        ? null
        : `Enter a whole number from 0 to ${MAX_HABIT_COUNT.toLocaleString("en-US")}`;
    case "duration":
      return num !== null && num >= 0 && num <= 1440 ? null : "Enter minutes (0-1440)";
    case "time":
      return isInt(num) && num >= 0 && num < MINUTES_PER_DAY ? null : "Enter a time of day";
    case "slider":
      return num !== null && num >= (config.min ?? 0) && num <= (config.max ?? 10)
        ? null
        : `Pick a value from ${config.min} to ${config.max}`;
    case "rating":
      return isInt(num) && num >= 1 && num <= (config.max ?? 5)
        ? null
        : `Rate from 1 to ${config.max}`;
    case "shorttext":
      return text && text.trim() && text.length <= MAX_HABIT_SHORT_TEXT
        ? null
        : "Enter a short answer";
    case "journal":
      return text && text.trim() && text.length <= MAX_HABIT_JOURNAL ? null : "Write something";
    case "group":
      return "Log the sub-habits; a group is done by its rule";
  }
}

/**
 * Whether an entry counts as the habit being done that day. For avoid habits, "done" means kept:
 * explicitly avoided (checkbox 0) or within the limit.
 */
export function isHabitDone(type: HabitType, config: HabitConfig, value: HabitEntryValue): boolean {
  if (isAvoid(config)) {
    switch (type) {
      case "checkbox":
      case "checknote":
        return value.num === 0;
      case "counter":
      case "duration":
      case "slider":
      case "rating":
        return value.num !== null && value.num <= (config.target ?? 0);
      default:
        // A written entry on an avoid text habit records a slip.
        return !value.text?.trim();
    }
  }
  const compare = habitCompare(type, config);
  switch (type) {
    case "checkbox":
    case "checknote":
      return value.num === 1;
    case "counter":
    case "duration":
      return meets(value.num ?? 0, config.target ?? 1, compare);
    case "slider":
    case "rating":
      // Without a target, any logged value counts.
      return (
        value.num !== null && (config.target == null || meets(value.num, config.target, compare))
      );
    case "time":
      return (
        value.num !== null &&
        (config.target == null || meets(clockOffset(value.num, config.target), 0, compare))
      );
    case "shorttext":
    case "journal":
      return Boolean(value.text?.trim());
    case "group":
      // Groups have no real entries; derived ones (stats) carry 1 when the rule is met.
      return value.num === 1;
    default:
      return value.num !== null;
  }
}

/** Done for a day, where no entry means not done, except for avoid habits (kept by default). */
export function isEntryDone(
  type: HabitType,
  config: HabitConfig,
  value: HabitEntryValue | null,
): boolean {
  return value ? isHabitDone(type, config, value) : isAvoid(config);
}

/** An avoid habit's entry that crossed the line. */
export function isSlip(
  type: HabitType,
  config: HabitConfig,
  value: HabitEntryValue | null,
): boolean {
  return isAvoid(config) && value !== null && !isHabitDone(type, config, value);
}

/** Whether a group's rule is met by its sub-habits' done states. */
export function isGroupDone(config: HabitConfig, childrenDone: boolean[]): boolean {
  const done = childrenDone.filter(Boolean).length;
  switch (config.rule ?? "all") {
    case "any":
      return done > 0;
    case "count":
      return done >= (config.target ?? 1);
    default:
      return childrenDone.length > 0 && done === childrenDone.length;
  }
}

/** Done for a day's habit: its entry, or for a group, its rule over sub-habits. */
export function isDayHabitDone(item: DayHabitDto): boolean {
  if (item.habit.type === "group") {
    return isGroupDone(item.habit.config, (item.children ?? []).map(isDayHabitDone));
  }
  return isEntryDone(item.habit.type, item.habit.config, item.entry);
}

/** "2/3" for a group's sub-habits, plus what the rule needs when it isn't "all". */
export function groupProgress(item: DayHabitDto): string {
  const children = item.children ?? [];
  const done = children.filter(isDayHabitDone).length;
  const { rule, target } = item.habit.config;
  if (rule === "any") return `${done}/${children.length} · any`;
  if (rule === "count") return `${done}/${children.length} · need ${target ?? 1}`;
  return `${done}/${children.length}`;
}

/** "✓ avoided", "✗ slipped", "3/≤2 coffees", "45/≤60 min". */
function formatAvoidEntry(type: HabitType, config: HabitConfig, value: HabitEntryValue): string {
  const n = value.num ?? 0;
  switch (type) {
    case "checkbox":
      return value.num === 1 ? "✗ slipped" : "✓ avoided";
    case "checknote":
      return value.num === 1 ? `✗ ${value.text?.trim() || "slipped"}` : "✓ avoided";
    case "counter":
      return `${n}/≤${config.target ?? 0}${config.unit ? ` ${config.unit}` : ""}`;
    case "duration":
      return `${n}/≤${config.target ?? 0} min`;
    case "slider":
    case "rating":
      return `${n} (≤${config.target ?? 0})`;
    default:
      return value.text?.trim() ? `✗ ${value.text.trim()}` : "✓";
  }
}

/** A compact reading of one entry for summaries: "✓", "6/8 glasses", "25/30 min", "4/5". */
export function formatHabitEntry(
  type: HabitType,
  config: HabitConfig,
  value: HabitEntryValue | null,
): string {
  if (!value) return "—";
  if (isAvoid(config)) return formatAvoidEntry(type, config, value);
  const n = value.num;
  const symbol = COMPARE_SYMBOLS[habitCompare(type, config)];
  // "6/8 glasses" for counts and time ("at least" is implied), "4/5 (≥4)" for scales and stars.
  const goal = config.target !== null ? `${symbol}${config.target}` : "";
  const line = goal ? ` (${symbol || "≥"}${config.target})` : "";
  switch (type) {
    case "checkbox":
      return n === 1 ? "✓" : "—";
    case "checknote":
      return n === 1 ? (value.text?.trim() ? `✓ ${value.text.trim()}` : "✓") : "—";
    case "counter": {
      const unit = config.unit ? ` ${config.unit}` : "";
      return goal ? `${n ?? 0}/${goal}${unit}` : `${n ?? 0}${unit}`;
    }
    case "duration":
      return goal ? `${n ?? 0}/${goal} min` : `${n ?? 0} min`;
    case "time": {
      if (n === null) return "—";
      const target = config.target;
      return target === null
        ? formatTimeOfDay(n)
        : `${formatTimeOfDay(n)} (${TIME_COMPARE_LABELS[habitCompare(type, config)].toLowerCase()} ${formatTimeOfDay(target)})`;
    }
    case "rating":
      return n === null ? "—" : `${n}/${config.max ?? 5}${line}`;
    case "slider":
      return n === null ? "—" : `${n}${config.max !== null ? `/${config.max}` : ""}${line}`;
    case "group":
      return value.text ?? (n === 1 ? "✓" : "—");
    default:
      return value.text?.trim() || "—";
  }
}

export interface HabitDto {
  id: string;
  name: string;
  type: HabitType;
  config: HabitConfig;
  /** Scheduled weekdays, 0 = Sunday. */
  days: number[];
  /** Rated attributes (current-season node ids) this habit feeds. */
  links: string[];
  sortOrder: number;
  /** First day the habit counts (YYYY-MM-DD). Can be in the past for backfilled habits. */
  startsOn: string;
  /** The group this is a sub-habit of, if any. */
  parentId?: string | null;
}

export interface DayHabitDto {
  habit: HabitDto;
  scheduled: boolean;
  entry: HabitEntryValue | null;
  /** A group's sub-habits for the day (empty or absent otherwise). */
  children?: DayHabitDto[];
}

export interface DayDto {
  date: string;
  today: string;
  editable: boolean;
  /** open: never recapped. recapped: recap is current. stale: edited since its recap. */
  status: "open" | "recapped" | "stale";
  journal: string;
  habits: DayHabitDto[];
  /** Goals whose window includes this day. */
  objectives: DayObjectiveDto[];
  /** Completed workouts that count for this day. */
  workouts: DayWorkoutDto[];
  /** Height and weight for the day; null when neither is tracked. */
  body: DayBodyDto | null;
  units: UnitSystem;
  /** Questions from the previous day's recap. */
  prompts: GuidedPromptDto[];
  recap: RecapDto | null;
}

export interface LinkSuggestionDto {
  nodeIds: string[];
  reason: string;
}

// Request bodies

const dateSchema = z.string().refine(isValidDate, "Use a valid YYYY-MM-DD date");

export const daysSchema = z
  .array(z.number().int().min(0).max(6))
  .min(1)
  .max(7)
  .refine((d) => new Set(d).size === d.length, "Days must be unique");

export const createHabitBodySchema = z.object({
  name: z.string().trim().min(1).max(60),
  type: z.enum(HABIT_TYPES),
  config: habitConfigInputSchema,
  days: daysSchema.default(ALL_DAYS),
  links: z.array(z.uuid()).max(MAX_HABIT_LINKS).default([]),
  /** Defaults to the user's today. */
  startsOn: dateSchema.optional(),
  /** Makes this a sub-habit of a group (it takes the group's schedule). */
  parentId: z.uuid().optional(),
});

export const updateHabitBodySchema = z
  .object({
    name: z.string().trim().min(1).max(60),
    config: habitConfigInputSchema,
    days: daysSchema,
    links: z.array(z.uuid()).max(MAX_HABIT_LINKS),
    startsOn: dateSchema,
  })
  .partial();

export const suggestLinksBodySchema = z.object({
  name: z.string().trim().min(1).max(60),
  type: z.enum(HABIT_TYPES),
});

export const saveJournalBodySchema = z.object({
  journal: z.string().max(MAX_DAY_JOURNAL),
});

export const saveEntryBodySchema = z.object({
  num: z.number().finite().nullable().default(null),
  text: z.string().max(MAX_HABIT_JOURNAL).nullable().default(null),
});

export const dateParamSchema = z.string().regex(DATE_PATTERN);

// LLM output

export const linkSuggestionOutputSchema = z.object({
  refs: z
    .array(z.string())
    .describe("Refs of 1-3 rated attributes this habit most directly builds"),
  reason: z.string().describe("One short sentence on why"),
});
