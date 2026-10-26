import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import type { Executor } from "../db/client";
import { objectiveEntries, objectiveLinks, objectives } from "../db/schema";

export type ObjectiveRow = typeof objectives.$inferSelect;

/** Goals that haven't been deleted, soonest deadline first. */
export async function findActiveByUser(db: Executor, userId: string): Promise<ObjectiveRow[]> {
  return db
    .select()
    .from(objectives)
    .where(and(eq(objectives.userId, userId), isNull(objectives.archivedAt)))
    .orderBy(asc(objectives.endsOn), asc(objectives.createdAt));
}

export async function findById(
  db: Executor,
  userId: string,
  id: string,
): Promise<ObjectiveRow | null> {
  const rows = await db
    .select()
    .from(objectives)
    .where(and(eq(objectives.id, id), eq(objectives.userId, userId)));
  return rows[0] ?? null;
}

export async function insert(
  db: Executor,
  row: typeof objectives.$inferInsert,
): Promise<ObjectiveRow> {
  const rows = await db.insert(objectives).values(row).returning();
  return rows[0]!;
}

export async function update(
  db: Executor,
  id: string,
  changes: Partial<
    Pick<ObjectiveRow, "name" | "unit" | "target" | "startsOn" | "endsOn" | "archivedAt">
  >,
): Promise<ObjectiveRow> {
  const rows = await db.update(objectives).set(changes).where(eq(objectives.id, id)).returning();
  return rows[0]!;
}

export async function findLinks(db: Executor, objectiveIds: string[]) {
  if (!objectiveIds.length) return [];
  return db.select().from(objectiveLinks).where(inArray(objectiveLinks.objectiveId, objectiveIds));
}

export async function replaceLinks(db: Executor, objectiveId: string, lineageIds: string[]) {
  await db.delete(objectiveLinks).where(eq(objectiveLinks.objectiveId, objectiveId));
  if (lineageIds.length) {
    await db
      .insert(objectiveLinks)
      .values(lineageIds.map((nodeLineageId) => ({ objectiveId, nodeLineageId })));
  }
}

export async function findEntries(db: Executor, objectiveIds: string[]) {
  if (!objectiveIds.length) return [];
  return db
    .select()
    .from(objectiveEntries)
    .where(inArray(objectiveEntries.objectiveId, objectiveIds));
}

export async function upsertEntry(
  db: Executor,
  objectiveId: string,
  localDate: string,
  value: number,
) {
  await db
    .insert(objectiveEntries)
    .values({ objectiveId, localDate, value })
    .onConflictDoUpdate({
      target: [objectiveEntries.objectiveId, objectiveEntries.localDate],
      set: { value },
    });
}

export async function deleteEntry(db: Executor, objectiveId: string, localDate: string) {
  await db
    .delete(objectiveEntries)
    .where(
      and(eq(objectiveEntries.objectiveId, objectiveId), eq(objectiveEntries.localDate, localDate)),
    );
}
