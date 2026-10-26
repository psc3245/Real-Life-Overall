import { z } from "zod";
import { SEASON_MODES, type SeasonMode } from "../rating/growth";
import type { EarnedBadgeDto } from "./badges";
import type { HistoryDto } from "./history";
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
  /** Points gained that season (absent on seasons archived before growth mode). */
  growth?: number | null;
}

/** A finished season, frozen at rollover (the "season card"). */
export interface SeasonCardDto {
  id: string;
  label: string;
  startsOn: string;
  endsOn: string;
  mode: SeasonMode;
  /** The final rating. Growth seasons show `growth` instead. */
  overall: number | null;
  growth: number | null;
  archetype: string | null;
  nodes: SeasonSnapshotNode[];
}

export interface SeasonDetailNode {
  id: string;
  parentId: string | null;
  name: string;
  depth: number;
  /**
   * The season's score on its first rated day, and on its last (today while it's running):
   * ratings, or growth (from 0) in a growth season.
   */
  start: number | null;
  end: number | null;
}

/** Everything about one season, current or archived (the History page). */
export interface SeasonDetailDto {
  id: string;
  label: string;
  startsOn: string;
  endsOn: string;
  current: boolean;
  mode: SeasonMode;
  /** Last day covered: today while the season runs, its end once archived. */
  through: string;
  archetype: string | null;
  nodes: SeasonDetailNode[];
  history: HistoryDto;
  stats: {
    daysLogged: number;
    daysRecapped: number;
    bestLoggingStreak: number;
    habitCompletions: number;
    weeklyReviews: number;
  };
  badges: EarnedBadgeDto[];
  weeks: { id: string; weekStart: string; weekEnd: string; narrative: string }[];
}

export interface SeasonSetupDto {
  label: string;
  mode: SeasonMode;
  /** The mode can change only during setup (DESIGN.md §4.6). */
  modeEditable: boolean;
  /** Last day the tree can be edited; null when this season can't be set up (first season). */
  setupEndsOn: string | null;
  editable: boolean;
  /** Last season's card, for comparison while editing. */
  previous: SeasonCardDto | null;
}

export const setSeasonModeBodySchema = z.object({ mode: z.enum(SEASON_MODES) });

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
