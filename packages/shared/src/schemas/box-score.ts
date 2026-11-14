import { z } from "zod";

/**
 * A workout's box score (DESIGN.md §7.5): heart rate, calories and effort, asked for when a
 * workout finishes and logged with every cardio session. Every field is optional.
 */
export interface BoxScoreDto {
  avgHeartRate: number | null;
  maxHeartRate?: number | null;
  calories: number | null;
  /** Elevation gain, m (cardio only). */
  elevationM: number | null;
  /** Perceived effort, 1 (easy) to 10 (all out). */
  effort: number | null;
}

/** The box score fields a player can be asked for after a workout (elevation is cardio only). */
export const BOX_SCORE_FIELDS = ["avgHeartRate", "maxHeartRate", "calories", "effort"] as const;
export type BoxScoreField = (typeof BOX_SCORE_FIELDS)[number];

export const BOX_SCORE_LABELS: Record<BoxScoreField, string> = {
  avgHeartRate: "Avg heart rate",
  maxHeartRate: "Max heart rate",
  calories: "Calories",
  effort: "Effort",
};

export const emptyBoxScore = (): BoxScoreDto => ({
  avgHeartRate: null,
  maxHeartRate: null,
  calories: null,
  elevationM: null,
  effort: null,
});

/** Whether a box score has anything in it. */
export const hasBoxScore = (b: BoxScoreDto | null | undefined): b is BoxScoreDto =>
  !!b && !!(b.avgHeartRate || b.maxHeartRate || b.calories || b.elevationM || b.effort);

/**
 * Session load: effort × minutes (the session-RPE method), a "how hard was it" number that adds
 * up across a week; null without an effort.
 */
export function trainingLoad(effort: number | null | undefined, durationS: number): number | null {
  return effort ? Math.round(effort * (durationS / 60)) : null;
}

/** "avg HR 150 · max 172 · 320 cal · effort 7/10" (without elevation, which cardio words itself). */
export function boxScoreLine(b: BoxScoreDto | null | undefined): string {
  if (!b) return "";
  return [
    b.avgHeartRate ? `avg HR ${b.avgHeartRate}` : null,
    b.maxHeartRate ? `max ${b.maxHeartRate}` : null,
    b.calories ? `${b.calories} cal` : null,
    b.effort ? `effort ${b.effort}/10` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

const heartRate = z.number().int().min(30).max(250).nullable().default(null);

export const boxScoreSchema = z.object({
  avgHeartRate: heartRate,
  maxHeartRate: heartRate,
  calories: z.number().int().min(0).max(20_000).nullable().default(null),
  elevationM: z.number().finite().min(0).max(20_000).nullable().default(null),
  effort: z.number().int().min(1).max(10).nullable().default(null),
});
