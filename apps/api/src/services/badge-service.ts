import {
  addDays,
  BADGE_CATALOG,
  BADGE_TIERS,
  BADGE_TIER_LABELS,
  computeNodeValues,
  earnedTiers,
  habitStreaks,
  isHabitDone,
  leafIds,
  leafValuesFromEvents,
  localDateIn,
  tierFor,
  type BadgeMetrics,
  type BadgesDto,
  type EarnedBadgeDto,
  type HabitConfig,
} from "@rlo/shared";
import { and, count, eq } from "drizzle-orm";
import type { Database } from "../db/client";
import { dayLogs, recaps } from "../db/schema";
import * as badgeRepo from "../repos/badge-repo";
import type { BadgeRow } from "../repos/badge-repo";
import * as habitRepo from "../repos/habit-repo";
import * as eventRepo from "../repos/rating-event-repo";
import * as userRepo from "../repos/user-repo";
import { loadLeafContext } from "./habit-service";

export function toBadgeDto(row: BadgeRow): EarnedBadgeDto {
  return {
    key: row.badgeKey,
    kind: row.kind,
    name: row.name,
    description: row.description,
    tier: row.tier,
    earnedAt: row.earnedAt.toISOString(),
  };
}

/** Longest run of consecutive dates in a set. */
export function longestRun(dates: Iterable<string>): number {
  const sorted = [...new Set(dates)].sort();
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const d of sorted) {
    run = prev && addDays(prev, 1) === d ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return best;
}

/**
 * Longest streak of a habit done on consecutive scheduled days. Unscheduled days don't break it;
 * today doesn't break it either (the day isn't over).
 */
export function bestHabitStreak(
  startsOn: string,
  days: number[],
  doneDates: Set<string>,
  today: string,
): number {
  return habitStreaks(startsOn, days, doneDates, today).best;
}

export async function computeMetrics(db: Database, userId: string): Promise<BadgeMetrics> {
  const user = await userRepo.findById(db, userId);
  const ctx = await loadLeafContext(db, userId);
  const today = localDateIn(user?.timezone ?? "UTC");

  const [logs, habits, recapCounts] = await Promise.all([
    db
      .select({ date: dayLogs.localDate, journal: dayLogs.journal, prompts: dayLogs.prompts })
      .from(dayLogs)
      .where(eq(dayLogs.userId, userId)),
    habitRepo.findAllByUser(db, userId),
    db
      .select({ kind: recaps.kind, n: count() })
      .from(recaps)
      .where(and(eq(recaps.userId, userId), eq(recaps.status, "active")))
      .groupBy(recaps.kind),
  ]);
  const entries = await habitRepo.findEntriesBetween(
    db,
    habits.map((h) => h.id),
    "1970-01-01",
    today,
  );

  const habitById = new Map(habits.map((h) => [h.id, h]));
  const doneByHabit = new Map<string, Set<string>>();
  for (const e of entries) {
    const h = habitById.get(e.habitId)!;
    if (!isHabitDone(h.type, h.config as HabitConfig, { num: e.valueNum, text: e.valueText }))
      continue;
    if (!doneByHabit.has(e.habitId)) doneByHabit.set(e.habitId, new Set());
    doneByHabit.get(e.habitId)!.add(e.localDate);
  }

  const loggedDates = [
    ...entries.map((e) => e.localDate),
    ...logs
      .filter(
        (l) =>
          l.journal.trim() ||
          (l.prompts as { answer: string | null }[]).some((p) => p.answer?.trim()),
      )
      .map((l) => l.date),
  ];

  let biggestGain = 0;
  let lowestCategory = 0;
  let bestAttribute = 0;
  if (ctx) {
    const events = await eventRepo.findActiveBySeason(db, ctx.season.id);
    const leaves = leafValuesFromEvents(events);
    const start = leafValuesFromEvents(
      events.filter((e) => e.source === "onboarding" || e.source === "recalibration"),
    );
    for (const [id, value] of leaves)
      biggestGain = Math.max(biggestGain, value - (start.get(id) ?? value));
    const values = computeNodeValues(ctx.nodes, leaves);
    const root = ctx.nodes.find((n) => n.parentId === null);
    const categories = ctx.nodes.filter((n) => n.parentId === root?.id);
    lowestCategory = categories.length
      ? Math.min(...categories.map((c) => values.get(c.id) ?? 0))
      : 0;
    bestAttribute = Math.max(0, ...leafIds(ctx.nodes).map((id) => values.get(id) ?? 0));
  }

  const recapCount = (kind: "daily" | "weekly") =>
    Number(recapCounts.find((r) => r.kind === kind)?.n ?? 0);
  return {
    bestLoggingStreak: longestRun(loggedDates),
    recappedDays: recapCount("daily"),
    habitCompletions: [...doneByHabit.values()].reduce((s, d) => s + d.size, 0),
    bestHabitStreak: Math.max(
      0,
      ...habits.map((h) =>
        bestHabitStreak(h.startsOn, h.days, doneByHabit.get(h.id) ?? new Set(), today),
      ),
    ),
    biggestGain: Math.round(biggestGain * 100) / 100,
    lowestCategory: Math.round(lowestCategory * 100) / 100,
    bestAttribute: Math.round(bestAttribute * 100) / 100,
    weeklyReviews: recapCount("weekly"),
  };
}

