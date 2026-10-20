import type { RatingNodeDto } from "@rlo/shared";
import { and, asc, eq, isNull } from "drizzle-orm";
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
