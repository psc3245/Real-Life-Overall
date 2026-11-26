import { and, asc, eq, isNull } from "drizzle-orm";
import type { Executor } from "../db/client";
import { gamePlans } from "../db/schema";

export type GamePlanRow = typeof gamePlans.$inferSelect;

/** Game Plans that haven't been deleted, earliest start first. */
export async function findActiveByUser(db: Executor, userId: string): Promise<GamePlanRow[]> {
  return db
    .select()
    .from(gamePlans)
    .where(and(eq(gamePlans.userId, userId), isNull(gamePlans.archivedAt)))
    .orderBy(asc(gamePlans.startsOn), asc(gamePlans.createdAt));
}

export async function findById(
  db: Executor,
  userId: string,
  id: string,
): Promise<GamePlanRow | null> {
  const rows = await db
    .select()
    .from(gamePlans)
    .where(and(eq(gamePlans.id, id), eq(gamePlans.userId, userId)));
  return rows[0] ?? null;
}

export async function insert(
  db: Executor,
  row: typeof gamePlans.$inferInsert,
): Promise<GamePlanRow> {
  const rows = await db.insert(gamePlans).values(row).returning();
  return rows[0]!;
}

export async function update(
  db: Executor,
  id: string,
  changes: Partial<
    Pick<GamePlanRow, "name" | "note" | "startsOn" | "endsOn" | "nodeLineageIds" | "archivedAt">
  >,
): Promise<GamePlanRow> {
  const rows = await db.update(gamePlans).set(changes).where(eq(gamePlans.id, id)).returning();
  return rows[0]!;
}
