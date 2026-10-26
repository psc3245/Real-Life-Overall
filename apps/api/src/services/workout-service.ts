import {
  bestSet,
  brokenRecords,
  CATALOG_BY_ID,
  EXERCISE_CATALOG,
  formatSet,
  HEADLINE_RECORD,
  localDateIn,
  mergeRecords,
  RECORD_LABELS,
  recordsFromSets,
  TRACKING_FIELDS,
  workoutVolume,
  type DayWorkoutDto,
  type ExerciseCategory,
  type ExerciseDetailDto,
  type ExerciseDto,
  type ExerciseRecordsDto,
  type ExerciseTracking,
  type UnitSystem,
  type WorkoutDto,
  type WorkoutExerciseDto,
  type WorkoutHistoryDto,
  type WorkoutSetDto,
  type WorkoutTemplateDto,
  type createTemplateBodySchema,
  type exerciseBodySchema,
  type templateBodySchema,
  type updateWorkoutBodySchema,
} from "@rlo/shared";
import type { z } from "zod";
import type { Database } from "../db/client";
import { badRequest, conflict, isUniqueViolation, notFound } from "../errors";
import * as dayRepo from "../repos/day-repo";
import * as userRepo from "../repos/user-repo";
import * as workoutRepo from "../repos/workout-repo";
import type { ExerciseRow, TemplateRow, WorkoutRow } from "../repos/workout-repo";

const HISTORY_PAGE = 20;

interface ExerciseInfo {
  id: string;
  name: string;
  category: ExerciseCategory;
  tracking: ExerciseTracking;
  custom: boolean;
  archived: boolean;
}
export type Lookup = Map<string, ExerciseInfo>;

async function userOf(db: Database, userId: string) {
  const user = await userRepo.findById(db, userId);
  if (!user) throw notFound("User not found");
  return user;
}

/** The built-in library plus the user's custom exercises (archived ones still resolve). */
function lookupFrom(custom: ExerciseRow[]): Lookup {
  const lookup: Lookup = new Map(
    EXERCISE_CATALOG.map((e) => [e.id, { ...e, custom: false, archived: false }]),
  );
  for (const e of custom) {
    lookup.set(e.id, {
      id: e.id,
      name: e.name,
      category: e.category,
      tracking: e.tracking,
      custom: true,
      archived: e.archivedAt !== null,
    });
  }
  return lookup;
}

export async function loadLookup(db: Database, userId: string): Promise<Lookup> {
  return lookupFrom(await workoutRepo.findExercises(db, userId));
}

const exercisesOf = (row: { exercises: unknown }) => row.exercises as WorkoutExerciseDto[];
const nameOf = (lookup: Lookup, id: string) => lookup.get(id)?.name ?? "Unknown exercise";

/** Keeps only the fields an exercise's tracking kind records, and checks every id resolves. */
function normalizeExercises(input: WorkoutExerciseDto[], lookup: Lookup): WorkoutExerciseDto[] {
  return input.map((e) => {
    const info = lookup.get(e.exerciseId);
    if (!info) throw badRequest(`Unknown exercise: ${e.exerciseId}`);
    const fields = TRACKING_FIELDS[info.tracking];
    return {
      exerciseId: e.exerciseId,
      notes: e.notes.trim(),
      sets: e.sets.map((s): WorkoutSetDto => ({
        kind: s.kind,
        weightKg: fields.includes("weight") ? s.weightKg : null,
        reps: fields.includes("reps") ? s.reps : null,
        durationS: fields.includes("duration") ? s.durationS : null,
        distanceM: fields.includes("distance") ? s.distanceM : null,
        attempts: fields.includes("attempts") ? s.attempts : null,
        done: s.done,
      })),
    };
  });
}

/** Template sets are plans: nothing is done yet. */
const asPlan = (exercises: WorkoutExerciseDto[]) =>
  exercises.map((e) => ({ ...e, sets: e.sets.map((s) => ({ ...s, done: false })) }));

/**
 * Replays finished workouts in order, tracking each exercise's running records and last sets.
 * `onWorkout` sees the state from before each workout, which is what "previous" and personal
 * records compare against.
 */
