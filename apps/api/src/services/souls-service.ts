import {
  addDays,
  BAD_DAY_NET,
  bossSouls,
  computeNodeValues,
  emptyEarnings,
  foldSouls,
  isHabitDone,
  isSlip,
  leafIds,
  leafLevelsAsOf,
  leafValuesFromEvents,
  levelCost,
  levelFromRating,
  localDateIn,
  objectiveLength,
  SOULS_PER_HABIT,
  SOULS_PER_POINT,
  SOULS_PER_WORKOUT,
  STAT_LEVEL_MAX,
  type DeathCause,
  type HabitConfig,
  type LevelUpBody,
  type RatingNodeDto,
  type SeasonCardDto,
  type SeasonDto,
  type SoulDayInput,
  type SoulEarnings,
  type SoulsDto,
} from "@rlo/shared";
import type { Database } from "../db/client";
import { badRequest, conflict, notFound } from "../errors";
import * as eventRepo from "../repos/rating-event-repo";
import * as habitRepo from "../repos/habit-repo";
import * as nodeRepo from "../repos/rating-node-repo";
import * as pauseRepo from "../repos/pause-repo";
import * as recapRepo from "../repos/recap-repo";
import * as seasonRepo from "../repos/season-repo";
import * as soulRepo from "../repos/soul-repo";
import * as userRepo from "../repos/user-repo";
import * as workoutRepo from "../repos/workout-repo";
import { datedEvents } from "./event-dates";
import { listObjectives } from "./objective-service";
import { localHour } from "./scheduler";
import { ensureCurrentSeason } from "./season-service";

/** Yesterday stays open until the morning auto-recap has had its run (DESIGN.md §8.6). */
const SETTLE_HOUR = 5;

/**
 * Each leaf's stat level in a Souls season (DESIGN.md §4.7). Leaves without a starting level get
 * one now: last season's level by lineage (New Game+) when that season was Souls too, otherwise
 * from the current rating. The day they're written starts the run.
 */
export async function soulLevels(
  db: Database,
  userId: string,
  season: SeasonDto,
  nodes: RatingNodeDto[],
  ratings: Map<string, number>,
  today: string,
) {
  let rows = await soulRepo.findBySeason(db, season.id);
  const leaves = leafIds(nodes);
  const started = new Set(rows.filter((r) => r.kind === "start").map((r) => r.nodeId));
  const missing = leaves.filter((id) => !started.has(id));
  if (missing.length) {
    const lineages = new Map(
      (await nodeRepo.findLineages(db, season.id)).map((n) => [n.id, n.lineageId]),
    );
    const { previous } = await earlierSeasons(db, userId, season);
    const carried =
      previous?.mode === "souls"
        ? await soulRepo.findLevelsByLineage(
            db,
            previous.id,
            missing.map((id) => lineages.get(id)!).filter(Boolean),
          )
        : new Map<string, number>();
    await soulRepo.insertStarts(
      db,
      missing.map((nodeId) => ({
        userId,
        seasonId: season.id,
        nodeId,
        kind: "start" as const,
        levels:
          carried.get(lineages.get(nodeId) ?? "") ?? levelFromRating(ratings.get(nodeId) ?? null),
        afterDate: today,
      })),
    );
    rows = await soulRepo.findBySeason(db, season.id);
  }
  const leafSet = new Set(leaves);
  const levels = new Map<string, number>();
  const gained = new Map<string, number>();
  for (const r of rows) {
    if (!leafSet.has(r.nodeId)) continue;
    levels.set(r.nodeId, Math.min(STAT_LEVEL_MAX, (levels.get(r.nodeId) ?? 0) + r.levels));
    if (r.kind === "level_up") gained.set(r.nodeId, (gained.get(r.nodeId) ?? 0) + r.levels);
  }
  const startedOn =
    rows
      .filter((r) => r.kind === "start")
      .map((r) => r.afterDate)
      .sort()[0] ?? today;
  return { rows, levels, gained, startedOn };
}

/** Each node's change in level over the last 7 days (leaves started since count from 0 change). */
export function levelTrends(
  nodes: RatingNodeDto[],
  rows: soulRepo.SoulLevelRow[],
  today: string,
): Map<string, number> {
  const now = computeNodeValues(nodes, leafLevelsAsOf(rows, today));
  const weekAgo = leafLevelsAsOf(rows, addDays(today, -7));
  // A leaf started this week trends from its starting level, not from nothing.
  for (const r of rows)
    if (r.kind === "start" && !weekAgo.has(r.nodeId)) weekAgo.set(r.nodeId, r.levels);
  const before = computeNodeValues(nodes, weekAgo);
  const out = new Map<string, number>();
  for (const [id, value] of now) {
    const prior = before.get(id);
    if (prior !== undefined) out.set(id, Math.round((value - prior) * 100) / 100);
  }
  return out;
}

