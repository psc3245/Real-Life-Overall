import { z } from "zod";
import type { DeathCause, SoulEarnings } from "../rating/souls";
import type { SeasonDto } from "./onboarding";

/** One node on the stat sheet: leaves hold levels, parents roll them up by weight. */
export interface SoulStatDto {
  id: string;
  parentId: string | null;
  name: string;
  depth: number;
  /** Leaves: start plus levels bought. Parents: weighted mean. Null with nothing below. */
  level: number | null;
  /** Leaves only: souls for the next level, null at 99. */
  cost: number | null;
  /** Leaves only: levels bought this season. */
  gained: number;
  /** The rating that keeps running underneath. */
  rating: number | null;
}

export interface SoulDayDto {
  date: string;
  earned: SoulEarnings;
  spent: number;
  recovered: number;
  dropped: number;
  lost: number;
  deaths: DeathCause[];
  held: number;
  paused: boolean;
  /** The day still counts as in play (today, or yesterday before the morning recap). */
  open: boolean;
}

/** GET /souls: the bonfire (DESIGN.md §4.7). */
export interface SoulsDto {
  season: SeasonDto;
  today: string;
  /** First day of the run: the day the stat sheet was made. */
  startedOn: string;
  /** Unspent souls; negative when a death took back souls a level was bought with. */
  held: number;
  bloodstain: { amount: number; date: string } | null;
  /** Unspent souls brought in from last season's run (New Game+). */
  carried: number;
  /** New Game+ cycle: 0 on a first Souls season, +1 per Souls season straight before it. */
  cycle: number;
  earned: number;
  spent: number;
  lost: number;
  deaths: number;
  /** Overall's level. */
  soulLevel: number | null;
  stats: SoulStatDto[];
  /** Every day of the run, newest first. */
  days: SoulDayDto[];
}

/** Whether the souls held buy at least one stat's next level. */
export const canLevelUp = (souls: SoulsDto) =>
  souls.stats.some((s) => s.cost !== null && s.cost <= souls.held);

export const MAX_LEVELS_PER_PURCHASE = 10;

export const levelUpBodySchema = z.object({
  nodeId: z.uuid(),
  levels: z.number().int().min(1).max(MAX_LEVELS_PER_PURCHASE).default(1),
});
export type LevelUpBody = z.input<typeof levelUpBodySchema>;
