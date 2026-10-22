import {
  addDays,
  computeNodeValues,
  leafValuesFromEvents,
  localDateIn,
  MAX_HISTORY_DAYS,
  type ActivityDayDto,
  type HistoryDto,
} from "@rlo/shared";
import type { Database } from "../db/client";
import * as dayRepo from "../repos/day-repo";
import * as decayRepo from "../repos/decay-repo";
import * as habitRepo from "../repos/habit-repo";
import * as eventRepo from "../repos/rating-event-repo";
import * as recapRepo from "../repos/recap-repo";
import * as userRepo from "../repos/user-repo";
import { applyDecay } from "./decay-service";
import { asOf, datedEvents } from "./event-dates";
import { loadLeafContext } from "./habit-service";

/** Shared setup: the season context, today, and the first day with ratings. */
async function rangeFor(db: Database, userId: string, days: number) {
  const ctx = await loadLeafContext(db, userId);
  const user = await userRepo.findById(db, userId);
  if (!ctx || !user) return null;
  await applyDecay(db, userId);
  const onboarded = await decayRepo.onboardedAt(db, ctx.season.id);
  const today = localDateIn(user.timezone);
  const first = onboarded ? localDateIn(user.timezone, onboarded) : today;
  const span = Math.min(Math.max(1, days), MAX_HISTORY_DAYS);
  const from = first > addDays(today, -(span - 1)) ? first : addDays(today, -(span - 1));
  return { ctx, today, from };
}

const datesBetween = (from: string, to: string) => {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
};

/** Every node's value at the end of each day, rolled up from the ledger. */
export async function getHistory(db: Database, userId: string, days: number): Promise<HistoryDto> {
  const range = await rangeFor(db, userId, days);
  if (!range) return { dates: [], series: [] };
  const { ctx, today, from } = range;
  const events = datedEvents(await eventRepo.findActiveWithDates(db, ctx.season.id));
  const dates = datesBetween(from, today);
  const daily = dates.map((d) =>
    computeNodeValues(ctx.nodes, leafValuesFromEvents(asOf(events, d))),
  );
  return {
    dates,
    series: ctx.nodes.map((n) => ({
      nodeId: n.id,
      values: daily.map((values) => values.get(n.id) ?? null),
    })),
  };
}

/** Per-day logging and rating movement, for the calendar heatmap. */
export async function getActivity(
  db: Database,
  userId: string,
  days: number,
): Promise<ActivityDayDto[]> {
  const range = await rangeFor(db, userId, days);
  if (!range) return [];
  const { ctx, today, from } = range;
  const [events, logs, recaps, habits] = await Promise.all([
    eventRepo.findActiveWithDates(db, ctx.season.id).then(datedEvents),
    dayRepo.findWithPromptsBetween(db, userId, from, today),
    recapRepo.findDailyBetween(db, userId, from, today),
    habitRepo.findAllByUser(db, userId),
  ]);
  const entries = await habitRepo.findEntriesBetween(
    db,
    habits.map((h) => h.id),
    from,
    today,
  );
  const logged = new Set([
    ...entries.map((e) => e.localDate),
    ...logs
      .filter(
        (l) =>
          l.journal.trim() ||
          (l.prompts as { answer: string | null }[]).some((p) => p.answer?.trim()),
      )
      .map((l) => l.localDate),
  ]);
  const recapped = new Set(recaps.map((r) => r.periodStart));
  const round = (n: number) => Math.round(n * 100) / 100;
  return datesBetween(from, today).map((date) => {
    const day = events.filter((e) => e.date === date);
    return {
      date,
      logged: logged.has(date),
      recapped: recapped.has(date),
      gain: round(day.filter((e) => e.delta > 0).reduce((s, e) => s + e.delta, 0)),
      loss: round(day.filter((e) => e.delta < 0).reduce((s, e) => s + e.delta, 0)),
    };
  });
}

/** Each node's change over the last 7 days. */
export function trends(
  nodes: Parameters<typeof computeNodeValues>[0],
  events: ReturnType<typeof datedEvents>,
  today: string,
): Map<string, number> {
  const now = computeNodeValues(nodes, leafValuesFromEvents(events));
  const before = computeNodeValues(nodes, leafValuesFromEvents(asOf(events, addDays(today, -7))));
  const out = new Map<string, number>();
  for (const [id, value] of now) {
    const prior = before.get(id);
    if (prior !== undefined) out.set(id, Math.round((value - prior) * 100) / 100);
  }
  return out;
}
