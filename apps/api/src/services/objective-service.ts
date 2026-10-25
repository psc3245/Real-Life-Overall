import {
  habitContribution,
  habitObjectiveUnit,
  localDateIn,
  objectiveProgress,
  objectiveTerm,
  type DayObjectiveDto,
  type HabitConfig,
  type ObjectiveDto,
  type createObjectiveBodySchema,
  type updateObjectiveBodySchema,
} from "@rlo/shared";
import type { z } from "zod";
import type { Database } from "../db/client";
import { badRequest, conflict, notFound } from "../errors";
import * as habitRepo from "../repos/habit-repo";
import type { HabitRow } from "../repos/habit-repo";
import * as objectiveRepo from "../repos/objective-repo";
import type { ObjectiveRow } from "../repos/objective-repo";
import * as userRepo from "../repos/user-repo";
import { linksToLineages, loadLeafContext, type LeafContext } from "./habit-service";
import { workoutCountsByDate } from "./workout-service";

async function todayFor(db: Database, userId: string) {
  const user = await userRepo.findById(db, userId);
  if (!user) throw notFound("User not found");
  return localDateIn(user.timezone);
}

/** Per-goal amounts by local date, from the goal's own entries or its habit's. */
async function dailyAmounts(
  db: Database,
  rows: ObjectiveRow[],
  habits: HabitRow[],
): Promise<Map<string, Map<string, number>>> {
  const out = new Map(rows.map((r) => [r.id, new Map<string, number>()]));
  const manual = rows.filter((r) => r.source === "manual");
  for (const e of await objectiveRepo.findEntries(
    db,
    manual.map((r) => r.id),
  )) {
    out.get(e.objectiveId)!.set(e.localDate, e.value);
  }
  const fromHabits = rows.filter((r) => r.source === "habit" && r.habitId);
  if (fromHabits.length) {
    const from = fromHabits.reduce((m, r) => (r.startsOn < m ? r.startsOn : m), "9999-12-31");
    const to = fromHabits.reduce((m, r) => (r.endsOn > m ? r.endsOn : m), "0000-01-01");
    const habitById = new Map(habits.map((h) => [h.id, h]));
    const entries = await habitRepo.findEntriesBetween(
      db,
      [...new Set(fromHabits.map((r) => r.habitId!))],
      from,
      to,
    );
    for (const r of fromHabits) {
      const habit = habitById.get(r.habitId!);
      if (!habit) continue;
      const daily = out.get(r.id)!;
      for (const e of entries) {
        if (e.habitId !== habit.id) continue;
        const amount = habitContribution(habit.type, habit.config as HabitConfig, {
          num: e.valueNum,
          text: e.valueText,
        });
        if (amount) daily.set(e.localDate, amount);
      }
    }
  }
  if (rows.some((r) => r.source === "workouts")) {
    const counts = await workoutCountsByDate(db, rows[0]!.userId);
    for (const r of rows.filter((r) => r.source === "workouts")) out.set(r.id, new Map(counts));
  }
  return out;
}

async function toDtos(
  db: Database,
  rows: ObjectiveRow[],
  today: string,
  ctx: LeafContext | null,
  habits: HabitRow[],
): Promise<{ dtos: ObjectiveDto[]; daily: Map<string, Map<string, number>> }> {
  const [links, daily] = await Promise.all([
    objectiveRepo.findLinks(
      db,
      rows.map((r) => r.id),
    ),
    dailyAmounts(db, rows, habits),
  ]);
  const habitById = new Map(habits.map((h) => [h.id, h]));
  const dtos = rows.map((r): ObjectiveDto => ({
    id: r.id,
    name: r.name,
    unit: r.unit,
    target: r.target,
    startsOn: r.startsOn,
    endsOn: r.endsOn,
    term: objectiveTerm(r.startsOn, r.endsOn),
    source: r.source,
    habitId: r.habitId,
    habitName: r.habitId ? (habitById.get(r.habitId)?.name ?? null) : null,
    links: links
      .filter((l) => l.objectiveId === r.id)
      .map((l) => ctx?.nodeByLineage.get(l.nodeLineageId))
      .filter((id): id is string => !!id),
    progress: objectiveProgress(r, daily.get(r.id)!, today),
  }));
  return { dtos, daily };
}

async function load(db: Database, userId: string) {
  const [rows, habits, ctx, today] = await Promise.all([
    objectiveRepo.findActiveByUser(db, userId),
    habitRepo.findAllByUser(db, userId),
    loadLeafContext(db, userId),
    todayFor(db, userId),
  ]);
  return { rows, habits, ctx, today };
}

export async function listObjectives(db: Database, userId: string): Promise<ObjectiveDto[]> {
  const { rows, habits, ctx, today } = await load(db, userId);
  return (await toDtos(db, rows, today, ctx, habits)).dtos;
}

