import {
  addDays,
  bestSet,
  HABIT_TYPE_LABELS,
  HEADLINE_RECORD,
  isAvoid,
  isEntryDone,
  localDateIn,
  RECORD_LABELS,
  recordChartUnit,
  recordChartValue,
  recordsFromSets,
  toDisplayWeight,
  weightUnit,
  workoutVolume,
  CM_PER_INCH,
  type HabitDto,
  type MetricDto,
  type MetricPointDto,
  type MetricSeriesDto,
  type MetricSeriesResponseDto,
  type RatingNodeDto,
  type WorkoutExerciseDto,
} from "@rlo/shared";
import type { Database } from "../db/client";
import { badRequest, notFound } from "../errors";
import * as bodyRepo from "../repos/body-repo";
import * as dayRepo from "../repos/day-repo";
import * as decayRepo from "../repos/decay-repo";
import * as habitRepo from "../repos/habit-repo";
import * as userRepo from "../repos/user-repo";
import * as workoutRepo from "../repos/workout-repo";
import { listHabits, loadLeafContext } from "./habit-service";
import { historyBetween } from "./history-service";
import { objectivesWithDaily } from "./objective-service";
import { loadLookup } from "./workout-service";

const DEFAULT_DAYS = 90;
const WORKOUT_METRICS = {
  "workouts:count": { label: "Workouts", unit: "workouts" },
  "workouts:volume": { label: "Training volume", unit: "" },
  "workouts:duration": { label: "Training time", unit: "min" },
  "workouts:sets": { label: "Sets done", unit: "sets" },
} as const;

async function userOf(db: Database, userId: string) {
  const user = await userRepo.findById(db, userId);
  if (!user) throw notFound("User not found");
  return user;
}

function nodeLabel(node: RatingNodeDto, nodes: RatingNodeDto[]) {
  if (node.parentId === null) return { label: "Overall", detail: null };
  const path: string[] = [];
  let parent = nodes.find((n) => n.id === node.parentId);
  while (parent && parent.parentId !== null) {
    path.unshift(parent.name);
    parent = nodes.find((n) => n.id === parent!.parentId);
  }
  return { label: node.name, detail: path.length ? path.join(" › ") : "Category" };
}

/** What a habit's daily value means on a chart. */
function habitMetric(h: HabitDto): MetricDto {
  const numeric =
    h.type === "counter" || h.type === "duration" || h.type === "slider" || h.type === "rating";
  const unit =
    h.type === "counter"
      ? (h.config.unit ?? "")
      : h.type === "duration"
        ? "min"
        : h.type === "rating"
          ? "stars"
          : h.type === "slider"
            ? "pts"
            : isAvoid(h.config)
              ? "kept"
              : "done";
  return {
    id: `habit:${h.id}`,
    group: "habits",
    label: h.name,
    unit,
    kind:
      numeric && (h.type === "counter" || h.type === "duration")
        ? "amount"
        : numeric
          ? "session"
          : "amount",
    target:
      h.type === "counter" || h.type === "duration" || isAvoid(h.config) ? h.config.target : null,
    detail: `${isAvoid(h.config) ? "Avoid · " : ""}${HABIT_TYPE_LABELS[h.type]}`,
  };
}

/** Every metric this user can chart. */
export async function catalog(db: Database, userId: string): Promise<MetricDto[]> {
  const user = await userOf(db, userId);
  const [ctx, habits, goals, completed, lookup, body] = await Promise.all([
    loadLeafContext(db, userId),
    listHabits(db, userId),
    objectivesWithDaily(db, userId),
    workoutRepo.findCompleted(db, userId),
    loadLookup(db, userId),
    bodyRepo.findAll(db, userId),
  ]);
  const units = user.unitSystem;
  const out: MetricDto[] = [];

  for (const node of ctx?.nodes ?? []) {
    out.push({
      id: `rating:${node.id}`,
      group: "ratings",
      ...nodeLabel(node, ctx!.nodes),
      unit: ctx!.season.mode === "growth" ? "gained" : "rating",
      kind: "level",
      target: null,
    });
  }
  out.push({
    id: "habits:done",
    group: "habits",
    label: "Habits done",
    unit: "habits",
    kind: "amount",
    target: null,
    detail: "All habits, per day",
  });
  for (const h of habits.filter((h) => h.type !== "group")) out.push(habitMetric(h));
  for (const g of goals.dtos) {
    out.push({
      id: `goal:${g.id}`,
      group: "goals",
      label: g.name,
      unit: g.unit,
      kind: "level",
      target: g.target,
      detail: `Running total · ${g.startsOn} to ${g.endsOn}`,
    });
  }
  for (const [id, m] of Object.entries(WORKOUT_METRICS)) {
    out.push({
      id,
      group: "workouts",
      label: m.label,
      unit: id === "workouts:volume" ? weightUnit(units) : m.unit,
      kind: "amount",
      target: null,
      detail: "Finished workouts, per day",
    });
  }
  const done = new Set(completed.flatMap((w) => exercisesOf(w).map((e) => e.exerciseId)));
  for (const id of done) {
    const info = lookup.get(id);
    if (!info) continue;
    const headline = HEADLINE_RECORD[info.tracking];
    out.push({
      id: `exercise:${id}`,
      group: "exercises",
      label: info.name,
      unit: recordChartUnit(headline, units),
      kind: "session",
      target: null,
      detail: `${RECORD_LABELS[headline]}, per session`,
    });
  }
  if (user.trackWeight || body.some((b) => b.kind === "weight")) {
    out.push({
      id: "body:weight",
      group: "body",
      label: "Weight",
      unit: weightUnit(units),
      kind: "level",
      target: null,
      detail: null,
    });
  }
  if (user.trackHeight || body.some((b) => b.kind === "height")) {
    out.push({
      id: "body:height",
      group: "body",
      label: "Height",
      unit: units === "imperial" ? "in" : "cm",
      kind: "level",
      target: null,
      detail: null,
    });
  }
  out.push({
    id: "journal:words",
    group: "journal",
    label: "Journal words",
    unit: "words",
    kind: "amount",
    target: null,
    detail: "Day log journal",
  });
  return out;
}

