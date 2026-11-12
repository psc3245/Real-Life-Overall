import { and, count, desc, eq, gte } from "drizzle-orm";
import type { Executor } from "../db/client";
import { coachMessages, coachThreads } from "../db/schema";

export type CoachMessageRow = typeof coachMessages.$inferSelect;
export type CoachThreadRow = typeof coachThreads.$inferSelect;

/** A thread's newest `limit` messages, oldest first. */
export async function findRecent(
  db: Executor,
  threadId: string,
  limit: number,
): Promise<CoachMessageRow[]> {
  const rows = await db
    .select()
    .from(coachMessages)
    .where(eq(coachMessages.threadId, threadId))
    .orderBy(desc(coachMessages.createdAt), desc(coachMessages.role))
    .limit(limit);
  return rows.reverse();
}

/** Newest activity first. */
export async function findThreads(db: Executor, userId: string, limit: number) {
  return db
    .select()
    .from(coachThreads)
    .where(eq(coachThreads.userId, userId))
    .orderBy(desc(coachThreads.updatedAt))
    .limit(limit);
}

export async function findThread(db: Executor, userId: string, id: string) {
  const rows = await db
    .select()
    .from(coachThreads)
    .where(and(eq(coachThreads.id, id), eq(coachThreads.userId, userId)));
  return rows[0] ?? null;
}

export async function insertThread(db: Executor, row: typeof coachThreads.$inferInsert) {
  const rows = await db.insert(coachThreads).values(row).returning();
  return rows[0]!;
}

export async function touchThread(db: Executor, id: string, at: Date) {
  await db.update(coachThreads).set({ updatedAt: at }).where(eq(coachThreads.id, id));
}

export async function deleteThread(db: Executor, id: string) {
  await db.delete(coachThreads).where(eq(coachThreads.id, id));
}

export async function countUserMessagesSince(db: Executor, userId: string, since: Date) {
  const rows = await db
    .select({ n: count() })
    .from(coachMessages)
    .where(
      and(
        eq(coachMessages.userId, userId),
        eq(coachMessages.role, "user"),
        gte(coachMessages.createdAt, since),
      ),
    );
  return rows[0]?.n ?? 0;
}

export async function insertMany(db: Executor, rows: (typeof coachMessages.$inferInsert)[]) {
  return db.insert(coachMessages).values(rows).returning();
}

export async function findById(db: Executor, userId: string, id: string) {
  const rows = await db
    .select()
    .from(coachMessages)
    .where(and(eq(coachMessages.id, id), eq(coachMessages.userId, userId)));
  return rows[0] ?? null;
}

export async function updateSuggestions(db: Executor, id: string, suggestions: unknown) {
  await db.update(coachMessages).set({ suggestions }).where(eq(coachMessages.id, id));
}

export async function updateActions(db: Executor, id: string, actions: unknown) {
  await db.update(coachMessages).set({ actions }).where(eq(coachMessages.id, id));
}

/** Every thread and, through the cascade, every message. */
export async function deleteAll(db: Executor, userId: string) {
  await db.delete(coachThreads).where(eq(coachThreads.userId, userId));
}
