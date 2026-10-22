import { z } from "zod";
import { CONFIDENCE_LEVELS } from "./ratings";

/** Days after a rollover during which the new season's tree can still be edited. */
export const SEASON_SETUP_DAYS = 14;

export interface SeasonSnapshotNode {
  id: string;
  lineageId: string;
  parentId: string | null;
  name: string;
  depth: number;
  value: number | null;
}

/** A finished season, frozen at rollover (the "season card"). */
export interface SeasonCardDto {
  id: string;
  label: string;
  startsOn: string;
  endsOn: string;
  overall: number | null;
  archetype: string | null;
  nodes: SeasonSnapshotNode[];
}

export interface SeasonSetupDto {
  label: string;
  /** Last day the tree can be edited; null when this season can't be set up (first season). */
  setupEndsOn: string | null;
  editable: boolean;
  /** Last season's card, for comparison while editing. */
  previous: SeasonCardDto | null;
}

// LLM output: starting ratings for attributes new this season (or that became leaves).

export const newLeafRatingsOutputSchema = z.object({
  ratings: z.array(
    z.object({
      ref: z.string(),
      value: z.number().describe("Starting rating 0-100"),
      confidence: z.enum(CONFIDENCE_LEVELS),
      rationale: z.string().describe("1-2 sentences to the user on why"),
      decayGraceDays: z.number(),
      decayPerDay: z.number(),
      decayFloor: z.number(),
    }),
  ),
});
