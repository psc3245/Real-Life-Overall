import { and, count, desc, eq, gte, lt, lte, sql } from "drizzle-orm";
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

export async function findActiveWeekly(db: Executor, userId: string, weekStart: string) {
  const rows = await db
    .select()
    .from(recaps)
    .where(
      and(
        eq(recaps.userId, userId),
        eq(recaps.kind, "weekly"),
        eq(recaps.periodStart, weekStart),
        eq(recaps.status, "active"),
      ),
    );
  return rows[0] ?? null;
}

export async function findWeeklyHistory(db: Executor, userId: string, limit: number) {
  return db
    .select()
    .from(recaps)
    .where(and(eq(recaps.userId, userId), eq(recaps.kind, "weekly"), eq(recaps.status, "active")))
    .orderBy(desc(recaps.periodStart))
    .limit(limit);
}

export async function findById(db: Executor, userId: string, id: string) {
  const rows = await db
    .select()
    .from(recaps)
    .where(and(eq(recaps.id, id), eq(recaps.userId, userId)));
  return rows[0] ?? null;
}

/** Active daily recaps within [from, to], oldest first. */
export async function findDailyBetween(db: Executor, userId: string, from: string, to: string) {
  return db
    .select()
    .from(recaps)
    .where(
      and(
        eq(recaps.userId, userId),
        eq(recaps.kind, "daily"),
        eq(recaps.status, "active"),
        gte(recaps.periodStart, from),
        lte(recaps.periodStart, to),
      ),
    )
    .orderBy(recaps.periodStart);
}

export async function updateOutput(db: Executor, id: string, output: unknown): Promise<void> {
  await db.update(recaps).set({ output }).where(eq(recaps.id, id));
}

/** Days with a current daily recap on or after `from` (a season's start). */
export async function countRecappedDaysSince(db: Executor, userId: string, from: string) {
  const [row] = await db
    .select({ n: count() })
    .from(recaps)
    .where(
      and(
        eq(recaps.userId, userId),
        eq(recaps.kind, "daily"),
        eq(recaps.status, "active"),
        gte(recaps.periodStart, from),
      ),
    );
  return row?.n ?? 0;
}

/** Of those, days whose recap flagged implausible or ambiguous claims. */
export async function countFlaggedDaysSince(db: Executor, userId: string, from: string) {
  const [row] = await db
    .select({ n: count() })
    .from(recaps)
    .where(
      and(
        eq(recaps.userId, userId),
        eq(recaps.kind, "daily"),
        eq(recaps.status, "active"),
        gte(recaps.periodStart, from),
        sql`jsonb_array_length(coalesce(${recaps.output} -> 'flags', '[]'::jsonb)) > 0`,
      ),
    );
  return row?.n ?? 0;
}
