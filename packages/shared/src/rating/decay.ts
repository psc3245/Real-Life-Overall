import { addDays } from "../dates";
import { clampRating } from "./math";

export interface DecayRule {
  graceDays: number;
  perDay: number;
  floor: number;
}

export interface DecayInput {
  /** Days to process, inclusive, oldest first (YYYY-MM-DD). */
  from: string;
  through: string;
  /** Activity before this date doesn't exist; treated as the last active day. */
  baseline: string;
  rules: ReadonlyMap<string, DecayRule>;
  /** Leaf values at the start of `from`. */
  values: ReadonlyMap<string, number>;
  /** Dates each leaf saw relevant activity. */
  activity: ReadonlyMap<string, ReadonlySet<string>>;
  isPaused: (date: string) => boolean;
}

export interface DecayChange {
  nodeId: string;
  delta: number;
  idleDays: number;
}

export interface DecayDay {
  date: string;
  paused: boolean;
  changes: DecayChange[];
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Applies decay rules day by day (DESIGN.md §5.4). A leaf fades once it has gone more than
 * `graceDays` non-paused days without activity, losing `perDay` per day but never dropping below
 * `floor`. Pure: callers persist the result.
 */
export function computeDecay(input: DecayInput): DecayDay[] {
  const values = new Map(input.values);
  // Non-paused days elapsed since each leaf's most recent activity.
  const idle = new Map<string, number>();
  for (const nodeId of input.rules.keys()) {
    let count = 0;
    for (let d = addDays(input.from, -1); d > input.baseline; d = addDays(d, -1)) {
      if (input.activity.get(nodeId)?.has(d)) break;
      if (!input.isPaused(d)) count += 1;
    }
    idle.set(nodeId, count);
  }

  const days: DecayDay[] = [];
  for (let date = input.from; date <= input.through; date = addDays(date, 1)) {
    const paused = input.isPaused(date);
    const changes: DecayChange[] = [];
    for (const [nodeId, rule] of input.rules) {
      if (input.activity.get(nodeId)?.has(date)) {
        idle.set(nodeId, 0);
        continue;
      }
      if (paused) continue;
      const idleDays = (idle.get(nodeId) ?? 0) + 1;
      idle.set(nodeId, idleDays);
      const value = values.get(nodeId);
      if (value === undefined || idleDays <= rule.graceDays || value <= rule.floor) continue;
      const delta = round2(-Math.min(rule.perDay, value - rule.floor));
      if (delta === 0) continue;
      values.set(nodeId, clampRating(value + delta));
      changes.push({ nodeId, delta, idleDays });
    }
    days.push({ date, paused, changes });
  }
  return days;
}
