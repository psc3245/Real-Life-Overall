import {
  addDays,
  bestSet,
  brokenRecords,
  cardioLine,
  cardioSession,
  CATALOG_BY_ID,
  emptySet,
  isCardioTracking,
  EXERCISE_CATALOG,
  formatSet,
  HEADLINE_RECORD,
  localDateIn,
  mergeRecords,
  RECORD_LABELS,
  recordsDistance,
  recordsFromSets,
  TRACKING_FIELDS,
  withTemplateValues,
  workoutVolume,
  type CardioActivityDto,
  type CardioDetailsDto,
  type CardioOverviewDto,
  type CardioTotalsDto,
  type cardioBodySchema,
  type DayWorkoutDto,
  type startWorkoutBodySchema,
  type ExerciseCategory,
  type ExerciseDetailDto,
  type ExerciseDto,
  type ExerciseRecordsDto,
  type ExerciseTracking,
  type LiveWorkoutKind,
  type Sport,
  type SportOverviewDto,
  type SportSkillDto,
  type UnitSystem,
  type WorkoutDto,
  type WorkoutExerciseDto,
  type WorkoutHistoryDto,
  type WorkoutSetDto,
  type WorkoutTemplateDto,
  type createTemplateBodySchema,
  type exerciseBodySchema,
  type finishWorkoutBodySchema,
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
  sport: Sport | null;
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
      sport: null,
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
        distanceM: recordsDistance(info.tracking) ? s.distanceM : null,
        attempts: fields.includes("attempts") ? s.attempts : null,
        done: s.done,
      })),
      restS: e.restS ?? null,
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
    kind: row.kind,
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
    cardio: (row.cardio as CardioDetailsDto | null) ?? null,
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

function defaultName(timeZone: string, now: Date, kind: LiveWorkoutKind) {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", hourCycle: "h23" }).format(now),
  );
  const what = kind === "sport" ? "Practice" : "Workout";
  if (hour < 5) return `Night ${what}`;
  if (hour < 12) return `Morning ${what}`;
  if (hour < 17) return `Afternoon ${what}`;
  return `Evening ${what}`;
}

