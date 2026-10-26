import { and, asc, desc, eq, isNotNull, isNull, lt } from "drizzle-orm";
import type { Executor } from "../db/client";
import { exercises, workoutTemplates, workouts } from "../db/schema";

export type WorkoutRow = typeof workouts.$inferSelect;
export type TemplateRow = typeof workoutTemplates.$inferSelect;
export type ExerciseRow = typeof exercises.$inferSelect;

// Workouts

export async function findInProgress(db: Executor, userId: string): Promise<WorkoutRow | null> {
  const rows = await db
    .select()
    .from(workouts)
    .where(and(eq(workouts.userId, userId), isNull(workouts.endedAt)));
  return rows[0] ?? null;
}

export async function findById(
  db: Executor,
  userId: string,
  id: string,
): Promise<WorkoutRow | null> {
  const rows = await db
    .select()
    .from(workouts)
    .where(and(eq(workouts.id, id), eq(workouts.userId, userId)));
  return rows[0] ?? null;
}

/** Every finished workout, oldest first (records and "previous" sets replay them). */
export async function findCompleted(db: Executor, userId: string): Promise<WorkoutRow[]> {
  return db
    .select()
    .from(workouts)
    .where(and(eq(workouts.userId, userId), isNotNull(workouts.endedAt)))
    .orderBy(asc(workouts.startedAt));
}

/** Finished workouts newest first, started before `before`. */
export async function findCompletedPage(
  db: Executor,
  userId: string,
  before: Date | null,
  limit: number,
): Promise<WorkoutRow[]> {
  return db
    .select()
    .from(workouts)
    .where(
      and(
        eq(workouts.userId, userId),
        isNotNull(workouts.endedAt),
        before ? lt(workouts.startedAt, before) : undefined,
      ),
    )
    .orderBy(desc(workouts.startedAt))
    .limit(limit);
}

export async function findCompletedOn(db: Executor, userId: string, localDate: string) {
  return db
    .select()
    .from(workouts)
    .where(
      and(
        eq(workouts.userId, userId),
        eq(workouts.localDate, localDate),
        isNotNull(workouts.endedAt),
      ),
    )
    .orderBy(asc(workouts.startedAt));
}

export async function insert(db: Executor, row: typeof workouts.$inferInsert): Promise<WorkoutRow> {
  const rows = await db.insert(workouts).values(row).returning();
  return rows[0]!;
}

export async function update(
  db: Executor,
  id: string,
  changes: Partial<
    Pick<WorkoutRow, "name" | "notes" | "exercises" | "localDate" | "startedAt" | "endedAt">
  >,
): Promise<WorkoutRow> {
  const rows = await db.update(workouts).set(changes).where(eq(workouts.id, id)).returning();
  return rows[0]!;
}

export async function remove(db: Executor, id: string) {
  await db.delete(workouts).where(eq(workouts.id, id));
}

// Templates

export async function findTemplates(db: Executor, userId: string): Promise<TemplateRow[]> {
  return db
    .select()
    .from(workoutTemplates)
    .where(eq(workoutTemplates.userId, userId))
    .orderBy(asc(workoutTemplates.createdAt));
}

export async function findTemplate(
  db: Executor,
  userId: string,
  id: string,
): Promise<TemplateRow | null> {
  const rows = await db
    .select()
    .from(workoutTemplates)
    .where(and(eq(workoutTemplates.id, id), eq(workoutTemplates.userId, userId)));
  return rows[0] ?? null;
}

export async function insertTemplate(
  db: Executor,
  row: typeof workoutTemplates.$inferInsert,
): Promise<TemplateRow> {
  const rows = await db.insert(workoutTemplates).values(row).returning();
  return rows[0]!;
}

export async function updateTemplate(
  db: Executor,
  id: string,
  changes: Partial<Pick<TemplateRow, "name" | "notes" | "exercises" | "lastUsedAt">>,
): Promise<TemplateRow> {
  const rows = await db
    .update(workoutTemplates)
    .set(changes)
    .where(eq(workoutTemplates.id, id))
    .returning();
  return rows[0]!;
}

export async function removeTemplate(db: Executor, id: string) {
  await db.delete(workoutTemplates).where(eq(workoutTemplates.id, id));
}

// Custom exercises

/** All of a user's custom exercises, archived included (old workouts still name them). */
export async function findExercises(db: Executor, userId: string): Promise<ExerciseRow[]> {
  return db
    .select()
    .from(exercises)
    .where(eq(exercises.userId, userId))
    .orderBy(asc(exercises.name));
}

export async function insertExercise(
  db: Executor,
  row: typeof exercises.$inferInsert,
): Promise<ExerciseRow> {
  const rows = await db.insert(exercises).values(row).returning();
  return rows[0]!;
}

export async function updateExercise(
  db: Executor,
  id: string,
  changes: Partial<Pick<ExerciseRow, "name" | "category" | "tracking" | "archivedAt">>,
): Promise<ExerciseRow> {
  const rows = await db.update(exercises).set(changes).where(eq(exercises.id, id)).returning();
  return rows[0]!;
}
