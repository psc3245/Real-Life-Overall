import {
  isHabitDone,
  localDateIn,
  type HabitConfig,
  type SeasonCardDto,
  type SeasonDetailDto,
} from "@rlo/shared";
import type { Database } from "../db/client";
import { notFound } from "../errors";
import * as badgeRepo from "../repos/badge-repo";
import * as decayRepo from "../repos/decay-repo";
import * as habitRepo from "../repos/habit-repo";
import * as nodeRepo from "../repos/rating-node-repo";
import * as recapRepo from "../repos/recap-repo";
import * as seasonRepo from "../repos/season-repo";
import * as userRepo from "../repos/user-repo";
import { longestRun, toBadgeDto } from "./badge-service";
import { activityBetween, historyBetween } from "./history-service";
import { ensureCurrentSeason } from "./season-service";

/**
 * One season in full: start and end values per node, daily history, logging stats, badges and
 * weekly reviews. Archived seasons keep their ledger, so they're recomputed the same way.
 */
export async function getSeasonDetail(
  db: Database,
  userId: string,
  id: string,
): Promise<SeasonDetailDto> {
  await ensureCurrentSeason(db, userId);
  const season = await seasonRepo.findById(db, id);
  const user = await userRepo.findById(db, userId);
  if (!season || season.userId !== userId || !user) throw notFound("Season not found");

  const today = localDateIn(user.timezone);
  const current = season.status !== "archived";
  const through = current && today < season.endsOn ? today : season.endsOn;
  const onboarded = await decayRepo.onboardedAt(db, season.id);
  const firstRated = onboarded ? localDateIn(user.timezone, onboarded) : season.startsOn;
  const from = firstRated > season.startsOn ? firstRated : season.startsOn;

  const nodes = await nodeRepo.findActiveBySeason(db, season.id);
  const [history, activity, weekly, badgeRows, habits] = await Promise.all([
    nodes.length && from <= through
      ? historyBetween(db, season.id, nodes, from, through, season.mode)
      : { dates: [], series: [] },
    from <= through ? activityBetween(db, userId, season.id, from, through, season.mode) : [],
    recapRepo.findWeeklyBySeason(db, userId, season.id),
    badgeRepo.findByUser(db, userId),
    habitRepo.findAllByUser(db, userId),
  ]);
  const entries = await habitRepo.findEntriesBetween(
    db,
    habits.map((h) => h.id),
    season.startsOn,
    through,
  );
  const habitById = new Map(habits.map((h) => [h.id, h]));
  const habitCompletions = entries.filter((e) => {
    const h = habitById.get(e.habitId);
    return (
      h && isHabitDone(h.type, h.config as HabitConfig, { num: e.valueNum, text: e.valueText })
    );
  }).length;

  const seriesFor = new Map(history.series.map((s) => [s.nodeId, s.values]));
  const firstValue = (id: string) => seriesFor.get(id)?.find((v) => v !== null) ?? null;
  const lastValue = (id: string) =>
    [...(seriesFor.get(id) ?? [])].reverse().find((v) => v !== null) ?? null;
  // A season without tree rows (e.g. imported or seeded as a card only) falls back to its card.
  const snapshot = (season.finalSnapshot ?? null) as Partial<SeasonCardDto> | null;
  const detailNodes = nodes.length
    ? nodes.map((n) => ({
        id: n.id,
        parentId: n.parentId,
        name: n.name,
        depth: n.depth,
        start: firstValue(n.id),
        end: lastValue(n.id),
      }))
    : (snapshot?.nodes ?? []).map((n) => ({
        id: n.id,
        parentId: n.parentId,
        name: n.name,
        depth: n.depth,
        start: null,
        end: season.mode === "growth" ? (n.growth ?? null) : n.value,
      }));

  const logged = activity.filter((a) => a.logged).map((a) => a.date);
  return {
    id: season.id,
    label: season.label,
    startsOn: season.startsOn,
    endsOn: season.endsOn,
    current,
    mode: season.mode,
    through,
    archetype: season.archetype ?? snapshot?.archetype ?? null,
    nodes: detailNodes,
    history,
    stats: {
      daysLogged: logged.length,
      daysRecapped: activity.filter((a) => a.recapped).length,
      bestLoggingStreak: longestRun(logged),
      habitCompletions,
      weeklyReviews: weekly.length,
    },
    badges: badgeRows.filter((b) => b.seasonId === season.id).map(toBadgeDto),
    weeks: weekly.map((w) => ({
      id: w.id,
      weekStart: w.periodStart,
      weekEnd: w.periodEnd,
      narrative: w.narrative,
    })),
  };
}