/** Templates are only for the kinds that run live. */
const liveKind = (kind: string): LiveWorkoutKind => (kind === "sport" ? "sport" : "strength");

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
  input: z.infer<typeof startWorkoutBodySchema>,
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
    const kind = template ? template.kind : (input.kind ?? "strength");
    const row = await db.transaction(async (tx) => {
      const created = await workoutRepo.insert(tx, {
        userId,
        kind,
        name: input.name ?? template?.name ?? defaultName(user.timezone, now, liveKind(kind)),
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
 * with none. Optionally updates the template it came from (just the numbers, or replaced
 * outright) or saves what was done as a new template.
 */
export async function finishWorkout(
  db: Database,
  userId: string,
  id: string,
  options: z.infer<typeof finishWorkoutBodySchema>,
): Promise<WorkoutDto> {
  const row = await workoutRepo.findById(db, userId, id);
  if (!row) throw notFound("Workout not found");
  if (row.endedAt) throw conflict("This workout is already finished");
  const exercises = exercisesOf(row);
  const done = exercises
    .map((e) => ({ ...e, sets: e.sets.filter((s) => s.done) }))
    .filter((e) => e.sets.length > 0);
  if (!done.length) throw badRequest("Check off at least one set to finish the workout");
  const action = options.template ?? (options.updateTemplate ? "overwrite" : "none");

  const finished = await db.transaction(async (tx) => {
    const updated = await workoutRepo.update(tx, row.id, { exercises: done, endedAt: new Date() });
    if (action === "new") {
      await workoutRepo.insertTemplate(tx, {
        userId,
        kind: liveKind(row.kind),
        name: options.templateName ?? row.name,
        notes: row.notes,
        exercises: asPlan(done),
      });
    } else if (action !== "none" && row.templateId) {
      const template = await workoutRepo.findTemplate(tx, userId, row.templateId);
      if (template) {
        await workoutRepo.updateTemplate(tx, template.id, {
          exercises:
            action === "values"
              ? withTemplateValues(exercisesOf(template), exercises)
              : asPlan(done),
        });
      }
    }
    return updated;
  });
  await touchDays(db, userId, finished.localDate);
  return one(db, userId, finished);
}

/**
 * Records a workout that's already over, all sets done (the coach logging what the player
 * describes). It counts for `localDate`; `startedAt` is the moment it was logged.
 */
export async function logWorkout(
  db: Database,
  userId: string,
  input: {
    name: string;
    notes: string;
    localDate: string;
    durationS: number;
    exercises: WorkoutExerciseDto[];
  },
): Promise<WorkoutDto> {
  const user = await userOf(db, userId);
  if (input.localDate > localDateIn(user.timezone)) {
    throw badRequest("Workouts can't be in the future");
  }
  const lookup = await loadLookup(db, userId);
  const exercises = normalizeExercises(input.exercises, lookup)
    .map((e) => ({ ...e, sets: e.sets.map((s) => ({ ...s, done: true })) }))
    .filter((e) => e.sets.length > 0);
  if (!exercises.length) throw badRequest("A workout needs at least one set");
  const startedAt = new Date();
  const row = await workoutRepo.insert(db, {
    userId,
    name: input.name,
    notes: input.notes,
    localDate: input.localDate,
    startedAt,
    endedAt: new Date(startedAt.getTime() + input.durationS * 1000),
    templateId: null,
    exercises,
  });
  await touchDays(db, userId, row.localDate);
  return one(db, userId, row);
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
    kind: w.kind,
    name: w.name,
    durationS: w.summary.durationS,
    volumeKg: w.summary.volumeKg,
    lines:
      w.kind === "cardio"
        ? [cardioDayLine(w, lookup, system)]
        : w.exercises.map((e) => {
            const info = lookup.get(e.exerciseId);
            const best = info ? bestSet(info.tracking, e.sets) : null;
            const sets = `${e.sets.length} set${e.sets.length === 1 ? "" : "s"}`;
            return `${nameOf(lookup, e.exerciseId)}: ${sets}${best && info ? `, best ${formatSet(info.tracking, best, system)}` : ""}`;
          }),
    prs: w.summary.prs.map((p) => p.label),
  }));
}

function cardioDayLine(w: WorkoutDto, lookup: Lookup, system: UnitSystem) {
  const s = cardioSession(w);
  return `${nameOf(lookup, s.activityId)}: ${cardioLine(s.activityId, s.distanceM, s.durationS, w.cardio, system)}`;
}

// Cardio

type CardioBody = z.infer<typeof cardioBodySchema>;

/** The session as a workout document: the activity with one done set. */
function cardioFields(input: CardioBody, lookup: Lookup) {
  const info = lookup.get(input.activity);
  if (!info) throw badRequest(`Unknown exercise: ${input.activity}`);
  if (!isCardioTracking(info.tracking)) {
    throw badRequest("Pick an activity that records time");
  }
  const distanceM = TRACKING_FIELDS[info.tracking].includes("distance") ? input.distanceM : null;
  const exercises: WorkoutExerciseDto[] = [
    {
      exerciseId: info.id,
      notes: "",
      sets: [{ ...emptySet(), durationS: input.durationS, distanceM, done: true }],
      restS: null,
    },
  ];
  const cardio: CardioDetailsDto = {
    avgHeartRate: input.avgHeartRate,
    calories: input.calories,
    elevationM: input.elevationM,
    effort: input.effort,
  };
  return { name: input.name ?? info.name, notes: input.notes.trim(), exercises, cardio };
}

async function checkCardioDate(db: Database, userId: string, localDate: string) {
  const user = await userOf(db, userId);
  if (localDate > localDateIn(user.timezone)) throw badRequest("Workouts can't be in the future");
  return user;
}

/** Logs a finished cardio session for `localDate`; `startedAt` is the moment it was logged. */
export async function logCardio(
  db: Database,
  userId: string,
  input: CardioBody,
): Promise<WorkoutDto> {
  await checkCardioDate(db, userId, input.localDate);
  const fields = cardioFields(input, await loadLookup(db, userId));
  const startedAt = new Date();
  const row = await workoutRepo.insert(db, {
    userId,
    kind: "cardio",
    ...fields,
    localDate: input.localDate,
    startedAt,
    endedAt: new Date(startedAt.getTime() + input.durationS * 1000),
    templateId: null,
  });
  await touchDays(db, userId, row.localDate);
  return one(db, userId, row);
}

/** Replaces a cardio session's activity, numbers and day. */
export async function updateCardio(
  db: Database,
  userId: string,
  id: string,
  input: CardioBody,
): Promise<WorkoutDto> {
  const row = await workoutRepo.findById(db, userId, id);
  if (!row || row.kind !== "cardio") throw notFound("Cardio session not found");
  await checkCardioDate(db, userId, input.localDate);
  const updated = await workoutRepo.update(db, row.id, {
    ...cardioFields(input, await loadLookup(db, userId)),
    localDate: input.localDate,
    endedAt: new Date(row.startedAt.getTime() + input.durationS * 1000),
  });
  await touchDays(db, userId, row.localDate, updated.localDate);
  return one(db, userId, updated);
}

const RECENT_CARDIO = 20;

/** Totals for the last 7 and 30 days, per-activity bests, and the latest sessions. */
export async function cardioOverview(db: Database, userId: string): Promise<CardioOverviewDto> {
  const [user, completed] = await Promise.all([
    userOf(db, userId),
    workoutRepo.findCompleted(db, userId),
  ]);
  const rows = completed.filter((r) => r.kind === "cardio");
  const today = localDateIn(user.timezone);
  const totals = (from: string): CardioTotalsDto => {
    const out = { sessions: 0, distanceM: 0, durationS: 0 };
    for (const r of rows) {
      if (r.localDate < from || r.localDate > today) continue;
      const s = sessionOf(r);
      out.sessions += 1;
      out.distanceM += s.distanceM ?? 0;
      out.durationS += s.durationS;
    }
    return out;
  };

  const activities = new Map<string, CardioActivityDto>();
  for (const r of rows) {
    const s = sessionOf(r);
    const a = activities.get(s.activityId) ?? {
      activityId: s.activityId,
      sessions: 0,
      distanceM: 0,
      durationS: 0,
      longestM: null,
      longestS: null,
      bestPaceSPerKm: null,
      lastDone: r.localDate,
    };
    a.sessions += 1;
    a.distanceM += s.distanceM ?? 0;
    a.durationS += s.durationS;
    if (s.distanceM && (a.longestM === null || s.distanceM > a.longestM)) a.longestM = s.distanceM;
    if (a.longestS === null || s.durationS > a.longestS) a.longestS = s.durationS;
    if (s.distanceM) {
      const pace = s.durationS / (s.distanceM / 1000);
      if (a.bestPaceSPerKm === null || pace < a.bestPaceSPerKm) a.bestPaceSPerKm = pace;
    }
    if (r.localDate > a.lastDone) a.lastDone = r.localDate;
    activities.set(s.activityId, a);
  }

  const recent = rows.slice(-RECENT_CARDIO).reverse();
  return {
    week: totals(addDays(today, -6)),
    month: totals(addDays(today, -29)),
    activities: [...activities.values()].sort((a, b) => b.lastDone.localeCompare(a.lastDone)),
    recent: await buildDtos(db, userId, recent),
  };
}

/** A finished cardio row's activity, distance and time, without building its DTO. */
function sessionOf(row: WorkoutRow) {
  const end = row.endedAt ?? row.startedAt;
  return cardioSession({
    exercises: exercisesOf(row),
    summary: { durationS: Math.round((end.getTime() - row.startedAt.getTime()) / 1000) },
  });
}

// Sports

const RECENT_PRACTICES = 20;

/** Practice totals for the last 7 and 30 days, every sport drill done, and the latest practices. */
export async function sportOverview(db: Database, userId: string): Promise<SportOverviewDto> {
  const [user, completed, lookup] = await Promise.all([
    userOf(db, userId),
    workoutRepo.findCompleted(db, userId),
    loadLookup(db, userId),
  ]);
  const today = localDateIn(user.timezone);
  const practices = completed.filter((r) => r.kind === "sport");
  const totals = (from: string) => {
    const out = { sessions: 0, durationS: 0 };
    for (const r of practices) {
      if (r.localDate < from || r.localDate > today || !r.endedAt) continue;
      out.sessions += 1;
      out.durationS += Math.round((r.endedAt.getTime() - r.startedAt.getTime()) / 1000);
    }
    return out;
  };

  // Drills count wherever they were done, practice or not.
  const monthStart = addDays(today, -29);
  const skills = new Map<string, SportSkillDto & { records: ExerciseRecordsDto | null }>();
  for (const w of completed) {
    for (const e of exercisesOf(w)) {
      const info = lookup.get(e.exerciseId);
      if (!info || info.category !== "sport") continue;
      const skill = skills.get(e.exerciseId) ?? {
        exerciseId: e.exerciseId,
        sessions: 0,
        lastDone: w.localDate,
        headline: HEADLINE_RECORD[info.tracking],
        best: null,
        recent: info.tracking === "makes_attempts" ? { makes: 0, attempts: 0 } : null,
        records: null,
      };
      skill.sessions += 1;
      if (w.localDate > skill.lastDone) skill.lastDone = w.localDate;
      skill.records = mergeRecords(skill.records, recordsFromSets(info.tracking, e.sets));
      if (skill.recent && w.localDate >= monthStart) {
        for (const s of e.sets.filter((x) => x.done)) {
          skill.recent.makes += s.reps ?? 0;
          skill.recent.attempts += s.attempts ?? 0;
        }
      }
      skills.set(e.exerciseId, skill);
    }
  }

  return {
    week: totals(addDays(today, -6)),
    month: totals(monthStart),
    skills: [...skills.values()]
      .map(({ records, ...skill }) => ({ ...skill, best: records?.[skill.headline] ?? null }))
      .sort((a, b) => b.lastDone.localeCompare(a.lastDone)),
    recent: await buildDtos(db, userId, practices.slice(-RECENT_PRACTICES).reverse(), lookup),
  };
}

// Templates

function toTemplateDto(row: TemplateRow): WorkoutTemplateDto {
  return {
    id: row.id,
    kind: liveKind(row.kind),
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
    if (workout.kind === "cardio") throw badRequest("Cardio sessions can't be templates");
    const row = await workoutRepo.insertTemplate(db, {
      userId,
      kind: liveKind(workout.kind),
      name: input.name ?? workout.name,
      notes: workout.notes,
      exercises: asPlan(exercisesOf(workout)),
    });
    return toTemplateDto(row);
  }
  const row = await workoutRepo.insertTemplate(db, {
    userId,
    kind: input.kind,
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
  sport: info.sport,
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
