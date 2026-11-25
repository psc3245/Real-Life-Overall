import { z } from "zod";
import { addDays, isValidDate } from "../dates";

/**
 * Game Plans (DESIGN.md §7.16): an emphasis for a stretch of time with no numbers to hit, like
 * "Build strength" through the winter. Nothing is scored; the coach, daily recaps and weekly
 * reviews read them as what the player is leaning into.
 */
export const GAME_PLAN_STATUSES = ["upcoming", "active", "ended"] as const;
export type GamePlanStatus = (typeof GAME_PLAN_STATUSES)[number];

/** Game Plans running or coming up at once. */
export const MAX_GAME_PLANS = 5;
export const MAX_GAME_PLAN_NOTE = 500;
/** The longest window a Game Plan may span. */
export const MAX_GAME_PLAN_DAYS = 366;
/** Attributes one Game Plan can point at. */
export const MAX_GAME_PLAN_LINKS = 5;

export interface GamePlanDto {
  id: string;
  name: string;
  /** Why, or what it looks like in practice. */
  note: string;
  startsOn: string;
  /** The last day, inclusive. */
  endsOn: string;
  /** Rating nodes (any level) it leans into, in the current season. */
  links: string[];
  status: GamePlanStatus;
}

export function gamePlanStatus(plan: { startsOn: string; endsOn: string }, today: string) {
  if (today < plan.startsOn) return "upcoming";
  return today > plan.endsOn ? "ended" : "active";
}

const dateField = z.string().refine(isValidDate, "Use YYYY-MM-DD");
function validWindow(v: { startsOn?: string; endsOn?: string }) {
  if (!v.startsOn || !v.endsOn) return true;
  return v.endsOn >= v.startsOn && v.endsOn <= addDays(v.startsOn, MAX_GAME_PLAN_DAYS - 1);
}
const windowMessage = {
  message: "The end must be on or after the start, and within a year",
  path: ["endsOn"],
};

export const createGamePlanBodySchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    note: z.string().trim().max(MAX_GAME_PLAN_NOTE).default(""),
    /** Defaults to today. */
    startsOn: dateField.optional(),
    endsOn: dateField,
    links: z.array(z.uuid()).max(MAX_GAME_PLAN_LINKS).default([]),
  })
  .refine(validWindow, windowMessage);
export type CreateGamePlanBody = z.input<typeof createGamePlanBodySchema>;

export const updateGamePlanBodySchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    note: z.string().trim().max(MAX_GAME_PLAN_NOTE),
    startsOn: dateField,
    endsOn: dateField,
    links: z.array(z.uuid()).max(MAX_GAME_PLAN_LINKS),
  })
  .partial()
  .refine(validWindow, windowMessage);
export type UpdateGamePlanBody = z.input<typeof updateGamePlanBodySchema>;