function replay(
  completed: WorkoutRow[],
  lookup: Lookup,
  onWorkout?: (row: WorkoutRow, state: ReplayState) => void,
): ReplayState {
  const state: ReplayState = { records: new Map(), lastSets: new Map() };
  for (const row of completed) {
    onWorkout?.(row, state);
    for (const e of exercisesOf(row)) {
      const info = lookup.get(e.exerciseId);
      if (!info) continue;
      const records = recordsFromSets(info.tracking, e.sets);
      state.records.set(
        e.exerciseId,
        mergeRecords(state.records.get(e.exerciseId) ?? null, records),
      );
      state.lastSets.set(e.exerciseId, e.sets);
    }
  }
  return state;
}
interface ReplayState {
  records: Map<string, ExerciseRecordsDto>;
  lastSets: Map<string, WorkoutSetDto[]>;
}

function toDto(row: WorkoutRow, state: ReplayState, lookup: Lookup, now = new Date()): WorkoutDto {
  const exercises = exercisesOf(row);
  const prs: WorkoutDto["summary"]["prs"] = [];
  const previous: WorkoutDto["previous"] = {};
  for (const e of exercises) {
    const info = lookup.get(e.exerciseId);
    const last = state.lastSets.get(e.exerciseId);
    if (last) previous[e.exerciseId] = last;
    if (!info) continue;
    const broken = brokenRecords(
      state.records.get(e.exerciseId) ?? null,
      recordsFromSets(info.tracking, e.sets),
    );
    if (broken.length) {
      prs.push({
        exerciseId: e.exerciseId,
        label: `${info.name}: ${broken.map((k) => RECORD_LABELS[k].toLowerCase()).join(", ")}`,
      });
    }
  }
  const end = row.endedAt ?? now;
  return {
    id: row.id,
    name: row.name,
    notes: row.notes,
    localDate: row.localDate,
    startedAt: row.startedAt.toISOString(),
    endedAt: row.endedAt?.toISOString() ?? null,
    templateId: row.templateId,
    exercises,
    summary: {
      durationS: Math.max(0, Math.round((end.getTime() - row.startedAt.getTime()) / 1000)),
      volumeKg: Math.round(workoutVolume(exercises) * 10) / 10,
      doneSets: exercises.reduce((n, e) => n + e.sets.filter((s) => s.done).length, 0),
      prs,
    },
    previous,
  };
}

/** DTOs for the given workouts (finished or not), with "previous" and records from before each. */
async function buildDtos(db: Database, userId: string, rows: WorkoutRow[], lookup?: Lookup) {
  const [completed, resolved] = await Promise.all([
    workoutRepo.findCompleted(db, userId),
    lookup ?? loadLookup(db, userId),
  ]);
  const wanted = new Set(rows.map((r) => r.id));
  const out = new Map<string, WorkoutDto>();
  const final = replay(completed, resolved, (row, state) => {
    if (wanted.has(row.id)) out.set(row.id, toDto(row, state, resolved));
  });
  // In-progress workouts come after every finished one.
  for (const row of rows) if (!out.has(row.id)) out.set(row.id, toDto(row, final, resolved));
  return rows.map((r) => out.get(r.id)!);
}

async function one(db: Database, userId: string, row: WorkoutRow): Promise<WorkoutDto> {
  return (await buildDtos(db, userId, [row]))[0]!;
}

/** Workouts feed the day log, so changing a finished one makes its day's recap stale. */
async function touchDays(db: Database, userId: string, ...dates: string[]) {
  for (const date of new Set(dates)) await dayRepo.markStaleIfRecapped(db, userId, date);
}

function defaultName(timeZone: string, now: Date) {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", hourCycle: "h23" }).format(now),
  );
  if (hour < 5) return "Night Workout";
  if (hour < 12) return "Morning Workout";
  if (hour < 17) return "Afternoon Workout";
  return "Evening Workout";
}

// Workouts

export async function getActive(db: Database, userId: string): Promise<WorkoutDto | null> {
  const row = await workoutRepo.findInProgress(db, userId);
  return row ? one(db, userId, row) : null;
}

export async function getWorkout(db: Database, userId: string, id: string): Promise<WorkoutDto> {
  const row = await workoutRepo.findById(db, userId, id);
  if (!row) throw notFound("Workout not found");
  return one(db, userId, row);
}