/** Goals whose window includes `date`, with what that day added. */
export async function objectivesForDay(
  db: Database,
  userId: string,
  date: string,
): Promise<DayObjectiveDto[]> {
  const { rows, habits, ctx, today } = await load(db, userId);
  const inWindow = rows.filter((r) => r.startsOn <= date && date <= r.endsOn);
  const { dtos, daily } = await toDtos(db, inWindow, today, ctx, habits);
  return dtos.map((objective) => {
    const amount = daily.get(objective.id)!.get(date) ?? null;
    return {
      objective,
      logged: objective.source === "manual" ? amount : null,
      dayAmount: amount ?? 0,
    };
  });
}

async function one(db: Database, userId: string, row: ObjectiveRow): Promise<ObjectiveDto> {
  const { habits, ctx, today } = await load(db, userId);
  return (await toDtos(db, [row], today, ctx, habits)).dtos[0]!;
}

export async function createObjective(
  db: Database,
  userId: string,
  input: z.infer<typeof createObjectiveBodySchema>,
): Promise<ObjectiveDto> {
  const [ctx, today] = await Promise.all([loadLeafContext(db, userId), todayFor(db, userId)]);
  const lineages = linksToLineages(input.links, ctx, "goals");
  const startsOn = input.startsOn ?? today;
  if (input.endsOn < startsOn) throw badRequest("The deadline must be on or after the start");

  let unit = input.source === "workouts" ? "workouts" : input.unit || "times";
  let habitId: string | null = null;
  if (input.source === "habit") {
    const habit = await habitRepo.findById(db, userId, input.habitId!);
    if (!habit || habit.archivedAt) throw badRequest("Pick one of your habits");
    if (habit.type === "group") throw badRequest("Count one of the group's sub-habits instead");
    unit = habitObjectiveUnit(habit.type, habit.config as HabitConfig);
    habitId = habit.id;
  }
  const row = await db.transaction(async (tx) => {
    const created = await objectiveRepo.insert(tx, {
      userId,
      name: input.name,
      unit,
      target: input.target,
      startsOn,
      endsOn: input.endsOn,
      source: input.source,
      habitId,
    });
    await objectiveRepo.replaceLinks(tx, created.id, lineages);
    return created;
  });
  return one(db, userId, row);
}

export async function updateObjective(
  db: Database,
  userId: string,
  objectiveId: string,
  input: z.infer<typeof updateObjectiveBodySchema>,
): Promise<ObjectiveDto> {
  const existing = await objectiveRepo.findById(db, userId, objectiveId);
  if (!existing || existing.archivedAt) throw notFound("Goal not found");
  const startsOn = input.startsOn ?? existing.startsOn;
  const endsOn = input.endsOn ?? existing.endsOn;
  if (endsOn < startsOn) throw badRequest("The deadline must be on or after the start");
  const ctx = await loadLeafContext(db, userId);
  const lineages = input.links ? linksToLineages(input.links, ctx, "goals") : null;
  const row = await db.transaction(async (tx) => {
    const updated = await objectiveRepo.update(tx, existing.id, {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.target !== undefined && { target: input.target }),
      // Habit goals count in the habit's unit.
      ...(input.unit !== undefined &&
        existing.source === "manual" && { unit: input.unit || "times" }),
      startsOn,
      endsOn,
    });
    if (lineages) await objectiveRepo.replaceLinks(tx, existing.id, lineages);
    return updated;
  });
  return one(db, userId, row);
}

export async function archiveObjective(db: Database, userId: string, objectiveId: string) {
  const existing = await objectiveRepo.findById(db, userId, objectiveId);
  if (!existing) throw notFound("Goal not found");
  if (existing.archivedAt) throw conflict("Goal is already deleted");
  await objectiveRepo.update(db, existing.id, { archivedAt: new Date() });
}

/** Validates a manual goal for logging on `day` and stores (or clears) that day's amount. */
export async function saveObjectiveEntry(
  db: Database,
  userId: string,
  day: string,
  objectiveId: string,
  value: number | null,
) {
  const objective = await objectiveRepo.findById(db, userId, objectiveId);
  if (!objective || objective.archivedAt) throw notFound("Goal not found");
  if (objective.source !== "manual") {
    throw badRequest(
      objective.source === "habit"
        ? "This goal counts a habit; log the habit instead"
        : "This goal counts workouts; log a workout instead",
    );
  }
  if (day < objective.startsOn || day > objective.endsOn) {
    throw badRequest(`This goal runs ${objective.startsOn} to ${objective.endsOn}`);
  }
  if (!value) await objectiveRepo.deleteEntry(db, objective.id, day);
  else await objectiveRepo.upsertEntry(db, objective.id, day, Math.round(value * 100) / 100);
}
