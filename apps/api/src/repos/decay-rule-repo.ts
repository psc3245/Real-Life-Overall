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

/** Replaces a node's active rule with a new version, keeping the old one for history. */
export async function revise(
  db: Executor,
  nodeId: string,
  rule: { graceDays: number; perDay: number; floor: number; notes: string },
): Promise<void> {
  const current = await db
    .select({ id: decayRules.id, version: decayRules.version })
    .from(decayRules)
    .where(and(eq(decayRules.nodeId, nodeId), eq(decayRules.active, true)));
  if (current.length) {
    await db
      .update(decayRules)
      .set({ active: false })
      .where(and(eq(decayRules.nodeId, nodeId), eq(decayRules.active, true)));
  }
  const version = Math.max(0, ...current.map((c) => c.version)) + 1;
  await db.insert(decayRules).values({ nodeId, ...rule, version, authoredBy: "llm" });
}