export async function startWorkout(
  db: Database,
  userId: string,
  input: { templateId?: string; name?: string },
): Promise<WorkoutDto> {
  if (await workoutRepo.findInProgress(db, userId)) {
    throw conflict("Finish or cancel the workout in progress first");
  }
  const user = await userOf(db, userId);
  const now = new Date();
  let template: TemplateRow | null = null;
  if (input.templateId) {
    template = await workoutRepo.findTemplate(db, userId, input.templateId);
    if (!template) throw notFound("Template not found");
  }
  try {
    const row = await db.transaction(async (tx) => {
      const created = await workoutRepo.insert(tx, {
        userId,
        name: input.name ?? template?.name ?? defaultName(user.timezone, now),
        notes: template?.notes ?? "",
        localDate: localDateIn(user.timezone, now),
        startedAt: now,
        templateId: template?.id ?? null,
        exercises: template ? asPlan(exercisesOf(template)) : [],
      });
      if (template) await workoutRepo.updateTemplate(tx, template.id, { lastUsedAt: now });
      return created;
    });
    return one(db, userId, row);
  } catch (error) {
    if (isUniqueViolation(error)) throw conflict("Finish or cancel the workout in progress first");
    throw error;
  }
}

export async function updateWorkout(
  db: Database,
  userId: string,
  id: string,
  input: z.infer<typeof updateWorkoutBodySchema>,
): Promise<WorkoutDto> {
  const row = await workoutRepo.findById(db, userId, id);
  if (!row) throw notFound("Workout not found");
  const finished = row.endedAt !== null;
  if (!finished && (input.localDate !== undefined || input.durationS !== undefined)) {
    throw badRequest("Change the date or duration after finishing the workout");
  }
  const user = await userOf(db, userId);
  if (input.localDate && input.localDate > localDateIn(user.timezone)) {
    throw badRequest("Workouts can't be in the future");
  }
  const lookup = await loadLookup(db, userId);
  const updated = await workoutRepo.update(db, row.id, {
    ...(input.name !== undefined && { name: input.name }),
    ...(input.notes !== undefined && { notes: input.notes }),
    ...(input.exercises !== undefined && {
      exercises: normalizeExercises(input.exercises, lookup),
    }),
    ...(input.localDate !== undefined && { localDate: input.localDate }),
    ...(input.durationS !== undefined && {
      endedAt: new Date(row.startedAt.getTime() + input.durationS * 1000),
    }),
  });
  if (finished) await touchDays(db, userId, row.localDate, updated.localDate);
  return (await buildDtos(db, userId, [updated], lookup))[0]!;
}

/**
 * Finishes the workout: sets that weren't checked off are dropped, and so are exercises left
 * with none. Optionally rewrites the template it came from with what was done.
 */
export async function finishWorkout(
  db: Database,
  userId: string,
  id: string,
  options: { updateTemplate: boolean },
): Promise<WorkoutDto> {
  const row = await workoutRepo.findById(db, userId, id);
  if (!row) throw notFound("Workout not found");
  if (row.endedAt) throw conflict("This workout is already finished");
  const done = exercisesOf(row)
    .map((e) => ({ ...e, sets: e.sets.filter((s) => s.done) }))
    .filter((e) => e.sets.length > 0);
  if (!done.length) throw badRequest("Check off at least one set to finish the workout");

  const finished = await db.transaction(async (tx) => {
    const updated = await workoutRepo.update(tx, row.id, { exercises: done, endedAt: new Date() });
    if (options.updateTemplate && row.templateId) {
      const template = await workoutRepo.findTemplate(tx, userId, row.templateId);
      if (template) await workoutRepo.updateTemplate(tx, template.id, { exercises: asPlan(done) });
    }
    return updated;
  });
  await touchDays(db, userId, finished.localDate);
  return one(db, userId, finished);
}

/** Cancels a workout in progress, or deletes a finished one. */
export async function deleteWorkout(db: Database, userId: string, id: string) {
  const row = await workoutRepo.findById(db, userId, id);
  if (!row) throw notFound("Workout not found");
  await workoutRepo.remove(db, row.id);
  if (row.endedAt) await touchDays(db, userId, row.localDate);
}

export async function listHistory(
  db: Database,
  userId: string,
  before?: string,
): Promise<WorkoutHistoryDto> {
  const cursor = before ? new Date(before) : null;
  if (cursor && Number.isNaN(cursor.getTime())) throw badRequest("Invalid cursor");
  const rows = await workoutRepo.findCompletedPage(db, userId, cursor, HISTORY_PAGE + 1);
  const page = rows.slice(0, HISTORY_PAGE);
  return {
    workouts: await buildDtos(db, userId, page),
    nextBefore: rows.length > HISTORY_PAGE ? page.at(-1)!.startedAt.toISOString() : null,
  };
}

