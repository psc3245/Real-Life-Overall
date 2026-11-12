import { z } from "zod";
import { isValidDate } from "../dates";
import { HABIT_TYPES, type HabitType } from "./habits";

/**
 * The coach (DESIGN.md §5.9): a chat with the scout that knows the player's ratings, habits,
 * goals, recent days and Scouting Report, answers questions, and suggests habits, goals and
 * Scouting Report additions the player adds with one tap. It also logs what the player tells it
 * (workouts, habits, goal progress) with tools, each shown as a receipt the player can undo.
 */

export const MAX_COACH_MESSAGE = 1000;
/** Player messages per rolling 24 hours. */
export const MAX_COACH_MESSAGES_PER_DAY = 30;
/** Earlier messages sent with each turn. */
export const COACH_HISTORY_MESSAGES = 20;
export const MAX_COACH_SUGGESTIONS = 3;
/** Model steps per turn: tool calls plus the final reply. */
export const MAX_COACH_STEPS = 6;
/** Things the coach can log in one turn. */
export const MAX_COACH_ACTIONS = 6;
/** Messages the page loads. */
export const COACH_PAGE_MESSAGES = 100;

export const COACH_REPORT_SECTIONS = ["aspiration", "priority", "focus", "constraint"] as const;
export type CoachReportSection = (typeof COACH_REPORT_SECTIONS)[number];

export type CoachSuggestionStatus = "pending" | "accepted" | "dismissed";

interface SuggestionBase {
  index: number;
  reason: string;
  status: CoachSuggestionStatus;
}

export type CoachSuggestionDto = SuggestionBase &
  (
    | {
        kind: "habit";
        name: string;
        habitType: HabitType;
        days: number[];
        /** counter/duration goal. */
        target: number | null;
        unit: string | null;
        nodeIds: string[];
      }
    | {
        kind: "goal";
        name: string;
        target: number;
        unit: string;
        /** Days from the day it's added to the deadline. */
        durationDays: number;
        nodeIds: string[];
      }
    | {
        kind: "report";
        section: CoachReportSection;
        text: string;
        /** Priorities only, 1-5. */
        importance: number | null;
        nodeId: string | null;
      }
  );

/** Something the coach logged for the player. Undoing restores what was there before. */
export type CoachActionDto = {
  index: number;
  /** The day it was logged on. */
  date: string;
  /** "Leg Day", "Morning run", "Read 50 books". */
  title: string;
  /** "Squat (Barbell) 3 × 5 · Leg Press 3 × 10", "Done", "+12 pages". */
  detail: string;
  undone: boolean;
} & (
  | { kind: "workout"; workoutId: string }
  | {
      kind: "habit";
      habitId: string;
      /** The entry before the coach changed it; null if there was none. */
      previous: { num: number | null; text: string | null } | null;
    }
  | { kind: "goal"; objectiveId: string; previous: number | null }
);

export interface CoachMessageDto {
  id: string;
  role: "user" | "assistant";
  content: string;
  suggestions: CoachSuggestionDto[];
  actions: CoachActionDto[];
  createdAt: string;
}

export interface CoachStateDto {
  messages: CoachMessageDto[];
  /** Messages left in the rolling 24-hour window. */
  remaining: number;
}

export const coachMessageBodySchema = z.object({
  content: z.string().trim().min(1).max(MAX_COACH_MESSAGE),
});

/** The postgame interview after a day's recap: the coach opens with questions about it. */
export const postgameBodySchema = z.object({
  date: z.string().refine(isValidDate, "Use a valid YYYY-MM-DD date"),
});

/** The starter questions shown on an empty chat and on Today. */
export const COACH_STARTERS = [
  "What should I focus on this week?",
  "Suggest a habit for my weakest area",
  "Help me set a goal for this month",
  "How am I doing overall?",
] as const;

// LLM output (flat, so strict structured-output modes accept it)

export const coachReplyOutputSchema = z.object({
  reply: z.string().describe("Your answer to the user, plain text, usually under 120 words"),
  suggestions: z
    .array(
      z.object({
        kind: z.enum(["habit", "goal", "report"]),
        name: z.string().describe("habit/goal: a short name; report: the line to add"),
        reason: z.string().describe("One sentence on why, tied to what you know"),
        refs: z.array(z.string()).describe("Attribute refs it builds (habit/goal); else []"),
        habitType: z.enum(HABIT_TYPES).nullable().describe("habit only; prefer simple types"),
        days: z.array(z.number()).describe("habit only: weekdays 0=Sunday..6=Saturday; else []"),
        target: z
          .number()
          .nullable()
          .describe("habit: daily goal for count/time habits; goal: the total to reach"),
        unit: z.string().nullable().describe("habit count unit, or what a goal counts"),
        durationDays: z.number().nullable().describe("goal only: days until the deadline"),
        section: z.enum(COACH_REPORT_SECTIONS).nullable().describe("report only"),
        importance: z.number().nullable().describe("report priority only: 1-5"),
      }),
    )
    .describe(
      `0-${MAX_COACH_SUGGESTIONS}; only when the user asks for ideas or one clearly helps. Usually []`,
    ),
});
