import { and, asc, between, eq, inArray } from "drizzle-orm";
import type { Executor } from "../db/client";
import { habitEntries, habitLinks, habits } from "../db/schema";

export type HabitRow = typeof habits.$inferSelect;

export async function findAllByUser(db: Executor, userId: string): Promise<HabitRow[]> {
  return db
    .select()
    .from(habits)
    .where(eq(habits.userId, userId))
    .orderBy(asc(habits.sortOrder), asc(habits.createdAt));
}

export async function findById(db: Executor, userId: string, id: string): Promise<HabitRow | null> {
  const rows = await db
    .select()
    .from(habits)
    .where(and(eq(habits.id, id), eq(habits.userId, userId)));
  return rows[0] ?? null;
}

export async function insert(db: Executor, row: typeof habits.$inferInsert): Promise<HabitRow> {
  const rows = await db.insert(habits).values(row).returning();
  return rows[0]!;
}

export async function update(
  db: Executor,
  id: string,
  changes: Partial<
    Pick<HabitRow, "name" | "config" | "days" | "startsOn" | "archivedAt" | "sortOrder">
  >,
): Promise<HabitRow> {
  const rows = await db.update(habits).set(changes).where(eq(habits.id, id)).returning();
  return rows[0]!;
}

export async function findLinks(db: Executor, habitIds: string[]) {
  if (!habitIds.length) return [];
  return db.select().from(habitLinks).where(inArray(habitLinks.habitId, habitIds));
}

export async function replaceLinks(db: Executor, habitId: string, lineageIds: string[]) {
  await db.delete(habitLinks).where(eq(habitLinks.habitId, habitId));
  if (lineageIds.length) {
    await db
      .insert(habitLinks)
      .values(lineageIds.map((nodeLineageId) => ({ habitId, nodeLineageId })));
  }
}

export async function findEntriesOn(db: Executor, habitIds: string[], localDate: string) {
  if (!habitIds.length) return [];
  return db
    .select()
    .from(habitEntries)
    .where(and(inArray(habitEntries.habitId, habitIds), eq(habitEntries.localDate, localDate)));
}

export async function upsertEntry(
  db: Executor,
  habitId: string,
  localDate: string,
  value: { valueNum: number | null; valueText: string | null },
) {
  await db
    .insert(habitEntries)
    .values({ habitId, localDate, ...value })
    .onConflictDoUpdate({ target: [habitEntries.habitId, habitEntries.localDate], set: value });
}

export async function deleteEntry(db: Executor, habitId: string, localDate: string) {
  await db
    .delete(habitEntries)
    .where(and(eq(habitEntries.habitId, habitId), eq(habitEntries.localDate, localDate)));
}

export async function findEntriesBetween(
  db: Executor,
  habitIds: string[],
  from: string,
  to: string,
) {
  if (!habitIds.length) return [];
  return db
    .select()
    .from(habitEntries)
    .where(and(inArray(habitEntries.habitId, habitIds), between(habitEntries.localDate, from, to)));
}
