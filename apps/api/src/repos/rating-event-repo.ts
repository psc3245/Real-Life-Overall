import { and, asc, desc, eq, gt, isNull } from "drizzle-orm";
import type { Executor } from "../db/client";
import { decayRuns, ratingEvents, ratingNodes, recaps } from "../db/schema";

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
  return (
    db
      .select({
        id: ratingEvents.id,
        nodeId: ratingEvents.nodeId,
        nodeName: ratingNodes.name,
        delta: ratingEvents.delta,
        reason: ratingEvents.reason,
        source: ratingEvents.source,
        recapDate: recaps.periodStart,
        decayDate: decayRuns.localDate,
        createdAt: ratingEvents.createdAt,
      })
      .from(ratingEvents)
      .innerJoin(ratingNodes, eq(ratingNodes.id, ratingEvents.nodeId))
      .leftJoin(recaps, eq(recaps.id, ratingEvents.recapId))
      .leftJoin(decayRuns, eq(decayRuns.id, ratingEvents.decayRunId))
      .where(and(eq(ratingEvents.seasonId, seasonId), isNull(ratingEvents.voidedAt)))
      // A decay catch-up writes many days in one transaction (same timestamp): newest day first.
      .orderBy(desc(ratingEvents.createdAt), desc(decayRuns.localDate), desc(recaps.periodStart))
      .limit(limit)
  );
}

/** Dates on which a recap raised each leaf: counts as activity for decay. */
export async function findRecapGains(db: Executor, seasonId: string) {
  return db
    .select({ nodeId: ratingEvents.nodeId, date: recaps.periodStart })
    .from(ratingEvents)
    .innerJoin(recaps, eq(recaps.id, ratingEvents.recapId))
    .where(
      and(
        eq(ratingEvents.seasonId, seasonId),
        isNull(ratingEvents.voidedAt),
        gt(ratingEvents.delta, 0),
        // Weekly corrections aren't activity on any particular day.
        eq(recaps.kind, "daily"),
      ),
    );
}

/** Non-voided events with the local date they belong to (null for onboarding). */
export async function findActiveWithDates(db: Executor, seasonId: string) {
  return db
    .select({
      event: ratingEvents,
      recapKind: recaps.kind,
      recapStart: recaps.periodStart,
      recapEnd: recaps.periodEnd,
      decayDate: decayRuns.localDate,
    })
    .from(ratingEvents)
    .leftJoin(recaps, eq(recaps.id, ratingEvents.recapId))
    .leftJoin(decayRuns, eq(decayRuns.id, ratingEvents.decayRunId))
    .where(and(eq(ratingEvents.seasonId, seasonId), isNull(ratingEvents.voidedAt)));
}