const exercisesOf = (row: { exercises: unknown }) => row.exercises as WorkoutExerciseDto[];

/** Days in [from, to] as a sparse-to-dense series: amounts fill quiet days with 0. */
function dense(values: Map<string, number>, from: string, to: string): MetricPointDto[] {
  const out: MetricPointDto[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push({ date: d, value: values.get(d) ?? 0 });
  return out;
}

const sparse = (values: Map<string, number>, from: string, to: string): MetricPointDto[] =>
  [...values]
    .filter(([d]) => d >= from && d <= to)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, value]) => ({ date, value: Math.round(value * 100) / 100 }));

/** Daily points for each metric id over [from, to] (default: the last 90 days). */
export async function series(
  db: Database,
  userId: string,
  ids: string[],
  range: { from?: string; to?: string },
): Promise<MetricSeriesResponseDto> {
  const user = await userOf(db, userId);
  const today = localDateIn(user.timezone);
  const to = range.to && range.to < today ? range.to : today;
  const from = range.from ?? addDays(to, -(DEFAULT_DAYS - 1));
  if (from > to) throw badRequest("`from` must be on or before `to`");
  const units = user.unitSystem;
  const metrics = new Map((await catalog(db, userId)).map((m) => [m.id, m]));

  // Load each source once, only if some id needs it.
  const needs = (prefix: string) => ids.some((id) => id.startsWith(prefix));
  const [ctx, habits, goals, completed, lookup, body, journals] = await Promise.all([
    needs("rating:") ? loadLeafContext(db, userId) : null,
    needs("habit") ? listHabits(db, userId) : null,
    needs("goal:") ? objectivesWithDaily(db, userId) : null,
    needs("workouts:") || needs("exercise:") ? workoutRepo.findCompleted(db, userId) : null,
    needs("exercise:") ? loadLookup(db, userId) : null,
    needs("body:") ? bodyRepo.findAll(db, userId) : null,
    needs("journal:") ? dayRepo.findBetween(db, userId, from, to) : null,
  ]);

  // Rating history replays the ledger per day, so it stays within the current season.
  let ratingHistory: Awaited<ReturnType<typeof historyBetween>> | null = null;
  if (ctx) {
    const onboarded = await decayRepo.onboardedAt(db, ctx.season.id);
    const start = onboarded ? localDateIn(user.timezone, onboarded) : ctx.season.startsOn;
    const hFrom = from > start ? from : start;
    if (hFrom <= to) {
      ratingHistory = await historyBetween(
        db,
        ctx.season.id,
        ctx.nodes,
        hFrom,
        to,
        ctx.season.mode,
      );
    }
  }

  let habitEntries: Awaited<ReturnType<typeof habitRepo.findEntriesBetween>> = [];
  if (habits) {
    habitEntries = await habitRepo.findEntriesBetween(
      db,
      habits.map((h) => h.id),
      from,
      to,
    );
  }

  const out: MetricSeriesDto[] = [];
  for (const id of ids) {
    const metric = metrics.get(id);
    if (!metric) throw notFound(`Unknown metric: ${id}`);
    const [kind, key] = [id.slice(0, id.indexOf(":")), id.slice(id.indexOf(":") + 1)];
    let points: MetricPointDto[] = [];

    if (kind === "rating" && ratingHistory) {
      const values = ratingHistory.series.find((s) => s.nodeId === key)?.values ?? [];
      points = ratingHistory.dates
        .map((date, i) => ({ date, value: values[i] ?? null }))
        .filter((p): p is MetricPointDto => p.value !== null)
        .map((p) => ({ date: p.date, value: Math.round(p.value * 10) / 10 }));
    } else if (kind === "habits" && habits) {
      // Habits done per day (scheduled or not), counting avoid habits only when logged.
      const byDate = new Map<string, number>();
      const byId = new Map(habits.map((h) => [h.id, h]));
      for (const e of habitEntries) {
        const h = byId.get(e.habitId);
        if (!h || h.type === "group") continue;
        if (isEntryDone(h.type, h.config, { num: e.valueNum, text: e.valueText })) {
          byDate.set(e.localDate, (byDate.get(e.localDate) ?? 0) + 1);
        }
      }
      points = dense(byDate, from, to);
    } else if (kind === "habit" && habits) {
      const h = habits.find((x) => x.id === key);
      if (!h) throw notFound(`Unknown metric: ${id}`);
      const entries = new Map(
        habitEntries
          .filter((e) => e.habitId === h.id)
          .map((e) => [e.localDate, { num: e.valueNum, text: e.valueText }]),
      );
      const start = h.startsOn > from ? h.startsOn : from;
      if (metric.kind === "session") {
        // Scales and stars: the logged value on days with one.
        points = sparse(
          new Map([...entries].filter(([, v]) => v.num !== null).map(([d, v]) => [d, v.num!])),
          start,
          to,
        );
      } else if (h.type === "counter" || h.type === "duration") {
        points = dense(new Map([...entries].map(([d, v]) => [d, v.num ?? 0])), start, to);
      } else {
        // Done (or kept) as 1 / 0 every day since the habit started.
        const values = new Map<string, number>();
        for (let d = start; d <= to; d = addDays(d, 1)) {
          values.set(d, isEntryDone(h.type, h.config, entries.get(d) ?? null) ? 1 : 0);
        }
        points = sparse(values, start, to);
      }
    } else if (kind === "goal" && goals) {
      const goal = goals.dtos.find((g) => g.id === key);
      const daily = goals.daily.get(key);
      if (goal && daily) {
        const running = new Map<string, number>();
        let total = 0;
        const end = goal.endsOn < to ? goal.endsOn : to;
        for (let d = goal.startsOn; d <= end; d = addDays(d, 1)) {
          total += daily.get(d) ?? 0;
          running.set(d, total);
        }
        points = sparse(running, from, to);
      }
    } else if (kind === "workouts" && completed) {
      const values = new Map<string, number>();
      for (const w of completed) {
        const ex = exercisesOf(w);
        const add =
          key === "count"
            ? 1
            : key === "volume"
              ? toDisplayWeight(workoutVolume(ex), units)
              : key === "duration"
                ? Math.round(((w.endedAt!.getTime() - w.startedAt.getTime()) / 60_000) * 10) / 10
                : ex.reduce((n, e) => n + e.sets.filter((s) => s.done).length, 0);
        values.set(w.localDate, (values.get(w.localDate) ?? 0) + add);
      }
      points = dense(values, from, to);
    } else if (kind === "exercise" && completed && lookup) {
      const info = lookup.get(key);
      if (info) {
        const headline = HEADLINE_RECORD[info.tracking];
        const values = new Map<string, number>();
        for (const w of completed) {
          for (const e of exercisesOf(w).filter((x) => x.exerciseId === key)) {
            if (!bestSet(info.tracking, e.sets)) continue;
            const best = recordsFromSets(info.tracking, e.sets)[headline];
            if (best === null) continue;
            const v = recordChartValue(headline, best, units);
            values.set(w.localDate, Math.max(values.get(w.localDate) ?? 0, v));
          }
        }
        points = sparse(values, from, to);
      }
    } else if (kind === "body" && body) {
      const values = new Map(
        body
          .filter((b) => b.kind === key)
          .map((b) => [
            b.localDate,
            key === "weight"
              ? toDisplayWeight(b.value, units)
              : units === "imperial"
                ? Math.round((b.value / CM_PER_INCH) * 10) / 10
                : Math.round(b.value),
          ]),
      );
      points = sparse(values, from, to);
    } else if (kind === "journal" && journals) {
      const values = new Map(
        journals.map((j) => [
          j.localDate,
          j.journal.trim() ? j.journal.trim().split(/\s+/).length : 0,
        ]),
      );
      points = dense(values, from, to);
    }
    out.push({ metric, points });
  }
  return { from, to, series: out };
}
