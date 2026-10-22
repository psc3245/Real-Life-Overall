import { eq, inArray } from "drizzle-orm";
import type { Executor } from "../db/client";
import { goals } from "../db/schema";

export async function findByNodes(db: Executor, nodeIds: string[]) {
  if (!nodeIds.length) return [];
  return db.select().from(goals).where(inArray(goals.nodeId, nodeIds));
}

export async function upsert(db: Executor, nodeId: string, targetValue: number): Promise<void> {
  await db
    .insert(goals)
    .values({ nodeId, targetValue })
    .onConflictDoUpdate({ target: goals.nodeId, set: { targetValue } });
}

export async function remove(db: Executor, nodeId: string): Promise<void> {
  await db.delete(goals).where(eq(goals.nodeId, nodeId));
}
