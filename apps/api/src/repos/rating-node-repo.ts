import type { RatingNodeDto } from "@rlo/shared";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import type { Executor } from "../db/client";
import { ratingNodes } from "../db/schema";

export const ratingNodeColumns = {
  id: ratingNodes.id,
  parentId: ratingNodes.parentId,
  name: ratingNodes.name,
  description: ratingNodes.description,
  depth: ratingNodes.depth,
  weight: ratingNodes.weight,
  sortOrder: ratingNodes.sortOrder,
  templateKey: ratingNodes.templateKey,
};

export async function findActiveBySeason(db: Executor, seasonId: string): Promise<RatingNodeDto[]> {
  return db
    .select(ratingNodeColumns)
    .from(ratingNodes)
    .where(and(eq(ratingNodes.seasonId, seasonId), isNull(ratingNodes.archivedAt)))
    .orderBy(asc(ratingNodes.depth), asc(ratingNodes.sortOrder));
}

export async function deleteBySeason(db: Executor, seasonId: string): Promise<void> {
  await db.delete(ratingNodes).where(eq(ratingNodes.seasonId, seasonId));
}

export async function insertMany(
  db: Executor,
  rows: (typeof ratingNodes.$inferInsert)[],
): Promise<void> {
  if (rows.length) await db.insert(ratingNodes).values(rows);
}

export async function updateWeight(
  db: Executor,
  seasonId: string,
  nodeId: string,
  weight: number,
): Promise<boolean> {
  const rows = await db
    .update(ratingNodes)
    .set({ weight })
    .where(and(eq(ratingNodes.id, nodeId), eq(ratingNodes.seasonId, seasonId)))
    .returning({ id: ratingNodes.id });
  return rows.length > 0;
}

/** Node id ↔ lineage id for a season, so cross-season references can be resolved. */
export async function findLineages(db: Executor, seasonId: string) {
  return db
    .select({ id: ratingNodes.id, lineageId: ratingNodes.lineageId })
    .from(ratingNodes)
    .where(and(eq(ratingNodes.seasonId, seasonId), isNull(ratingNodes.archivedAt)));
}

/** Every active node with its lineage, for copying a tree into a new season. */
export async function findActiveWithLineage(db: Executor, seasonId: string) {
  return db
    .select()
    .from(ratingNodes)
    .where(and(eq(ratingNodes.seasonId, seasonId), isNull(ratingNodes.archivedAt)))
    .orderBy(asc(ratingNodes.depth), asc(ratingNodes.sortOrder));
}

export async function updateNode(
  db: Executor,
  id: string,
  changes: Partial<
    Pick<
      typeof ratingNodes.$inferInsert,
      "name" | "description" | "weight" | "parentId" | "depth" | "sortOrder"
    >
  >,
): Promise<void> {
  await db.update(ratingNodes).set(changes).where(eq(ratingNodes.id, id));
}

export async function archiveNodes(db: Executor, ids: string[]): Promise<void> {
  if (ids.length) {
    await db
      .update(ratingNodes)
      .set({ archivedAt: new Date() })
      .where(inArray(ratingNodes.id, ids));
  }
}
