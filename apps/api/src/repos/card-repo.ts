import type { PublicCardDto, PublicCategoryDto, SeasonMode } from "@rlo/shared";
import { and, eq, inArray } from "drizzle-orm";
import type { Executor } from "../db/client";
import { playerCards, users } from "../db/schema";

export type CardRow = typeof playerCards.$inferSelect;

/** A stored card category: its rating (`value`) and growth (absent on cards from before). */
export interface CardCategory extends PublicCategoryDto {
  growth?: number;
}

/**
 * The card's numbers in `mode`: ratings, or points gained. Growth cards always show growth,
 * so a growth player's ratings never leave the server (DESIGN.md §4.6).
 */
export function cardScores(
  row: { overall: number; growth: number; categories: unknown },
  mode: SeasonMode,
): { overall: number; categories: PublicCategoryDto[] } {
  const categories = row.categories as CardCategory[];
  return mode === "growth"
    ? {
        overall: row.growth,
        categories: categories.map((c) => ({
          name: c.name,
          templateKey: c.templateKey,
          value: c.growth ?? 0,
        })),
      }
    : {
        overall: row.overall,
        categories: categories.map((c) => ({
          name: c.name,
          templateKey: c.templateKey,
          value: c.value,
        })),
      };
}

export function toCardDto(row: CardRow): PublicCardDto {
  return {
    mode: row.mode,
    ...cardScores(row, row.mode),
    growth: cardScores(row, "growth"),
    archetype: row.archetype,
    seasonLabel: row.seasonLabel,
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

const boardColumns = {
  userId: playerCards.userId,
  mode: playerCards.mode,
  overall: playerCards.overall,
  growth: playerCards.growth,
  archetype: playerCards.archetype,
  categories: playerCards.categories,
  recappedDays: playerCards.recappedDays,
  flaggedDays: playerCards.flaggedDays,
  username: users.username,
  displayName: users.displayName,
  visibility: users.profileVisibility,
};

/** This season's cards for the given players (a friends board). */
export async function findForPlayers(db: Executor, userIds: string[], seasonLabel: string) {
  if (!userIds.length) return [];
  return db
    .select(boardColumns)
    .from(playerCards)
    .innerJoin(users, eq(users.id, playerCards.userId))
    .where(and(inArray(playerCards.userId, userIds), eq(playerCards.seasonLabel, seasonLabel)));
}

/**
 * This season's cards of everyone on global boards: public and opted in. Ranking happens in
 * memory, which is fine at today's scale; move it into SQL (jsonb category values) if it grows.
 */
export async function findGlobal(db: Executor, seasonLabel: string) {
  return db
    .select(boardColumns)
    .from(playerCards)
    .innerJoin(users, eq(users.id, playerCards.userId))
    .where(
      and(
        eq(playerCards.seasonLabel, seasonLabel),
        eq(users.profileVisibility, "public"),
        eq(users.leaderboardOptIn, true),
      ),
    );
}
