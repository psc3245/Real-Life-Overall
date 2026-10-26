import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import type { Executor } from "../db/client";
import { treeProposals, weightChanges } from "../db/schema";

export type WeightChangeRow = typeof weightChanges.$inferSelect;
export type TreeProposalRow = typeof treeProposals.$inferSelect;

export async function insertWeightChanges(
  db: Executor,
  rows: (typeof weightChanges.$inferInsert)[],
): Promise<void> {
  if (rows.length) await db.insert(weightChanges).values(rows);
}

export async function findWeightChangesBySeason(db: Executor, seasonId: string) {
  return db
    .select()
    .from(weightChanges)
    .where(eq(weightChanges.seasonId, seasonId))
    .orderBy(desc(weightChanges.createdAt));
}

export async function findWeightChangesByRecaps(db: Executor, recapIds: string[]) {
  if (!recapIds.length) return [];
  return db.select().from(weightChanges).where(inArray(weightChanges.recapId, recapIds));
}

export async function findWeightChange(db: Executor, userId: string, id: string) {
  const rows = await db
    .select()
    .from(weightChanges)
    .where(and(eq(weightChanges.id, id), eq(weightChanges.userId, userId)));
  return rows[0] ?? null;
}

/** Marks a change undone; false if it already was (a concurrent undo won). */
export async function markReverted(db: Executor, id: string): Promise<boolean> {
  const rows = await db
    .update(weightChanges)
    .set({ revertedAt: new Date() })
    .where(and(eq(weightChanges.id, id), isNull(weightChanges.revertedAt)))
    .returning({ id: weightChanges.id });
  return rows.length > 0;
}

export async function insertProposal(
  db: Executor,
  row: typeof treeProposals.$inferInsert,
): Promise<TreeProposalRow> {
  const [created] = await db.insert(treeProposals).values(row).returning();
  return created!;
}

export async function findLatestProposal(db: Executor, userId: string) {
  const rows = await db
    .select()
    .from(treeProposals)
    .where(eq(treeProposals.userId, userId))
    .orderBy(desc(treeProposals.createdAt))
    .limit(1);
  return rows[0] ?? null;
}

export async function findProposalsByUser(db: Executor, userId: string, limit = 10) {
  return db
    .select()
    .from(treeProposals)
    .where(eq(treeProposals.userId, userId))
    .orderBy(desc(treeProposals.createdAt))
    .limit(limit);
}

export async function findProposalsByRecaps(db: Executor, recapIds: string[]) {
  if (!recapIds.length) return [];
  return db.select().from(treeProposals).where(inArray(treeProposals.recapId, recapIds));
}

export async function findProposal(db: Executor, userId: string, id: string) {
  const rows = await db
    .select()
    .from(treeProposals)
    .where(and(eq(treeProposals.id, id), eq(treeProposals.userId, userId)));
  return rows[0] ?? null;
}

/** Resolves a pending proposal; false if it was no longer pending. */
export async function resolveProposal(
  db: Executor,
  id: string,
  status: "accepted" | "dismissed" | "expired",
): Promise<boolean> {
  const rows = await db
    .update(treeProposals)
    .set({ status, resolvedAt: new Date() })
    .where(and(eq(treeProposals.id, id), eq(treeProposals.status, "pending")))
    .returning({ id: treeProposals.id });
  return rows.length > 0;
}
