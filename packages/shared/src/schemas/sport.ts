import type { ExerciseRecordsDto } from "../records";
import type { WorkoutDto } from "./workouts";

/**
 * Sports (DESIGN.md §7.5): practices are live workouts with `kind = sport`, built from the
 * library's sport & skill drills. The Sports tab sums practices and follows each drill.
 */

export interface SportTotalsDto {
  sessions: number;
  durationS: number;
}

/** One sport & skill drill, from every finished workout that included it. */
export interface SportSkillDto {
  exerciseId: string;
  sessions: number;
  lastDone: string;
  /** The drill's headline record (the exercise's `headline`) and its all-time best. */
  headline: keyof ExerciseRecordsDto;
  best: number | null;
  /** Makes / attempts drills: totals over the last 30 days. */
  recent: { makes: number; attempts: number } | null;
}

/** The Sports tab. */
export interface SportOverviewDto {
  /** Practices in the last 7 and 30 days, today included. */
  week: SportTotalsDto;
  month: SportTotalsDto;
  /** Most recently done first. */
  skills: SportSkillDto[];
  /** The latest practices, newest first. */
  recent: WorkoutDto[];
}

/** "82%" of makes over attempts; null with no attempts. */
export function makePct(makes: number, attempts: number): number | null {
  return attempts > 0 ? Math.round((100 * makes) / attempts) : null;
}
