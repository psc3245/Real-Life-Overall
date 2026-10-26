import { and, asc, eq } from "drizzle-orm";
import type { Executor } from "../db/client";
import { chartViews } from "../db/schema";

export type ChartViewRow = typeof chartViews.$inferSelect;

export async function findByUser(db: Executor, userId: string): Promise<ChartViewRow[]> {
  return db
    .select()
    .from(chartViews)
    .where(eq(chartViews.userId, userId))
    .orderBy(asc(chartViews.createdAt));
}

export async function findById(db: Executor, userId: string, id: string) {
  const rows = await db
    .select()
    .from(chartViews)
    .where(and(eq(chartViews.id, id), eq(chartViews.userId, userId)));
  return rows[0] ?? null;
}

export async function insert(db: Executor, row: typeof chartViews.$inferInsert) {
  const rows = await db.insert(chartViews).values(row).returning();
  return rows[0]!;
}

export async function update(
  db: Executor,
  id: string,
  changes: Partial<Pick<ChartViewRow, "name" | "config" | "pinned">>,
) {
  const rows = await db.update(chartViews).set(changes).where(eq(chartViews.id, id)).returning();
  return rows[0]!;
}

export async function remove(db: Executor, id: string) {
  await db.delete(chartViews).where(eq(chartViews.id, id));
}
