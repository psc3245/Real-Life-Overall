import { z } from "zod";
import { DATE_PATTERN, isValidDate } from "../dates";
import type { DayObjectiveDto } from "./objectives";
import type { GuidedPromptDto, RecapDto } from "./recaps";

export const HABIT_TYPES = [
  "checkbox",
  "checknote",
  "counter",
  "duration",
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
  slider: "Scale",
  rating: "Stars",
  shorttext: "Short answer",
  journal: "Long entry",
  group: "Group of sub-habits",
};

export const MAX_HABIT_NOTE = 280;
export const MAX_HABIT_SHORT_TEXT = 200;
export const MAX_HABIT_JOURNAL = 5000;
export const MAX_DAY_JOURNAL = 10_000;
export const MAX_HABIT_LINKS = 4;
export const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

/** Type-specific settings. Fields that don't apply to a type are null. */
export interface HabitConfig {
  /** counter: daily goal count; duration: daily goal minutes. */
  target: number | null;
  /** counter only, e.g. "pages", "glasses". */
  unit: string | null;
  /** slider: scale bounds. rating: max stars (min is always 1). */
  min: number | null;
  max: number | null;
  /** group only: how sub-habits decide the group (with `target` as N for "count"). */
  rule?: GroupRule | null;
}

// No per-field defaults: on update, a missing key must mean "keep the current value".
const optionalNumber = z.number().finite().nullable().optional();
export const habitConfigInputSchema = z
  .object({
    target: optionalNumber,
    unit: z.string().trim().max(20).nullable().optional(),
    min: optionalNumber,
    max: optionalNumber,
    rule: z.enum(GROUP_RULES).nullable().optional(),
  })
  .default({});

/** Applies per-type defaults and drops settings that don't apply. */
export function normalizeHabitConfig(
  type: HabitType,
  input: Partial<HabitConfig> = {},
): HabitConfig {
  const none: HabitConfig = { target: null, unit: null, min: null, max: null };
  const positive = (n: number | null | undefined, fallback: number) =>
    n != null && n > 0 ? n : fallback;
  switch (type) {
    case "counter":
      return {
        ...none,
        target: Math.round(positive(input.target, 1)),
        unit: input.unit || "times",
      };
    case "duration":
      return { ...none, target: Math.round(positive(input.target, 30)) };
    case "slider": {
      const min = input.min ?? 0;
      const max = input.max ?? 10;
      return min < max ? { ...none, min, max } : { ...none, min: 0, max: 10 };
    }
    case "rating":
      return { ...none, min: 1, max: Math.min(10, Math.max(3, Math.round(input.max ?? 5))) };
    case "group": {
      const rule = input.rule ?? "all";
      return {
        ...none,
        rule,
        target: rule === "count" ? Math.round(positive(input.target, 1)) : null,
      };
    }
    default:
      return none;
  }
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
      return isInt(num) && num >= 0 && num <= 10_000 ? null : "Enter a whole number";
    case "duration":
      return num !== null && num >= 0 && num <= 1440 ? null : "Enter minutes (0-1440)";
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

/** Whether an entry counts as the habit being done that day. */
export function isHabitDone(type: HabitType, config: HabitConfig, value: HabitEntryValue): boolean {
  switch (type) {
    case "checkbox":
    case "checknote":
      return value.num === 1;
    case "counter":
    case "duration":
      return (value.num ?? 0) >= (config.target ?? 1);
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
  return item.entry ? isHabitDone(item.habit.type, item.habit.config, item.entry) : false;
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

/** A compact reading of one entry for summaries: "✓", "6/8 glasses", "25/30 min", "4/5". */
export function formatHabitEntry(
  type: HabitType,
  config: HabitConfig,
  value: HabitEntryValue | null,
): string {
  if (!value) return "—";
  const n = value.num;
  switch (type) {
    case "checkbox":
      return n === 1 ? "✓" : "—";
    case "checknote":
      return n === 1 ? (value.text?.trim() ? `✓ ${value.text.trim()}` : "✓") : "—";
    case "counter": {
      const unit = config.unit ? ` ${config.unit}` : "";
      return config.target ? `${n ?? 0}/${config.target}${unit}` : `${n ?? 0}${unit}`;
    }
    case "duration":
      return config.target ? `${n ?? 0}/${config.target} min` : `${n ?? 0} min`;
    case "rating":
      return n === null ? "—" : `${n}/${config.max ?? 5}`;
    case "slider":
      return n === null ? "—" : `${n}${config.max !== null ? `/${config.max}` : ""}`;
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

const daysSchema = z
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
