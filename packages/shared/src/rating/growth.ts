import type { RatingTierKey } from "../constants";
import type { RatingEventSource } from "../schemas/recaps";
import { leafValuesFromEvents, type LedgerEvent } from "./ledger";
import { roundRating } from "./math";

/**
 * How a season is scored (DESIGN.md §4.6). "rating" is the 0-100 OVR; "growth" (Most Improved)
 * scores the points gained this season instead, with the rating kept underneath.
 */
export const SEASON_MODES = ["rating", "growth"] as const;
export type SeasonMode = (typeof SEASON_MODES)[number];

/** What each mode means, for the pickers (the names come from sports talk). */
export const SEASON_MODE_INFO: Record<SeasonMode, string> = {
  rating:
    "Your 0-100 rating for every category and attribute. It rises with what you log, fades " +
    "with neglect, and you rank on rating boards.",
  growth:
    "Scored on points gained this season, starting from 0. Gains add up and setbacks or decay " +
    "never take them away. You rank on growth boards; your rating keeps running underneath, " +
    "visible only to you.",
};

export interface SourcedLedgerEvent extends LedgerEvent {
  source: RatingEventSource;
}

/**
 * The part of one rating change that counts as growth: daily recap gains (setbacks don't
 * subtract) and weekly corrections both ways, so over-credited recaps are taken back. Decay,
 * onboarding and recalibration only move the hidden rating.
 */
export function growthDelta(e: { source: RatingEventSource; delta: number }): number {
  if (e.source === "daily_recap") return Math.max(0, e.delta);
  if (e.source === "weekly_review") return e.delta;
  return 0;
}

/**
 * Each rated leaf's growth this season: its counted deltas, never below zero. Every leaf with
 * any event gets a value (0 until it grows), so roll-ups average over the whole tree.
 */
export function leafGrowthFromEvents(events: Iterable<SourcedLedgerEvent>): Map<string, number> {
  const sums = new Map<string, number>();
  for (const e of events) {
    if (e.voidedAt) continue;
    sums.set(e.nodeId, (sums.get(e.nodeId) ?? 0) + growthDelta(e));
  }
  return new Map([...sums].map(([id, sum]) => [id, roundRating(Math.max(0, sum))]));
}

/** Leaf scores for a season's mode: ratings, or growth. */
export function leafScoresFromEvents(
  mode: SeasonMode,
  events: Iterable<SourcedLedgerEvent>,
): Map<string, number> {
  return mode === "growth" ? leafGrowthFromEvents(events) : leafValuesFromEvents(events);
}

/** Growth colors reuse the rating tiers' palette, at season-sized thresholds. */
export const GROWTH_TIERS: readonly { key: RatingTierKey; min: number }[] = [
  { key: "red", min: 0 },
  { key: "orange", min: 2 },
  { key: "yellow", min: 5 },
  { key: "green", min: 10 },
  { key: "purple", min: 20 },
];

export function growthTier(value: number): RatingTierKey {
  let tier: RatingTierKey = GROWTH_TIERS[0]!.key;
  for (const t of GROWTH_TIERS) if (value >= t.min) tier = t.key;
  return tier;
}

/** "+3.4": growth always reads as points gained. */
export function formatGrowth(value: number, digits = 1): string {
  return `+${Math.max(0, value).toFixed(digits)}`;
}
