import { z } from "zod";
import { addDays, dayOfWeek } from "../dates";
import { HABIT_TYPES, type HabitType } from "./habits";
import type { EarnedBadgeDto } from "./badges";
import type { RecapChangeDto } from "./recaps";
import { scoutingReportOutputSchema } from "./scouting-report";
import {
  treeChangeOutputSchema,
  weightShiftsOutputSchema,
  type TreeProposalDto,
  type WeightChangeDto,
} from "./tree-evolution";

/** Largest weekly correction to one attribute (DESIGN.md §5.6). */
export const WEEKLY_DELTA_CAP = 5;
export const MAX_FOCUS_GOALS = 3;
export const MAX_HABIT_PROPOSALS = 2;
export const MAX_DECAY_REVISIONS = 4;
export const MAX_PROFILE_SUMMARY = 1200;

export interface WeekRange {
  start: string;
  end: string;
}

/** The most recent fully finished week before `today`, given the user's first weekday. */
export function lastCompletedWeek(today: string, weekStart: number): WeekRange {
  const lastDay = (weekStart + 6) % 7;
  let end = addDays(today, -1);
  while (dayOfWeek(end) !== lastDay) end = addDays(end, -1);
  return { start: addDays(end, -6), end };
}

export interface FocusGoalDto {
  title: string;
  detail: string;
  nodeIds: string[];
}

export interface HabitProposalDto {
  index: number;
  name: string;
  type: HabitType;
  days: number[];
  /** counter/duration goal. */
  target: number | null;
  unit: string | null;
  nodeIds: string[];
  reason: string;
  status: "pending" | "accepted" | "dismissed";
}

export interface DecayRevisionDto {
  nodeId: string;
  nodeName: string;
  graceDays: number;
  perDay: number;
  floor: number;
  reason: string;
}

export interface WeeklyReviewDto {
  id: string;
  weekStart: string;
  weekEnd: string;
  narrative: string;
  overallStart: number | null;
  overallEnd: number | null;
  corrections: RecapChangeDto[];
  decayRevisions: DecayRevisionDto[];
  focusGoals: FocusGoalDto[];
  habitProposals: HabitProposalDto[];
  /** Badges earned with this review (personal and catalog). */
  badges: EarnedBadgeDto[];
  /** Set when this review renamed the archetype. */
  archetypeChange: { from: string | null; to: string; description: string } | null;
  /** Weights this review shifted (DESIGN.md §4.5). */
  weightShifts: WeightChangeDto[];
  /** A tree change this review proposed, if any. */
  treeProposal: TreeProposalDto | null;
  createdAt: string;
}

export interface WeeklyStateDto {
  /** The last completed week, or null before the first one has finished since onboarding. */
  week: WeekRange | null;
  review: WeeklyReviewDto | null;
  /** True when that week is finished but not reviewed yet. */
  ready: boolean;
  history: { id: string; weekStart: string; weekEnd: string; narrative: string }[];
}

// LLM output

export const weeklyReviewOutputSchema = z.object({
  narrative: z.string().describe("3-5 neutral sentences on the week: progress, patterns, gaps"),
  corrections: z
    .array(
      z.object({
        ref: z.string(),
        delta: z.number().describe(`Signed, within ±${WEEKLY_DELTA_CAP}`),
        reason: z.string(),
      }),
    )
    .describe("Only where daily recaps clearly over- or under-counted the week. Usually []"),
  decayRevisions: z
    .array(
      z.object({
        ref: z.string(),
        graceDays: z.number(),
        perDay: z.number(),
        floor: z.number(),
        reason: z.string(),
      }),
    )
    .describe(`At most ${MAX_DECAY_REVISIONS}; only when a rule clearly doesn't fit. Usually []`),
  focusGoals: z
    .array(
      z.object({
        title: z.string().describe("Short, concrete goal for next week"),
        detail: z.string().describe("One sentence on how, ideally with a number"),
        refs: z.array(z.string()),
      }),
    )
    .describe(`1-${MAX_FOCUS_GOALS} goals`),
  habitProposals: z
    .array(
      z.object({
        name: z.string(),
        type: z.enum(HABIT_TYPES),
        days: z.array(z.number()).describe("Weekdays 0=Sunday..6=Saturday"),
        target: z.number().nullable().describe("Daily goal for count/time habits, else null"),
        unit: z.string().nullable().describe("Unit for count habits, else null"),
        refs: z.array(z.string()),
        reason: z.string(),
      }),
    )
    .describe(
      `0-${MAX_HABIT_PROPOSALS} new habits that would close a gap; never duplicate existing ones`,
    ),
  profileSummary: z
    .string()
    .describe("Updated rolling profile of the user: goals, context, patterns. Under 120 words"),
  projections: z
    .array(
      z.object({
        ref: z.string().describe('A category ref, or "overall"'),
        value: z.number().describe("Expected rating at season end, 0-100"),
      }),
    )
    .describe("Season-end projection for Overall and every category, from the current trajectory"),
  archetype: z
    .object({ name: z.string(), description: z.string() })
    .nullable()
    .describe("A new archetype only if the user's shape has clearly changed; otherwise null"),
  personalBadge: z
    .object({
      name: z.string().describe("2-4 words, playful but specific, e.g. 'Dawn Patrol'"),
      description: z.string().describe("One sentence on the specific achievement"),
    })
    .nullable()
    .describe("Only for a genuinely notable, specific achievement this week; usually null"),
  scoutingReport: scoutingReportOutputSchema.describe(
    "The updated Scouting Report: keep what still holds, add what this week revealed",
  ),
  weightShifts: weightShiftsOutputSchema,
  treeChange: treeChangeOutputSchema,
});
