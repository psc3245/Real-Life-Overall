import { and, asc, eq, isNull } from "drizzle-orm";
import type { Executor } from "../db/client";
import { customPrompts } from "../db/schema";

export type CustomPromptRow = typeof customPrompts.$inferSelect;

/** Questions that haven't been deleted, oldest first. */
export async function findActiveByUser(db: Executor, userId: string): Promise<CustomPromptRow[]> {
  return db
    .select()
    .from(customPrompts)
    .where(and(eq(customPrompts.userId, userId), isNull(customPrompts.archivedAt)))
    .orderBy(asc(customPrompts.createdAt));
}

export async function findById(
  db: Executor,
  userId: string,
  id: string,
): Promise<CustomPromptRow | null> {
  const rows = await db
    .select()
    .from(customPrompts)
    .where(and(eq(customPrompts.id, id), eq(customPrompts.userId, userId)));
  return rows[0] ?? null;
}

export async function insert(
  db: Executor,
  row: typeof customPrompts.$inferInsert,
): Promise<CustomPromptRow> {
  const rows = await db.insert(customPrompts).values(row).returning();
  return rows[0]!;
}

export async function update(
  db: Executor,
  id: string,
  changes: Partial<Pick<CustomPromptRow, "question" | "days" | "archivedAt">>,
): Promise<CustomPromptRow> {
  const rows = await db
    .update(customPrompts)
    .set(changes)
    .where(eq(customPrompts.id, id))
    .returning();
  return rows[0]!;
}
