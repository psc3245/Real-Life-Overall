import { and, eq, inArray } from "drizzle-orm";
import type { Executor } from "../db/client";
import { decayRules } from "../db/schema";

export async function insertMany(
  db: Executor,
  rows: (typeof decayRules.$inferInsert)[],
): Promise<void> {
  if (rows.length) await db.insert(decayRules).values(rows);
}

export async function findActiveByNodes(db: Executor, nodeIds: string[]) {
  if (!nodeIds.length) return [];
  return db
    .select()
    .from(decayRules)
    .where(and(inArray(decayRules.nodeId, nodeIds), eq(decayRules.active, true)));
}
