import { and, eq } from "drizzle-orm";
import type { Executor } from "../db/client";
import { dayLogs } from "../db/schema";

export type DayLogRow = typeof dayLogs.$inferSelect;

export async function find(
  db: Executor,
  userId: string,
  localDate: string,
): Promise<DayLogRow | null> {
  const rows = await db
    .select()
    .from(dayLogs)
    .where(and(eq(dayLogs.userId, userId), eq(dayLogs.localDate, localDate)));
  return rows[0] ?? null;
}

export async function upsertJournal(
  db: Executor,
  userId: string,
  localDate: string,
  journal: string,
) {
  await db
    .insert(dayLogs)
    .values({ userId, localDate, journal })
    .onConflictDoUpdate({ target: [dayLogs.userId, dayLogs.localDate], set: { journal } });
}
