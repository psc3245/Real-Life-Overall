import { z } from "zod";
import { DATE_PATTERN, isValidDate } from "../dates";
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
] as const;
export type HabitType = (typeof HABIT_TYPES)[number];

export const HABIT_TYPE_LABELS: Record<HabitType, string> = {
  checkbox: "Done / not done",
  checknote: "Done + note",
  counter: "Count",
  duration: "Time spent",
  slider: "Scale",
  rating: "Stars",
  shorttext: "Short answer",
  journal: "Long entry",
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
}

// No per-field defaults: on update, a missing key must mean "keep the current value".
const optionalNumber = z.number().finite().nullable().optional();
export const habitConfigInputSchema = z
  .object({
    target: optionalNumber,
    unit: z.string().trim().max(20).nullable().optional(),
    min: optionalNumber,
    max: optionalNumber,
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
    default:
      return value.num !== null;
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
}

export interface DayHabitDto {
  habit: HabitDto;
  scheduled: boolean;
  entry: HabitEntryValue | null;
}

export interface DayDto {
  date: string;
  today: string;
  editable: boolean;
  /** open: never recapped. recapped: recap is current. stale: edited since its recap. */
  status: "open" | "recapped" | "stale";
  journal: string;
  habits: DayHabitDto[];
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
