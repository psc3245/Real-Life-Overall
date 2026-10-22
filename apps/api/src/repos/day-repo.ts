import type { GuidedPromptDto } from "@rlo/shared";
import { and, between, eq } from "drizzle-orm";
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

/** Creates the row if needed so later status changes have something to update. */
export async function ensure(db: Executor, userId: string, localDate: string): Promise<void> {
  await db.insert(dayLogs).values({ userId, localDate }).onConflictDoNothing();
}

export async function setStatus(
  db: Executor,
  userId: string,
  localDate: string,
  status: DayLogRow["status"],
): Promise<void> {
  await db
    .update(dayLogs)
    .set({ status })
    .where(and(eq(dayLogs.userId, userId), eq(dayLogs.localDate, localDate)));
}

/** An edit after a recap means the recap no longer reflects the day. */
export async function markStaleIfRecapped(db: Executor, userId: string, localDate: string) {
  await db
    .update(dayLogs)
    .set({ status: "stale" })
    .where(
      and(
        eq(dayLogs.userId, userId),
        eq(dayLogs.localDate, localDate),
        eq(dayLogs.status, "recapped"),
      ),
    );
}

export async function setPrompts(
  db: Executor,
  userId: string,
  localDate: string,
  prompts: GuidedPromptDto[],
): Promise<void> {
  await db
    .insert(dayLogs)
    .values({ userId, localDate, prompts })
    .onConflictDoUpdate({ target: [dayLogs.userId, dayLogs.localDate], set: { prompts } });
}

export async function findBetween(db: Executor, userId: string, from: string, to: string) {
  return db
    .select({ localDate: dayLogs.localDate, journal: dayLogs.journal })
    .from(dayLogs)
    .where(and(eq(dayLogs.userId, userId), between(dayLogs.localDate, from, to)));
}
