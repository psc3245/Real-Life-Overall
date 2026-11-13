import { and, asc, eq } from "drizzle-orm";
import type { Executor } from "../db/client";
import { habitBuckets } from "../db/schema";

export type HabitBucketRow = typeof habitBuckets.$inferSelect;

export async function findAllByUser(db: Executor, userId: string): Promise<HabitBucketRow[]> {
  return db
    .select()
    .from(habitBuckets)
    .where(eq(habitBuckets.userId, userId))
    .orderBy(asc(habitBuckets.sortOrder), asc(habitBuckets.createdAt));
}

export async function findById(
  db: Executor,
  userId: string,
  id: string,
): Promise<HabitBucketRow | null> {
  const rows = await db
    .select()
    .from(habitBuckets)
    .where(and(eq(habitBuckets.id, id), eq(habitBuckets.userId, userId)));
  return rows[0] ?? null;
}

export async function insert(
  db: Executor,
  row: typeof habitBuckets.$inferInsert,
): Promise<HabitBucketRow> {
  const rows = await db.insert(habitBuckets).values(row).returning();
  return rows[0]!;
}

export async function update(
  db: Executor,
  id: string,
  changes: Partial<Pick<HabitBucketRow, "name" | "sortOrder">>,
): Promise<HabitBucketRow> {
  const rows = await db
    .update(habitBuckets)
    .set(changes)
    .where(eq(habitBuckets.id, id))
    .returning();
  return rows[0]!;
}

export async function remove(db: Executor, id: string): Promise<void> {
  await db.delete(habitBuckets).where(eq(habitBuckets.id, id));
}
