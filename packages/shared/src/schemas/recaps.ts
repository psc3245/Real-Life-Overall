import { z } from "zod";
import type { SeasonMode } from "../rating/growth";
import type { EarnedBadgeDto } from "./badges";
import { ALL_DAYS, daysSchema } from "./habits";

/** Largest move one attribute can make in one daily recap (DESIGN.md §5.6). */
export const DAILY_DELTA_CAP = 3;
/** Recaps per day, counting re-runs after edits. */
export const MAX_RECAPS_PER_DAY = 3;
export const MAX_GUIDED_PROMPTS = 3;
export const MAX_PROMPT_ANSWER = 500;
/** The player's own scheduled questions (DESIGN.md §7.11). */
export const MAX_CUSTOM_PROMPTS = 10;
export const MAX_CUSTOM_PROMPT_QUESTION = 200;

export interface GuidedPromptDto {
  question: string;
  answer: string | null;
  /** Set on the player's own questions; the scout's have none. */
  promptId?: string;
}

/** A question the player asks themselves on the weekdays in `days` (0 = Sunday). */
export interface CustomPromptDto {
  id: string;
  question: string;
  days: number[];
}

export interface RecapChangeDto {
  nodeId: string;
  nodeName: string;
  /** The rating change. */
  delta: number;
  /** How much of it counts as growth (DESIGN.md §4.6). */
  growth: number;
  reason: string;
  evidence: string | null;
  /** The attribute's score (rating, or growth in a growth season) right after this recap. */
  valueAfter: number;
}

export interface RecapDto {
  id: string;
  date: string;
  /** The season's mode: overallBefore/After and valueAfter are growth in a growth season. */
  mode: SeasonMode;
  narrative: string;
  flags: string[];
  changes: RecapChangeDto[];
  overallBefore: number | null;
  overallAfter: number | null;
  /** Badges this recap earned. */
  badges: EarnedBadgeDto[];
  createdAt: string;
}

/** Where a rating change came from (the ledger's `source`). */
export const RATING_EVENT_SOURCES = [
  "onboarding",
  "daily_recap",
  "weekly_review",
  "decay",
  "recalibration",
] as const;
export type RatingEventSource = (typeof RATING_EVENT_SOURCES)[number];

export interface ChangeFeedItemDto {
  id: string;
  nodeId: string;
  nodeName: string;
  delta: number;
  reason: string;
  source: RatingEventSource;
  /** Local date the change belongs to (the recapped day), when known. */
  date: string | null;
  createdAt: string;
}

export const savePromptAnswersBodySchema = z.object({
  answers: z
    .array(z.string().max(MAX_PROMPT_ANSWER).nullable())
    .max(MAX_GUIDED_PROMPTS + MAX_CUSTOM_PROMPTS),
});

export const customPromptBodySchema = z.object({
  question: z.string().trim().min(1).max(MAX_CUSTOM_PROMPT_QUESTION),
  days: daysSchema.default(ALL_DAYS),
});
export const updateCustomPromptBodySchema = z
  .object({
    question: z.string().trim().min(1).max(MAX_CUSTOM_PROMPT_QUESTION),
    days: daysSchema,
  })
  .partial();

/**
 * A day's questions: the stored ones (the scout's, plus own questions already answered or
 * saved), then any own question scheduled that day that isn't there yet. `scheduled` holds the
 * player's live questions for that weekday. A saved, unanswered own question follows edits to
 * its wording and drops out once it's deleted or unscheduled; answered ones keep what was asked.
 */
export function mergeDayPrompts(
  stored: GuidedPromptDto[],
  scheduled: CustomPromptDto[],
): GuidedPromptDto[] {
  const byId = new Map(scheduled.map((p) => [p.id, p]));
  const kept = stored
    .filter((p) => !p.promptId || p.answer || byId.has(p.promptId))
    .map((p) => (p.promptId && !p.answer ? { ...p, question: byId.get(p.promptId)!.question } : p));
  const present = new Set(kept.map((p) => p.promptId));
  return [
    ...kept,
    ...scheduled
      .filter((p) => !present.has(p.id))
      .map((p) => ({ question: p.question, answer: null, promptId: p.id })),
  ];
}

// LLM output

export const dailyRecapOutputSchema = z.object({
  changes: z.array(
    z.object({
      ref: z.string().describe("A rated attribute's ref exactly as given, e.g. n3"),
      delta: z
        .number()
        .describe(`Signed change, usually ±0.1-1.0, never beyond ±${DAILY_DELTA_CAP}`),
      reason: z.string().describe("One short sentence to the user on what they did"),
      evidence: z.string().describe("The habit name or a short quote from the day"),
    }),
  ),
  narrative: z.string().describe("2-4 neutral sentences summarizing the day"),
  flags: z.array(z.string()).describe("Implausible or ambiguous items, or []"),
  nextPrompts: z
    .array(z.string())
    .describe(`1-${MAX_GUIDED_PROMPTS} short questions for tomorrow, answerable in one line`),
});