/** Awards any catalog tiers newly reached; returns the new ones. Idempotent. */
export async function awardBadges(
  db: Database,
  userId: string,
  recapId: string | null = null,
): Promise<EarnedBadgeDto[]> {
  const metrics = await computeMetrics(db, userId);
  const ctx = await loadLeafContext(db, userId);
  const catalog = new Map(BADGE_CATALOG.map((b) => [b.key, b]));
  const rows = await badgeRepo.insertNew(
    db,
    earnedTiers(metrics).map(({ key, tier }) => ({
      userId,
      seasonId: ctx?.season.id ?? null,
      kind: "catalog" as const,
      badgeKey: key,
      tier,
      name: `${catalog.get(key)!.name} · ${BADGE_TIER_LABELS[tier]}`,
      description: catalog.get(key)!.description,
      recapId,
    })),
  );
  return rows.map(toBadgeDto);
}

export async function getBadges(db: Database, userId: string): Promise<BadgesDto> {
  await awardBadges(db, userId);
  const [metrics, rows] = await Promise.all([
    computeMetrics(db, userId),
    badgeRepo.findByUser(db, userId),
  ]);
  return {
    progress: BADGE_CATALOG.map((b) => {
      const tier = tierFor(b, metrics);
      const reached = tier ? ["bronze", "silver", "gold", "hof"].indexOf(tier) + 1 : 0;
      return {
        key: b.key,
        name: b.name,
        description: b.description,
        unit: b.unit,
        value: metrics[b.metric],
        tier,
        next: reached < 4 ? b.thresholds[reached]! : null,
        hint: b.hint,
        thresholds: b.thresholds,
        earned: rows
          .filter((r) => r.kind === "catalog" && r.badgeKey === b.key && r.tier)
          .map((r) => ({ tier: r.tier!, earnedAt: r.earnedAt.toISOString() }))
          .sort((x, y) => BADGE_TIERS.indexOf(x.tier) - BADGE_TIERS.indexOf(y.tier)),
      };
    }),
    personal: rows.filter((r) => r.kind === "personal").map(toBadgeDto),
    recent: rows.slice(0, 6).map(toBadgeDto),
  };
}

/** Badge DTOs per recap, for recap and weekly views. */
export async function badgesByRecap(db: Database, recapIds: string[]) {
  const rows = await badgeRepo.findByRecaps(db, recapIds);
  const map = new Map<string, EarnedBadgeDto[]>();
  for (const r of rows) {
    if (!map.has(r.recapId!)) map.set(r.recapId!, []);
    map.get(r.recapId!)!.push(toBadgeDto(r));
  }
  return map;
}