/**
 * The archived season straight before `season`, and its New Game+ cycle: how many Souls seasons
 * in a row lead up to it.
 */
async function earlierSeasons(db: Database, userId: string, season: SeasonDto) {
  const before = (await seasonRepo.findArchived(db, userId)).filter(
    (s) => s.startsOn < season.startsOn,
  );
  let cycle = 0;
  while (before[cycle]?.mode === "souls") cycle++;
  return { previous: before[0], cycle };
}

/**
 * The season's run, day by day through `through`: what each day earned and whether it was a
 * death. `settled` closes every day (a finished season); otherwise today and early-morning
 * yesterday stay in play.
 */
async function buildRun(
  db: Database,
  userId: string,
  season: SeasonDto,
  from: string,
  through: string,
  timezone: string,
  settled = false,
) {
  const today = through;
  const [recaps, dated, habits, workouts, objectives, pauses] = await Promise.all([
    recapRepo.findDailyBetween(db, userId, from, today),
    eventRepo.findActiveWithDates(db, season.id).then(datedEvents),
    habitRepo.findAllByUser(db, userId),
    workoutRepo.findCompleted(db, userId),
    listObjectives(db, userId),
    pauseRepo.findByUser(db, userId),
  ]);
  const entries = await habitRepo.findEntriesBetween(
    db,
    habits.map((h) => h.id),
    from,
    today,
  );

  const days = new Map<string, SoulDayInput & { open: boolean }>();
  const yesterday = addDays(today, -1);
  const lateEnough = localHour(timezone, new Date()) >= SETTLE_HOUR;
  for (let d = from; d <= today; d = addDays(d, 1)) {
    days.set(d, {
      date: d,
      earned: emptyEarnings(),
      logged: false,
      paused: pauses.some((p) => p.startsOn <= d && (p.endsOn === null || p.endsOn >= d)),
      deaths: [],
      open: !settled && (d === today || (d === yesterday && !lateEnough)),
    });
  }
  const earn = (date: string | null, kind: keyof SoulEarnings, souls: number) => {
    const day = date ? days.get(date) : undefined;
    if (day) day.earned[kind] += souls;
  };
  const die = (date: string, cause: DeathCause) => {
    const day = days.get(date);
    if (day && !day.deaths.includes(cause)) day.deaths.push(cause);
  };

  for (const r of recaps) {
    const day = days.get(r.periodStart);
    if (day) day.logged = true;
  }
  const net = new Map<string, number>();
  for (const e of dated) {
    if (!e.date || e.date < from) continue;
    if (e.source === "daily_recap") {
      earn(e.date, "recap", Math.max(0, e.delta) * SOULS_PER_POINT);
      net.set(e.date, (net.get(e.date) ?? 0) + e.delta);
    } else if (e.source === "weekly_review") {
      earn(e.date, "weekly", e.delta * SOULS_PER_POINT);
    }
  }
  for (const [date, sum] of net) if (sum <= BAD_DAY_NET) die(date, "bad_day");

  const habitById = new Map(habits.map((h) => [h.id, h]));
  for (const e of entries) {
    const h = habitById.get(e.habitId);
    if (!h || h.type === "group") continue;
    const value = { num: e.valueNum, text: e.valueText };
    const config = h.config as HabitConfig;
    if (isSlip(h.type, config, value)) die(e.localDate, "slip");
    else if (isHabitDone(h.type, config, value)) earn(e.localDate, "habits", SOULS_PER_HABIT);
  }
  for (const w of workouts) earn(w.localDate, "workouts", SOULS_PER_WORKOUT);
  for (const o of objectives) {
    const won = o.progress.completedOn;
    if (won) earn(won, "bosses", bossSouls(objectiveLength(o.startsOn, o.endsOn)));
  }
  // A settled day with no recap is a missed day; the run's first day is a grace day.
  for (const day of days.values()) {
    if (!day.open && !day.logged && day.date > from) die(day.date, "missed");
  }
  for (const day of days.values()) {
    day.earned.recap = Math.round(day.earned.recap);
    day.earned.weekly = Math.round(day.earned.weekly);
  }
  return [...days.values()];
}

/**
 * One Souls season's run replayed: levels, every day, and the souls state. A finished season
 * (`through` its end) settles every day.
 */
