import type { PublicCardDto, PublicCategoryDto } from "@rlo/shared";
import { eq } from "drizzle-orm";
import type { Executor } from "../db/client";
import { playerCards } from "../db/schema";

export type CardRow = typeof playerCards.$inferSelect;

export function toCardDto(row: CardRow): PublicCardDto {
  return {
    overall: row.overall,
    archetype: row.archetype,
    seasonLabel: row.seasonLabel,
    categories: row.categories as PublicCategoryDto[],
    recappedDays: row.recappedDays,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function findByUser(db: Executor, userId: string): Promise<CardRow | null> {
  const rows = await db.select().from(playerCards).where(eq(playerCards.userId, userId));
  return rows[0] ?? null;
}

export async function upsert(db: Executor, row: Omit<CardRow, "updatedAt">): Promise<void> {
  await db
    .insert(playerCards)
    .values(row)
    .onConflictDoUpdate({ target: playerCards.userId, set: { ...row, updatedAt: new Date() } });
}
