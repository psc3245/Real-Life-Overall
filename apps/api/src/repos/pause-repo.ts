import { asc, eq } from "drizzle-orm";
import type { Executor } from "../db/client";
import { pauses } from "../db/schema";

export type PauseRow = typeof pauses.$inferSelect;

export async function findByUser(db: Executor, userId: string): Promise<PauseRow[]> {
  return db.select().from(pauses).where(eq(pauses.userId, userId)).orderBy(asc(pauses.startsOn));
}

export async function insert(db: Executor, row: typeof pauses.$inferInsert): Promise<PauseRow> {
  const rows = await db.insert(pauses).values(row).returning();
  return rows[0]!;
}

export async function setEnd(db: Executor, id: string, endsOn: string): Promise<PauseRow> {
  const rows = await db.update(pauses).set({ endsOn }).where(eq(pauses.id, id)).returning();
  return rows[0]!;
}

export async function remove(db: Executor, id: string): Promise<void> {
  await db.delete(pauses).where(eq(pauses.id, id));
}