async function replaySeason(
  db: Database,
  userId: string,
  season: SeasonDto,
  timezone: string,
  today: string,
  through = today,
) {
  const [nodes, events] = await Promise.all([
    nodeRepo.findActiveBySeason(db, season.id),
    eventRepo.findActiveBySeason(db, season.id),
  ]);
  const ratings = leafValuesFromEvents(events);
  const levels = await soulLevels(db, userId, season, nodes, ratings, today);
  const ngp = await earlierSeasons(db, userId, season);
  const snapshot = ngp.previous?.finalSnapshot as Partial<SeasonCardDto> | null | undefined;
  const carried = ngp.previous?.mode === "souls" ? Math.max(0, snapshot?.soulsHeld ?? 0) : 0;
  const days =
    levels.startedOn <= through
      ? await buildRun(db, userId, season, levels.startedOn, through, timezone, through < today)
      : [];
  const state = foldSouls(
    days,
    levels.rows
      .filter((r) => r.kind === "level_up")
      .map((r) => ({ afterDate: r.afterDate, cost: r.cost })),
    carried,
  );
  return { season, today, nodes, ratings, levels, days, state, carried, cycle: ngp.cycle };
}

async function loadSouls(db: Database, userId: string) {
  const season = await ensureCurrentSeason(db, userId);
  if (!season) throw notFound("No season yet. Finish onboarding first.");
  if (season.mode !== "souls") throw notFound("This season isn't a Souls season");
  const user = await userRepo.findById(db, userId);
  const timezone = user?.timezone ?? "UTC";
  return replaySeason(db, userId, season, timezone, localDateIn(timezone));
}

/**
 * A finished Souls season's final state, for its season card at rollover: each node's level,
 * the Soul Level, and the unspent souls New Game+ carries in (DESIGN.md §4.7).
 */
export async function finalSouls(
  db: Database,
  userId: string,
  season: SeasonDto,
  timezone: string,
  today: string,
) {
  const { nodes, levels, state } = await replaySeason(
    db,
    userId,
    season,
    timezone,
    today,
    season.endsOn < today ? season.endsOn : today,
  );
  const rolled = computeNodeValues(nodes, levels.levels);
  const root = nodes.find((n) => n.parentId === null);
  return {
    levels: rolled,
    soulLevel: root ? (rolled.get(root.id) ?? null) : null,
    held: Math.max(0, state.held),
  };
}

export async function getSouls(db: Database, userId: string): Promise<SoulsDto> {
  const { season, today, nodes, ratings, levels, days, state, carried, cycle } = await loadSouls(
    db,
    userId,
  );
  const leaves = new Set(leafIds(nodes));
  const rolledLevels = computeNodeValues(nodes, levels.levels);
  const rolledRatings = computeNodeValues(nodes, ratings);
  const root = nodes.find((n) => n.parentId === null);
  const input = new Map(days.map((d) => [d.date, d]));
  return {
    season,
    today,
    startedOn: levels.startedOn,
    held: state.held,
    bloodstain: state.bloodstain,
    carried,
    cycle,
    earned: state.earned,
    spent: state.spent,
    lost: state.lost,
    deaths: state.deaths,
    soulLevel: root ? (rolledLevels.get(root.id) ?? null) : null,
    stats: nodes.map((n) => {
      const level = rolledLevels.get(n.id) ?? null;
      const leaf = leaves.has(n.id);
      return {
        id: n.id,
        parentId: n.parentId,
        name: n.name,
        depth: n.depth,
        level: level === null ? null : leaf ? level : Math.round(level * 10) / 10,
        cost: leaf && level !== null ? levelCost(level) : null,
        gained: levels.gained.get(n.id) ?? 0,
        rating: rolledRatings.get(n.id) ?? null,
      };
    }),
    days: state.days
      .map((d) => {
        const day = input.get(d.date)!;
        return { ...d, earned: day.earned, paused: day.paused, open: day.open };
      })
      .reverse(),
  };
}

/** Buys `levels` levels of one stat with held souls, paid after today's earnings. */
export async function levelUp(
  db: Database,
  userId: string,
  body: Required<LevelUpBody>,
): Promise<SoulsDto> {
  const { season, today, nodes, levels, state } = await loadSouls(db, userId);
  if (!leafIds(nodes).includes(body.nodeId)) {
    throw badRequest("Only attributes without sub-attributes can be leveled");
  }
  let level = levels.levels.get(body.nodeId)!;
  let total = 0;
  const rows = [];
  for (let i = 0; i < body.levels; i++) {
    const cost = levelCost(level);
    if (cost === null) throw conflict(`That stat is already at level ${STAT_LEVEL_MAX}`);
    total += cost;
    rows.push({
      userId,
      seasonId: season.id,
      nodeId: body.nodeId,
      kind: "level_up" as const,
      levels: 1,
      cost,
      afterDate: today,
    });
    level++;
  }
  if (total > state.held) throw conflict("Not enough souls for that");
  await soulRepo.insertLevelUps(db, rows);
  return getSouls(db, userId);
}
