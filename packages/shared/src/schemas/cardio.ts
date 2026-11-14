import { z } from "zod";
import { isValidDate } from "../dates";
import type { ExerciseStat } from "../exercises";
import { boxScoreLine, type BoxScoreDto } from "./box-score";
import {
  distanceUnit,
  formatDuration,
  M_PER_MILE,
  toDisplayDistance,
  type UnitSystem,
} from "../units";
import type { WorkoutDto, WorkoutExerciseDto } from "./workouts";

/**
 * Cardio sessions (DESIGN.md §7.5): one activity's distance and time, logged in one go. They're
 * stored as finished workouts (`kind = cardio`) holding one exercise with one set, so records,
 * charts, the day log and recaps see them like any workout; the extras below ride alongside.
 */

/** Cardio activities need time; distance is optional (elliptical, jump rope). */
export const isCardioLine = (stats: readonly ExerciseStat[]) => stats.includes("duration");

/** Activities shown as speed ("15.2 mph") rather than pace ("8:04 /mi"). */
export const SPEED_ACTIVITIES = new Set(["cycling", "indoor-cycling"]);

/** Seconds per mile or km; null without both distance and time. */
export function paceSeconds(
  distanceM: number | null,
  durationS: number | null,
  system: UnitSystem,
): number | null {
  if (!distanceM || !durationS) return null;
  return durationS / (distanceM / (system === "imperial" ? M_PER_MILE : 1000));
}

/** "8:04 /mi" or "15.2 mph" (by activity); null without both distance and time. */
export function formatPace(
  activityId: string,
  distanceM: number | null,
  durationS: number | null,
  system: UnitSystem,
): string | null {
  const pace = paceSeconds(distanceM, durationS, system);
  if (pace === null) return null;
  if (SPEED_ACTIVITIES.has(activityId)) {
    const speed = Math.round((3600 / pace) * 10) / 10;
    return `${speed} ${system === "imperial" ? "mph" : "km/h"}`;
  }
  return `${formatDuration(pace)} /${distanceUnit(system)}`;
}

/** The activity, distance and time of a cardio session. */
export function cardioSession(w: {
  exercises: WorkoutExerciseDto[];
  summary: Pick<WorkoutDto["summary"], "durationS">;
}) {
  const e = w.exercises[0];
  const sets = e?.sets ?? [];
  const distance = sets.reduce((sum, s) => sum + (s.distanceM ?? 0), 0);
  return {
    activityId: e?.exerciseId ?? "",
    distanceM: distance > 0 ? distance : null,
    durationS: w.summary.durationS,
  };
}

/** "3.1 mi in 25:00 (8:04 /mi) · avg HR 150 · max 172 · 320 cal · effort 7/10" */
export function cardioLine(
  activityId: string,
  distanceM: number | null,
  durationS: number,
  details: BoxScoreDto | null,
  system: UnitSystem,
): string {
  const pace = formatPace(activityId, distanceM, durationS, system);
  const main = distanceM
    ? `${toDisplayDistance(distanceM, system)} ${distanceUnit(system)} in ${formatDuration(durationS)}${pace ? ` (${pace})` : ""}`
    : formatDuration(durationS);
  const extras = [
    details?.elevationM
      ? `${Math.round(system === "imperial" ? details.elevationM * 3.28084 : details.elevationM)} ${system === "imperial" ? "ft" : "m"} climb`
      : null,
    boxScoreLine(details) || null,
  ].filter(Boolean);
  return [main, ...extras].join(" · ");
}

export interface CardioTotalsDto {
  sessions: number;
  distanceM: number;
  durationS: number;
}

/** Per-activity totals and bests over every session. */
export interface CardioActivityDto {
  activityId: string;
  sessions: number;
  distanceM: number;
  durationS: number;
  longestM: number | null;
  longestS: number | null;
  /** Fastest pace over sessions with a distance, seconds per km. */
  bestPaceSPerKm: number | null;
  lastDone: string;
}

/** The Cardio tab. */
export interface CardioOverviewDto {
  /** The last 7 and 30 days, today included. */
  week: CardioTotalsDto;
  month: CardioTotalsDto;
  /** Most recent first. */
  activities: CardioActivityDto[];
  /** The latest sessions, newest first. */
  recent: WorkoutDto[];
}

const optional = (min: number, max: number) =>
  z.number().finite().min(min).max(max).nullable().default(null);

export const cardioBodySchema = z.object({
  /** A catalog slug or custom exercise id whose stat line records time. */
  activity: z.string().min(1).max(64),
  /** Defaults to the activity's name. */
  name: z.string().trim().min(1).max(80).optional(),
  notes: z.string().max(2000).default(""),
  localDate: z.string().refine(isValidDate, "Use a valid YYYY-MM-DD date"),
  durationS: z.number().int().min(1).max(86_400),
  distanceM: optional(0, 1_000_000),
  avgHeartRate: z.number().int().min(30).max(250).nullable().default(null),
  maxHeartRate: z.number().int().min(30).max(250).nullable().default(null),
  calories: z.number().int().min(0).max(20_000).nullable().default(null),
  elevationM: optional(0, 20_000),
  effort: z.number().int().min(1).max(10).nullable().default(null),
});
export type CardioInput = z.input<typeof cardioBodySchema>;
