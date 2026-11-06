import type { RatingTierKey } from "../constants";

/**
 * Souls mode (DESIGN.md §4.7): the model decides what you earn, you decide what to level. Days
 * earn souls; souls buy stat levels (1-99, never decaying) at a rising cost; a bad day drops the
 * unspent souls as a bloodstain that only the next good day picks back up.
 */

export const STAT_LEVEL_MIN = 1;
export const STAT_LEVEL_MAX = 99;

/** Starting levels sit below the first soft cap, so the climb to 99 is the run. */
const START_LEVEL_PER_RATING_POINT = 0.4;

/** Past each soft cap a level costs this much more (DESIGN.md §4.7). */
export const SOFT_CAPS: readonly { level: number; multiplier: number }[] = [
  { level: 40, multiplier: 1.5 },
  { level: 60, multiplier: 3 },
];

/** What each kind of day's work earns. */
export const SOULS_PER_POINT = 100;
export const SOULS_PER_HABIT = 25;
export const SOULS_PER_WORKOUT = 100;
/** A goal beaten pays a boss soul: a base plus a share of how long the fight was. */
export const BOSS_SOULS_BASE = 250;
export const BOSS_SOULS_PER_DAY = 20;
export const BOSS_SOULS_MAX = 3000;
/** A recapped day whose rating changes net at or below this is a death. */
export const BAD_DAY_NET = -1;

/** A starting stat level from a 0-100 rating: 50 (a typical adult) starts at level 20. */
export function levelFromRating(rating: number | null): number {
  const level = Math.round((rating ?? 50) * START_LEVEL_PER_RATING_POINT);
  return Math.min(STAT_LEVEL_MAX, Math.max(STAT_LEVEL_MIN, level));
}

/** Souls to raise a stat from `level` to `level + 1`; null at the max. */
export function levelCost(level: number): number | null {
  if (level >= STAT_LEVEL_MAX) return null;
  let cost = 10 * Math.max(1, level) ** 1.4;
  for (const cap of SOFT_CAPS) if (level >= cap.level) cost *= cap.multiplier;
  return Math.max(100, Math.round(cost / 10) * 10);
}

/** The boss soul for a goal that ran from `startsOn` for `days` days. */
export function bossSouls(days: number): number {
  return Math.min(BOSS_SOULS_MAX, BOSS_SOULS_BASE + BOSS_SOULS_PER_DAY * Math.max(1, days));
}

export const DEATH_CAUSES = ["missed", "slip", "bad_day"] as const;
export type DeathCause = (typeof DEATH_CAUSES)[number];

export const DEATH_CAUSE_LABELS: Record<DeathCause, string> = {
  missed: "Nothing logged",
  slip: "Slipped on an avoid habit",
  bad_day: "A setback day",
};

export interface SoulEarnings {
  /** Rating gains from the daily recap, at SOULS_PER_POINT. */
  recap: number;
  /** The weekly review's corrections, both ways. */
  weekly: number;
  habits: number;
  workouts: number;
  bosses: number;
}

export const emptyEarnings = (): SoulEarnings => ({
  recap: 0,
  weekly: 0,
  habits: 0,
  workouts: 0,
  bosses: 0,
});

export const totalEarned = (e: SoulEarnings) =>
  e.recap + e.weekly + e.habits + e.workouts + e.bosses;

/** One day of the run, as the fold sees it. */
export interface SoulDayInput {
  date: string;
  earned: SoulEarnings;
  /** The day has a daily recap: it counts as reaching the bloodstain. */
  logged: boolean;
  /** Paused days can't kill you, and a bloodstain waits through them. */
  paused: boolean;
  deaths: DeathCause[];
}

/** A level bought: spent after the given day's earnings, before its death check. */
export interface SoulSpend {
  afterDate: string;
  cost: number;
}

export interface SoulDayResult {
  date: string;
  earned: number;
  spent: number;
  /** Souls picked back up from the bloodstain. */
  recovered: number;
  /** Souls dropped as a new bloodstain. */
  dropped: number;
  /** An older bloodstain lost for good. */
  lost: number;
  deaths: DeathCause[];
  /** Held at the end of the day; negative after spends a later death took back. */
  held: number;
}

