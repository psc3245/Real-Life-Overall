import {
  dayOfWeek,
  isEditableDate,
  isValidDate,
  localDateIn,
  validateHabitEntry,
  type DayDto,
  type GuidedPromptDto,
  type HabitConfig,
  type HabitEntryValue,
} from "@rlo/shared";
import type { Database } from "../db/client";
import { badRequest, conflict, notFound } from "../errors";
import * as dayRepo from "../repos/day-repo";
import * as habitRepo from "../repos/habit-repo";
import * as eventRepo from "../repos/rating-event-repo";
import * as recapRepo from "../repos/recap-repo";
import * as userRepo from "../repos/user-repo";
import { loadLeafContext, toHabitDtos } from "./habit-service";
import { badgesByRecap } from "./badge-service";
import { invalidateDecay } from "./decay-service";
import { toRecapDto } from "./recap-view";

async function resolveDate(db: Database, userId: string, date: string | undefined) {
  const user = await userRepo.findById(db, userId);
  if (!user) throw notFound("User not found");
  const today = localDateIn(user.timezone);
  const day = date ?? today;
  if (!isValidDate(day)) throw badRequest("Invalid date");
  if (day > today) throw badRequest("Can't log days in the future");
  return { day, today };
}

export async function requireEditable(db: Database, userId: string, date: string) {
  const resolved = await resolveDate(db, userId, date);
  if (!isEditableDate(resolved.day, resolved.today)) {
    throw conflict("That day is past the backfill window and can no longer be edited");
  }
  return resolved;
}

/**
 * A day's log: journal plus every habit that existed that day. Habits not scheduled for that
 * weekday are still listed (logging them is a bonus). Archived habits show only if logged.
 */
export async function getDay(db: Database, userId: string, date?: string): Promise<DayDto> {
  const { day, today } = await resolveDate(db, userId, date);
  const [log, rows, ctx, recap] = await Promise.all([
    dayRepo.find(db, userId, day),
    habitRepo.findAllByUser(db, userId),
    loadLeafContext(db, userId),
    recapRepo.findActiveDaily(db, userId, day),
  ]);
  const recapDto =
    recap && ctx
      ? toRecapDto(
          recap,
          ctx.nodes,
          await eventRepo.findActiveBySeason(db, ctx.season.id),
          (await badgesByRecap(db, [recap.id])).get(recap.id),
        )
      : null;
  const entries = new Map(
    (
      await habitRepo.findEntriesOn(
        db,
        rows.map((r) => r.id),
        day,
      )
    ).map((e) => [e.habitId, e]),
  );
  const dtos = await toHabitDtos(db, rows, ctx);
  const weekday = dayOfWeek(day);

  const habits = rows
    .map((row, i) => ({ row, dto: dtos[i]!, entry: entries.get(row.id) }))
    .filter(({ row, dto, entry }) => dto.startsOn <= day && (!row.archivedAt || entry))
    .map(({ dto, entry }) => ({
      habit: dto,
      scheduled: dto.days.includes(weekday),
      entry: entry ? { num: entry.valueNum, text: entry.valueText } : null,
    }))
    .sort((a, b) => Number(b.scheduled) - Number(a.scheduled));

  return {
    date: day,
    today,
    editable: isEditableDate(day, today),
    status: log?.status ?? "open",
    journal: log?.journal ?? "",
    habits,
    prompts: (log?.prompts ?? []) as GuidedPromptDto[],
    recap: recapDto,
  };
}

export async function saveJournal(db: Database, userId: string, date: string, journal: string) {
  const { day } = await requireEditable(db, userId, date);
  await dayRepo.upsertJournal(db, userId, day, journal);
  await dayRepo.markStaleIfRecapped(db, userId, day);
  return getDay(db, userId, day);
}

/** Sets a habit's entry for the day; a value with neither number nor text clears it. */
export async function saveEntry(
  db: Database,
  userId: string,
  date: string,
  habitId: string,
  value: HabitEntryValue,
) {
  const { day } = await requireEditable(db, userId, date);
  const habit = await habitRepo.findById(db, userId, habitId);
  if (!habit || habit.archivedAt) throw notFound("Habit not found");
  if (day < habit.startsOn) throw badRequest(`This habit starts on ${habit.startsOn}`);

  const text = value.text?.trim() || null;
  if (value.num === null && text === null) {
    await habitRepo.deleteEntry(db, habit.id, day);
  } else {
    const problem = validateHabitEntry(habit.type, habit.config as HabitConfig, {
      num: value.num,
      text,
    });
    if (problem) throw badRequest(problem);
    await habitRepo.upsertEntry(db, habit.id, day, { valueNum: value.num, valueText: text });
  }
  await dayRepo.markStaleIfRecapped(db, userId, day);
  // Completing (or un-completing) a linked habit on a past day changes that day's decay.
  await invalidateDecay(db, userId, day);
  return getDay(db, userId, day);
}

/** Answers to the day's guided questions, by position; null clears an answer. */
export async function savePromptAnswers(
  db: Database,
  userId: string,
  date: string,
  answers: (string | null)[],
) {
  const { day } = await requireEditable(db, userId, date);
  const log = await dayRepo.find(db, userId, day);
  const prompts = (log?.prompts ?? []) as GuidedPromptDto[];
  if (answers.length > prompts.length) throw badRequest("There are no questions for that day");
  const updated = prompts.map((p, i) =>
    i < answers.length ? { ...p, answer: answers[i]?.trim() || null } : p,
  );
  await dayRepo.setPrompts(db, userId, day, updated);
  await dayRepo.markStaleIfRecapped(db, userId, day);
  return getDay(db, userId, day);
}
