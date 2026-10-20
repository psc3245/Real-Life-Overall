import { RATING_MAX, RATING_MIN, RATING_TIERS, type RatingTierKey } from "../constants";

export function clampRating(value: number): number {
  return Math.min(RATING_MAX, Math.max(RATING_MIN, value));
}

/** Ratings are stored as numeric(5,2). */
export function roundRating(value: number): number {
  return Math.round(value * 100) / 100;
}

export function ratingTier(value: number): RatingTierKey {
  let tier: RatingTierKey = RATING_TIERS[0].key;
  for (const t of RATING_TIERS) if (value >= t.min) tier = t.key;
  return tier;
}

/** Scales sibling weights so they sum to 1. Non-positive totals fall back to equal weights. */
export function normalizeWeights(weights: number[]): number[] {
  const total = weights.reduce((sum, w) => sum + Math.max(0, w), 0);
  if (total <= 0) return weights.map(() => 1 / weights.length);
  return weights.map((w) => Math.max(0, w) / total);
}
