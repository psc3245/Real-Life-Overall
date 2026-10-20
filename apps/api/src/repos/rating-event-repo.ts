import { and, asc, desc, eq, isNull } from "drizzle-orm";
import type { Executor } from "../db/client";
import { ratingEvents, ratingNodes, recaps } from "../db/schema";

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

export async function voidByRecap(db: Executor, recapId: string): Promise<void> {
  await db
    .update(ratingEvents)
    .set({ voidedAt: new Date() })
    .where(and(eq(ratingEvents.recapId, recapId), isNull(ratingEvents.voidedAt)));
}

/** Newest non-voided changes in a season, with attribute names and the recapped day. */
export async function findFeed(db: Executor, seasonId: string, limit: number) {
  return db
    .select({
      id: ratingEvents.id,
      nodeId: ratingEvents.nodeId,
      nodeName: ratingNodes.name,
      delta: ratingEvents.delta,
      reason: ratingEvents.reason,
      source: ratingEvents.source,
      date: recaps.periodStart,
      createdAt: ratingEvents.createdAt,
    })
    .from(ratingEvents)
    .innerJoin(ratingNodes, eq(ratingNodes.id, ratingEvents.nodeId))
    .leftJoin(recaps, eq(recaps.id, ratingEvents.recapId))
    .where(and(eq(ratingEvents.seasonId, seasonId), isNull(ratingEvents.voidedAt)))
    .orderBy(desc(ratingEvents.createdAt))
    .limit(limit);
}
