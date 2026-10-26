import { addDays, dayOfWeek } from "./dates";
import { seasonForDate } from "./season";
import {
  formatHabitEntry,
  isEntryDone,
  isSlip,
  type HabitDto,
  type HabitEntryValue,
} from "./schemas/habits";

/** At-a-glance periods for habit stats. */
export const HABIT_STAT_RANGES = ["week", "month", "season"] as const;
export type HabitStatRange = (typeof HABIT_STAT_RANGES)[number];

/** Numeric habits whose values are worth averaging. */
const AVERAGED = new Set(["counter", "duration", "rating", "slider"]);

export interface HabitDayStat {
  date: string;
  scheduled: boolean;
  done: boolean;
  /** Compact reading of the entry, if any. */
  value: string | null;
  /** After today, or before the habit started. */
  future: boolean;
}

export interface HabitStatsDto {
  habit: HabitDto;
  /** Scheduled days so far in the period (today counts once it's done). */
  scheduled: number;
  /** Of those, days the habit was done. */
  completed: number;
  /** Done on days it wasn't scheduled. */
  bonus: number;
  /** Avoid habits: days in the period an entry crossed the line. */
  slips: number;
  /** Scheduled days still ahead in the period, including today if not done yet. */
  remaining: number;
  /** completed / scheduled, or null with nothing scheduled yet. */
  rate: number | null;
  /** Mean of logged values in the period (numeric types only). */
  average: number | null;
  target: number | null;
  /** Scheduled days done in a row, through today (an unfinished today doesn't break it). */
  currentStreak: number;
  bestStreak: number;
  bestStreakEnd: string | null;
  days: HabitDayStat[];
  /** Latest entries in the period, newest first (up to 5). */
  recent: { date: string; value: string }[];
}

export interface HabitStatsResponseDto {
  range: HabitStatRange;
  start: string;
  end: string;
  today: string;
  habits: HabitStatsDto[];
}

/** The calendar period of `range` that contains `date`. */
export function statPeriod(
  range: HabitStatRange,
  date: string,
  weekStart: number,
): { start: string; end: string } {
  if (range === "season") {
    const season = seasonForDate(date);
    return { start: season.startsOn, end: season.endsOn };
  }
  if (range === "month") {
    const [y, m] = date.split("-").map(Number) as [number, number];
    const start = `${y}-${String(m).padStart(2, "0")}-01`;
    const next = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
    return { start, end: addDays(next, -1) };
  }
  let start = date;
  while (dayOfWeek(start) !== weekStart) start = addDays(start, -1);
  return { start, end: addDays(start, 6) };
}

/** Current and best runs of scheduled days done, from the habit's start through today. */
export function habitStreaks(
  startsOn: string,
  days: number[],
  doneDates: Set<string>,
  today: string,
): { current: number; best: number; bestEnd: string | null } {
  let best = 0;
  let bestEnd: string | null = null;
  let run = 0;
  for (let d = startsOn; d <= today; d = addDays(d, 1)) {
    if (!days.includes(dayOfWeek(d))) continue;
    if (doneDates.has(d)) {
      run++;
      if (run > best) {
        best = run;
        bestEnd = d;
      }
    } else if (d !== today) {
      run = 0;
    }
  }
  return { current: run, best, bestEnd };
}

/** Stats for one habit over [start, end], given every entry since it started. */
export function habitStats(
  habit: HabitDto,
  entries: Map<string, HabitEntryValue>,
  period: { start: string; end: string },
  today: string,
): HabitStatsDto {
  const doneDates = new Set<string>();
  // Every day counts, not just logged ones: an avoid habit with no entry was kept.
  for (let d = habit.startsOn; d <= today; d = addDays(d, 1)) {
    if (isEntryDone(habit.type, habit.config, entries.get(d) ?? null)) doneDates.add(d);
  }
  const streaks = habitStreaks(habit.startsOn, habit.days, doneDates, today);

  let scheduled = 0;
  let completed = 0;
  let bonus = 0;
  let slips = 0;
  let remaining = 0;
  const values: number[] = [];
  const days: HabitDayStat[] = [];
  const recent: { date: string; value: string }[] = [];
  for (let d = period.start; d <= period.end; d = addDays(d, 1)) {
    const onSchedule = habit.days.includes(dayOfWeek(d)) && d >= habit.startsOn;
    const done = doneDates.has(d);
    const entry = entries.get(d) ?? null;
    const future = d > today || d < habit.startsOn;
    days.push({
      date: d,
      scheduled: onSchedule,
      done,
      value: entry ? formatHabitEntry(habit.type, habit.config, entry) : null,
      future,
    });
    if (!future && isSlip(habit.type, habit.config, entry)) slips++;
    if (entry && !future) {
      if (AVERAGED.has(habit.type) && entry.num !== null) values.push(entry.num);
      recent.unshift({ date: d, value: formatHabitEntry(habit.type, habit.config, entry) });
    }
    if (d > today || d < habit.startsOn) {
      if (onSchedule) remaining++;
      continue;
    }
    if (onSchedule) {
      if (done) {
        scheduled++;
        completed++;
      } else if (d === today) {
        remaining++;
      } else {
        scheduled++;
      }
    } else if (done) {
      bonus++;
    }
  }

  return {
    habit,
    scheduled,
    completed,
    bonus,
    slips,
    remaining,
    rate: scheduled ? completed / scheduled : null,
    average: values.length
      ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10
      : null,
    target: habit.type === "counter" || habit.type === "duration" ? habit.config.target : null,
    currentStreak: streaks.current,
    bestStreak: streaks.best,
    bestStreakEnd: streaks.bestEnd,
    days,
    recent: recent.slice(0, 5),
  };
}
