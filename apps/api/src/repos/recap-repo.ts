import { and, desc, eq, gte, lt } from "drizzle-orm";
import type { Executor } from "../db/client";
import { recaps } from "../db/schema";

export type RecapRow = typeof recaps.$inferSelect;

export async function findActiveDaily(
  db: Executor,
  userId: string,
  date: string,
): Promise<RecapRow | null> {
  const rows = await db
    .select()
    .from(recaps)
    .where(
      and(
        eq(recaps.userId, userId),
        eq(recaps.kind, "daily"),
        eq(recaps.periodStart, date),
        eq(recaps.status, "active"),
      ),
    );
  return rows[0] ?? null;
}

/** All recaps for a day, including superseded ones (for the re-run limit). */
export async function countDaily(db: Executor, userId: string, date: string): Promise<number> {
  const rows = await db
    .select({ id: recaps.id })
    .from(recaps)
    .where(and(eq(recaps.userId, userId), eq(recaps.kind, "daily"), eq(recaps.periodStart, date)));
  return rows.length;
}

/** Active daily recaps in [from, to), newest first. */
export async function findRecentDaily(db: Executor, userId: string, from: string, to: string) {
  return db
    .select({ periodStart: recaps.periodStart, narrative: recaps.narrative })
    .from(recaps)
    .where(
      and(
        eq(recaps.userId, userId),
        eq(recaps.kind, "daily"),
        eq(recaps.status, "active"),
        gte(recaps.periodStart, from),
        lt(recaps.periodStart, to),
      ),
    )
    .orderBy(desc(recaps.periodStart));
}

export async function insert(db: Executor, row: typeof recaps.$inferInsert): Promise<RecapRow> {
  const rows = await db.insert(recaps).values(row).returning();
  return rows[0]!;
}

export async function supersede(db: Executor, id: string): Promise<void> {
  await db.update(recaps).set({ status: "superseded" }).where(eq(recaps.id, id));
}