/** Finished workouts on a day, as the day log and recap describe them. */
export async function workoutsForDay(
  db: Database,
  userId: string,
  date: string,
  system: UnitSystem,
): Promise<DayWorkoutDto[]> {
  const rows = await workoutRepo.findCompletedOn(db, userId, date);
  if (!rows.length) return [];
  const lookup = await loadLookup(db, userId);
  const dtos = await buildDtos(db, userId, rows, lookup);
  return dtos.map((w) => ({
    id: w.id,
    name: w.name,
    durationS: w.summary.durationS,
    volumeKg: w.summary.volumeKg,
    lines: w.exercises.map((e) => {
      const info = lookup.get(e.exerciseId);
      const best = info ? bestSet(info.tracking, e.sets) : null;
      const sets = `${e.sets.length} set${e.sets.length === 1 ? "" : "s"}`;
      return `${nameOf(lookup, e.exerciseId)}: ${sets}${best && info ? `, best ${formatSet(info.tracking, best, system)}` : ""}`;
    }),
    prs: w.summary.prs.map((p) => p.label),
  }));
}

// Templates

function toTemplateDto(row: TemplateRow): WorkoutTemplateDto {
  return {
    id: row.id,
    name: row.name,
    notes: row.notes,
    exercises: exercisesOf(row),
    lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
  };
}

export async function listTemplates(db: Database, userId: string): Promise<WorkoutTemplateDto[]> {
  return (await workoutRepo.findTemplates(db, userId)).map(toTemplateDto);
}

export async function createTemplate(
  db: Database,
  userId: string,
  input: z.infer<typeof createTemplateBodySchema>,
): Promise<WorkoutTemplateDto> {
  const lookup = await loadLookup(db, userId);
  if ("fromWorkoutId" in input) {
    const workout = await workoutRepo.findById(db, userId, input.fromWorkoutId);
    if (!workout) throw notFound("Workout not found");
    const row = await workoutRepo.insertTemplate(db, {
      userId,
      name: input.name ?? workout.name,
      notes: workout.notes,
      exercises: asPlan(exercisesOf(workout)),
    });
    return toTemplateDto(row);
  }
  const row = await workoutRepo.insertTemplate(db, {
    userId,
    name: input.name,
    notes: input.notes,
    exercises: asPlan(normalizeExercises(input.exercises, lookup)),
  });
  return toTemplateDto(row);
}

export async function updateTemplate(
  db: Database,
  userId: string,
  id: string,
  input: Partial<z.infer<typeof templateBodySchema>>,
): Promise<WorkoutTemplateDto> {
  const template = await workoutRepo.findTemplate(db, userId, id);
  if (!template) throw notFound("Template not found");
  const lookup = await loadLookup(db, userId);
  const row = await workoutRepo.updateTemplate(db, template.id, {
    ...(input.name !== undefined && { name: input.name }),
    ...(input.notes !== undefined && { notes: input.notes }),
    ...(input.exercises !== undefined && {
      exercises: asPlan(normalizeExercises(input.exercises, lookup)),
    }),
  });
  return toTemplateDto(row);
}

export async function deleteTemplate(db: Database, userId: string, id: string) {
  const template = await workoutRepo.findTemplate(db, userId, id);
  if (!template) throw notFound("Template not found");
  await workoutRepo.removeTemplate(db, template.id);
}

// Exercises

function usage(completed: WorkoutRow[]) {
  const out = new Map<string, { timesDone: number; lastDone: string | null }>();
  for (const w of completed) {
    for (const id of new Set(exercisesOf(w).map((e) => e.exerciseId))) {
      const u = out.get(id) ?? { timesDone: 0, lastDone: null };
      u.timesDone += 1;
      if (!u.lastDone || w.localDate > u.lastDone) u.lastDone = w.localDate;
      out.set(id, u);
    }
  }
  return out;
}

const toExerciseDto = (
  info: ExerciseInfo,
  u: { timesDone: number; lastDone: string | null } | undefined,
): ExerciseDto => ({
  id: info.id,
  name: info.name,
  category: info.category,
  tracking: info.tracking,
  custom: info.custom,
  timesDone: u?.timesDone ?? 0,
  lastDone: u?.lastDone ?? null,
});

