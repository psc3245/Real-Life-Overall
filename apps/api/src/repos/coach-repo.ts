import { and, count, desc, eq, gte } from "drizzle-orm";
import type { Executor } from "../db/client";
import { coachMessages } from "../db/schema";

export type CoachMessageRow = typeof coachMessages.$inferSelect;

/** The newest `limit` messages, oldest first. */
export async function findRecent(
  db: Executor,
  userId: string,
  limit: number,
): Promise<CoachMessageRow[]> {
  const rows = await db
    .select()
    .from(coachMessages)
    .where(eq(coachMessages.userId, userId))
    .orderBy(desc(coachMessages.createdAt), desc(coachMessages.role))
    .limit(limit);
  return rows.reverse();
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

export async function deleteAll(db: Executor, userId: string) {
  await db.delete(coachMessages).where(eq(coachMessages.userId, userId));
}
