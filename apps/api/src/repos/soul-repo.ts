import { and, eq, inArray } from "drizzle-orm";
import type { Executor } from "../db/client";
import { ratingNodes, soulLevels } from "../db/schema";

export type SoulLevelRow = typeof soulLevels.$inferSelect;

export async function findBySeason(db: Executor, seasonId: string): Promise<SoulLevelRow[]> {
  return db.select().from(soulLevels).where(eq(soulLevels.seasonId, seasonId));
}

/** Starting levels; a leaf that already has one keeps it. */
export async function insertStarts(db: Executor, rows: (typeof soulLevels.$inferInsert)[]) {
  if (!rows.length) return;
  await db.insert(soulLevels).values(rows).onConflictDoNothing();
}

export async function insertLevelUps(db: Executor, rows: (typeof soulLevels.$inferInsert)[]) {
  if (rows.length) await db.insert(soulLevels).values(rows);
}

/** Each leaf's final level in an earlier season, by lineage (New Game+ starts from these). */
export async function findLevelsByLineage(
  db: Executor,
  seasonId: string,
  lineageIds: string[],
): Promise<Map<string, number>> {
  if (!lineageIds.length) return new Map();
  const rows = await db
    .select({ lineageId: ratingNodes.lineageId, levels: soulLevels.levels })
    .from(soulLevels)
    .innerJoin(ratingNodes, eq(ratingNodes.id, soulLevels.nodeId))
    .where(and(eq(soulLevels.seasonId, seasonId), inArray(ratingNodes.lineageId, lineageIds)));
  const sums = new Map<string, number>();
  for (const r of rows) sums.set(r.lineageId, (sums.get(r.lineageId) ?? 0) + r.levels);
  return sums;
}
