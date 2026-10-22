import { z } from "zod";
import { RATING_MAX, RATING_MIN } from "../constants";
import type { RatingNodeDto, SeasonDto } from "./onboarding";

export const CONFIDENCE_LEVELS = ["low", "medium", "high"] as const;
export type Confidence = (typeof CONFIDENCE_LEVELS)[number];

export const DECAY_LIMITS = {
  graceDays: { min: 1, max: 30 },
  perDay: { min: 0.05, max: 1 },
} as const;

export interface DecayRuleDto {
  graceDays: number;
  perDay: number;
  floor: number;
  notes: string;
}

export interface RatedNodeDto extends RatingNodeDto {
  /** Leaves: the ledger sum. Parents: weighted roll-up. Null if nothing below is rated. */
  value: number | null;
  /** Leaves only: why the current rating is what it is. */
  rationale: string | null;
  confidence: Confidence | null;
  decay: DecayRuleDto | null;
  /** Change over the last 7 days (null without history). */
  trend: number | null;
  /** The user's target rating (Potential, DESIGN.md §7.1). */
  goal: number | null;
  /** The latest weekly review's projection for season end (categories and Overall). */
  projection: number | null;
}

export interface RatingsDto {
  season: SeasonDto;
  /** When the projections were made (the reviewed week's end), if any exist. */
  projectedThrough: string | null;
  archetype: { name: string; description: string } | null;
  summary: string | null;
  nodes: RatedNodeDto[];
}

// LLM output (flat and nullable-free so it works with strict structured-output modes)

export const initialRatingsOutputSchema = z.object({
  ratings: z.array(
    z.object({
      ref: z.string().describe("A rated attribute's ref exactly as given, e.g. n3"),
      value: z.number().describe("Starting rating, 0-100, one decimal allowed"),
      confidence: z.enum(CONFIDENCE_LEVELS).describe("How well the evidence supports the value"),
      rationale: z
        .string()
        .describe(
          "1-2 sentences citing the specific answers behind the value, addressed to the user",
        ),
      decayGraceDays: z
        .number()
        .describe(
          "Whole days without relevant activity before this attribute starts to fade (1-30)",
        ),
      decayPerDay: z.number().describe("Points lost per day once fading (0.05-1.0)"),
      decayFloor: z.number().describe("Decay never pushes the rating below this value"),
    }),
  ),
  archetype: z.object({
    name: z.string().describe("2-4 word 2K-style build name, e.g. 'Two-Way Scholar-Athlete'"),
    description: z.string().describe("One sentence on what defines this build"),
  }),
  summary: z.string().describe("2-3 neutral sentences: strongest areas, biggest gaps"),
});

export const setGoalBodySchema = z.object({
  target: z.number().min(RATING_MIN).max(RATING_MAX),
});
