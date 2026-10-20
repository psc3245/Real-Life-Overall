import { and, asc, eq, isNull } from "drizzle-orm";
import type { Executor } from "../db/client";
import { ratingEvents } from "../db/schema";

export type RatingEventRow = typeof ratingEvents.$inferSelect;

export async function insertMany(
  db: Executor,
  rows: (typeof ratingEvents.$inferInsert)[],
): Promise<void> {
  if (rows.length) await db.insert(ratingEvents).values(rows);
}

/** Non-voided events for a season, oldest first. */
export async function findActiveBySeason(
  db: Executor,
  seasonId: string,
): Promise<RatingEventRow[]> {
  return db
    .select()
    .from(ratingEvents)
    .where(and(eq(ratingEvents.seasonId, seasonId), isNull(ratingEvents.voidedAt)))
    .orderBy(asc(ratingEvents.createdAt));
}
