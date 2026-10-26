import {
  addDays,
  computeDecay,
  isHabitDone,
  leafValuesFromEvents,
  localDateIn,
  type HabitConfig,
} from "@rlo/shared";
import type { Database } from "../db/client";
import * as decayRepo from "../repos/decay-repo";
import * as decayRuleRepo from "../repos/decay-rule-repo";
import * as habitRepo from "../repos/habit-repo";
import * as pauseRepo from "../repos/pause-repo";
import type { PauseRow } from "../repos/pause-repo";
import * as eventRepo from "../repos/rating-event-repo";
import * as userRepo from "../repos/user-repo";
import { loadLeafContext } from "./habit-service";

/** Longest gap one catch-up will fill, to bound the work of a single request. */
export const MAX_DECAY_CATCH_UP_DAYS = 90;

export function pausedOn(pauses: PauseRow[]) {
  return (date: string) =>
    pauses.some((p) => p.startsOn <= date && (p.endsOn === null || date <= p.endsOn));
}

/**
 * Brings decay up to date through yesterday (in the user's timezone). Idempotent: days already
 * processed are skipped, so this is safe to call from cron, after recaps, and on reads.
 * Returns the number of days processed.
 */
export async function applyDecay(db: Database, userId: string): Promise<number> {
  const user = await userRepo.findById(db, userId);
  if (!user) return 0;
  const ctx = await loadLeafContext(db, userId);
  if (!ctx) return 0;
  const onboarded = await decayRepo.onboardedAt(db, ctx.season.id);
  if (!onboarded) return 0;

  const baseline = localDateIn(user.timezone, onboarded);
  const through = addDays(localDateIn(user.timezone), -1);
  const last = await decayRepo.latestRunDate(db, userId);
  let from = addDays(last && last > baseline ? last : baseline, 1);
  if (from > through) return 0;
  if (from < addDays(through, -MAX_DECAY_CATCH_UP_DAYS)) {
    from = addDays(through, -MAX_DECAY_CATCH_UP_DAYS);
  }

  const leafIds = [...ctx.leaves];
  const [rules, events, gains, habits, pauses] = await Promise.all([
    decayRuleRepo.findActiveByNodes(db, leafIds),
    eventRepo.findActiveBySeason(db, ctx.season.id),
    eventRepo.findRecapGains(db, ctx.season.id),
    habitRepo.findAllByUser(db, userId),
    pauseRepo.findByUser(db, userId),
  ]);

  // Activity: a recap raised the leaf that day, or a habit linked to it was completed.
  const activity = new Map<string, Set<string>>();
  const mark = (nodeId: string, date: string) => {
    if (!activity.has(nodeId)) activity.set(nodeId, new Set());
    activity.get(nodeId)!.add(date);
  };
  for (const g of gains) mark(g.nodeId, g.date);
  const links = await habitRepo.findLinks(
    db,
    habits.map((h) => h.id),
  );
  const entries = await habitRepo.findEntriesBetween(
    db,
    habits.map((h) => h.id),
    baseline,
    through,
  );
  const habitById = new Map(habits.map((h) => [h.id, h]));
  for (const e of entries) {
    const habit = habitById.get(e.habitId)!;
    const done = isHabitDone(habit.type, habit.config as HabitConfig, {
      num: e.valueNum,
      text: e.valueText,
    });
    if (!done) continue;
    for (const link of links.filter((l) => l.habitId === e.habitId)) {
      const nodeId = ctx.nodeByLineage.get(link.nodeLineageId);
      if (nodeId) mark(nodeId, e.localDate);
    }
  }

  // Leaves rated after onboarding (added by a tree change) start their own clock.
  const startedOn = new Map<string, string>();
  for (const e of events) {
    if ((e.source === "onboarding" || e.source === "recalibration") && !startedOn.has(e.nodeId)) {
      const date = localDateIn(user.timezone, e.createdAt);
      if (date > baseline) startedOn.set(e.nodeId, date);
    }
  }

  const days = computeDecay({
    from,
    through,
    baseline,
    startedOn,
    rules: new Map(rules.map((r) => [r.nodeId, r])),
    values: leafValuesFromEvents(events),
    activity,
    isPaused: pausedOn(pauses),
  });
  const names = new Map(ctx.nodes.map((n) => [n.id, n.name]));

  await db.transaction(async (tx) => {
    for (const day of days) {
      const runId = await decayRepo.insertRun(tx, {
        userId,
        seasonId: ctx.season.id,
        localDate: day.date,
        paused: day.paused,
      });
      await eventRepo.insertMany(
        tx,
        day.changes.map((c) => ({
          nodeId: c.nodeId,
          seasonId: ctx.season.id,
          delta: c.delta,
          source: "decay" as const,
          reason: `No ${names.get(c.nodeId) ?? "activity"} activity for ${c.idleDays} days.`,
          evidence: { idleDays: c.idleDays },
          decayRunId: runId,
        })),
      );
    }
  });
  return days.length;
}

/**
 * Something changed on or after `date` that affects activity (a recap, a backfilled habit, a
 * pause). Void decay from that day so the next catch-up recomputes it.
 */
export async function invalidateDecay(db: Database, userId: string, date: string) {
  await decayRepo.voidFrom(db, userId, date);
}