/** The library plus custom exercises (not archived ones), with how often each was done. */
export async function listExercises(db: Database, userId: string): Promise<ExerciseDto[]> {
  const [lookup, completed] = await Promise.all([
    loadLookup(db, userId),
    workoutRepo.findCompleted(db, userId),
  ]);
  const used = usage(completed);
  return [...lookup.values()]
    .filter((e) => !e.archived)
    .map((e) => toExerciseDto(e, used.get(e.id)))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function getExercise(
  db: Database,
  userId: string,
  id: string,
): Promise<ExerciseDetailDto> {
  const [lookup, completed] = await Promise.all([
    loadLookup(db, userId),
    workoutRepo.findCompleted(db, userId),
  ]);
  const info = lookup.get(id);
  if (!info) throw notFound("Exercise not found");
  const headline = HEADLINE_RECORD[info.tracking];
  const sessions = completed.flatMap((w) =>
    exercisesOf(w)
      .filter((e) => e.exerciseId === id)
      .map((e) => ({
        workoutId: w.id,
        workoutName: w.name,
        localDate: w.localDate,
        sets: e.sets,
        best: recordsFromSets(info.tracking, e.sets)[headline],
      })),
  );
  const records = sessions.reduce<ExerciseRecordsDto | null>(
    (acc, s) => mergeRecords(acc, recordsFromSets(info.tracking, s.sets)),
    null,
  );
  return {
    exercise: toExerciseDto(info, usage(completed).get(id)),
    records: records ?? recordsFromSets(info.tracking, []),
    history: sessions.reverse(),
  };
}

function checkCustomName(name: string, existing: ExerciseRow[], exceptId?: string) {
  const lower = name.toLowerCase();
  const taken =
    EXERCISE_CATALOG.some((e) => e.name.toLowerCase() === lower) ||
    existing.some((e) => !e.archivedAt && e.id !== exceptId && e.name.toLowerCase() === lower);
  if (taken) throw conflict("An exercise with that name already exists");
}

export async function createExercise(
  db: Database,
  userId: string,
  input: z.infer<typeof exerciseBodySchema>,
): Promise<ExerciseDto> {
  checkCustomName(input.name, await workoutRepo.findExercises(db, userId));
  const row = await workoutRepo.insertExercise(db, { userId, ...input });
  return toExerciseDto(lookupFrom([row]).get(row.id)!, undefined);
}

async function ownCustom(db: Database, userId: string, id: string) {
  if (CATALOG_BY_ID.has(id)) throw badRequest("Built-in exercises can't be changed");
  const rows = await workoutRepo.findExercises(db, userId);
  const row = rows.find((e) => e.id === id && !e.archivedAt);
  if (!row) throw notFound("Exercise not found");
  return { row, rows };
}

/** Renames or recategorizes a custom exercise. The tracking kind is fixed once it's used. */
export async function updateExercise(
  db: Database,
  userId: string,
  id: string,
  input: Partial<z.infer<typeof exerciseBodySchema>>,
): Promise<ExerciseDto> {
  const { row, rows } = await ownCustom(db, userId, id);
  if (input.name) checkCustomName(input.name, rows, row.id);
  if (input.tracking && input.tracking !== row.tracking) {
    const used = usage(await workoutRepo.findCompleted(db, userId)).has(row.id);
    if (used) throw conflict("This exercise has history, so its tracking can't change");
  }
  const updated = await workoutRepo.updateExercise(db, row.id, input);
  return toExerciseDto(lookupFrom([updated]).get(updated.id)!, undefined);
}

/** Archived exercises leave the library; past workouts keep showing them. */
export async function archiveExercise(db: Database, userId: string, id: string) {
  const { row } = await ownCustom(db, userId, id);
  await workoutRepo.updateExercise(db, row.id, { archivedAt: new Date() });
}

/** Completed workouts per local date (goals that count workouts). */
export async function workoutCountsByDate(db: Database, userId: string) {
  const counts = new Map<string, number>();
  for (const w of await workoutRepo.findCompleted(db, userId)) {
    counts.set(w.localDate, (counts.get(w.localDate) ?? 0) + 1);
  }
  return counts;
}
