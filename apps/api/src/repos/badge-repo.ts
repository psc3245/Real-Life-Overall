import { and, desc, eq, inArray } from "drizzle-orm";
import type { Executor } from "../db/client";
import { userBadges } from "../db/schema";

export type BadgeRow = typeof userBadges.$inferSelect;

export async function findByUser(db: Executor, userId: string): Promise<BadgeRow[]> {
  return db
    .select()
    .from(userBadges)
    .where(eq(userBadges.userId, userId))
    .orderBy(desc(userBadges.earnedAt));
}

export async function findByRecaps(db: Executor, recapIds: string[]): Promise<BadgeRow[]> {
  if (!recapIds.length) return [];
  return db.select().from(userBadges).where(inArray(userBadges.recapId, recapIds));
}

/** Inserts badges not yet earned; returns only the new ones. */
export async function insertNew(
  db: Executor,
  rows: (typeof userBadges.$inferInsert)[],
): Promise<BadgeRow[]> {
  if (!rows.length) return [];
  return db.insert(userBadges).values(rows).onConflictDoNothing().returning();
}

export async function countPersonal(db: Executor, userId: string, seasonId: string) {
  const rows = await db
    .select({ id: userBadges.id })
    .from(userBadges)
    .where(
      and(
        eq(userBadges.userId, userId),
        eq(userBadges.kind, "personal"),
        eq(userBadges.seasonId, seasonId),
      ),
    );
  return rows.length;
}