export interface SoulsState {
  held: number;
  bloodstain: { amount: number; date: string } | null;
  earned: number;
  spent: number;
  lost: number;
  deaths: number;
  days: SoulDayResult[];
}

/**
 * Replays the run day by day, in date order. Each day: earnings come in; a logged day that didn't
 * die picks up the bloodstain; levels bought that day are paid; a death loses any older
 * bloodstain for good and drops what's held as a new one. Derived like ratings, so backfills and
 * re-run recaps change the past. Souls carried from last season start out held. A spend a later change can't cover leaves `held` negative, so
 * dying right after buying never refunds the souls.
 */
export function foldSouls(
  days: readonly SoulDayInput[],
  spends: readonly SoulSpend[],
  /** Unspent souls carried in from last season (New Game+). */
  carried = 0,
): SoulsState {
  const spentOn = new Map<string, number>();
  for (const s of spends) spentOn.set(s.afterDate, (spentOn.get(s.afterDate) ?? 0) + s.cost);
  const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date));
  // Spends dated outside the run (e.g. a day the season no longer covers) settle on its last day.
  const known = new Set(sorted.map((d) => d.date));
  const last = sorted.at(-1)?.date;
  if (last) {
    for (const [date, cost] of spentOn) {
      if (!known.has(date) && date !== last) {
        spentOn.set(last, (spentOn.get(last) ?? 0) + cost);
        spentOn.delete(date);
      }
    }
  }

  const state: SoulsState = {
    held: carried,
    bloodstain: null,
    earned: 0,
    spent: 0,
    lost: 0,
    deaths: 0,
    days: [],
  };
  for (const day of sorted) {
    const earned = totalEarned(day.earned);
    const deaths = day.paused ? [] : day.deaths;
    const died = deaths.length > 0;
    const result: SoulDayResult = {
      date: day.date,
      earned,
      spent: 0,
      recovered: 0,
      dropped: 0,
      lost: 0,
      deaths,
      held: 0,
    };
    state.held += earned;
    state.earned += earned;
    if (state.bloodstain && day.logged && !died) {
      result.recovered = state.bloodstain.amount;
      state.held += state.bloodstain.amount;
      state.bloodstain = null;
    }
    const spent = spentOn.get(day.date) ?? 0;
    result.spent = spent;
    state.held -= spent;
    state.spent += spent;
    if (died) {
      state.deaths++;
      if (state.bloodstain) {
        result.lost = state.bloodstain.amount;
        state.lost += state.bloodstain.amount;
        state.bloodstain = null;
      }
      if (state.held > 0) {
        result.dropped = state.held;
        state.bloodstain = { amount: state.held, date: day.date };
        state.held = 0;
      }
    }
    result.held = state.held;
    state.days.push(result);
  }
  return state;
}

/** Level colors reuse the rating tiers' palette, at level-sized thresholds. */
export const SOULS_TIERS: readonly { key: RatingTierKey; min: number }[] = [
  { key: "red", min: 0 },
  { key: "orange", min: 20 },
  { key: "yellow", min: 30 },
  { key: "green", min: 45 },
  { key: "purple", min: 70 },
];

export function soulsTier(level: number): RatingTierKey {
  let tier: RatingTierKey = SOULS_TIERS[0]!.key;
  for (const t of SOULS_TIERS) if (level >= t.min) tier = t.key;
  return tier;
}

/** "12,340": souls are whole numbers with separators. */
export function formatSouls(souls: number): string {
  return Math.round(souls).toLocaleString("en-US");
}

/**
 * Each leaf's level at the end of `date`, from its starting level and the levels bought by then.
 * Leaves whose stat sheet didn't exist yet are absent.
 */
export function leafLevelsAsOf(
  rows: Iterable<{ nodeId: string; kind: "start" | "level_up"; levels: number; afterDate: string }>,
  date: string,
): Map<string, number> {
  const levels = new Map<string, number>();
  const started = new Set<string>();
  for (const r of rows) {
    if (r.afterDate > date) continue;
    if (r.kind === "start") started.add(r.nodeId);
    levels.set(r.nodeId, (levels.get(r.nodeId) ?? 0) + r.levels);
  }
  for (const id of levels.keys()) if (!started.has(id)) levels.delete(id);
  for (const [id, l] of levels) levels.set(id, Math.min(STAT_LEVEL_MAX, l));
  return levels;
}
