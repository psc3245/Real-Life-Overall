import type { RatingsDto } from "@rlo/shared";
import type { Database } from "../db/client";
import * as cardRepo from "../repos/card-repo";
import * as recapRepo from "../repos/recap-repo";

/**
 * Writes the shareable slice of freshly computed ratings to `player_cards`. Only the top of the
 * tree goes in: Overall, archetype and category values, as both rating and growth so either
 * board can rank the player. Players without a rating get no card.
 */
export async function syncCard(
  db: Database,
  userId: string,
  ratings: RatingsDto,
  growth: ReadonlyMap<string, number>,
): Promise<void> {
  const root = ratings.nodes.find((n) => n.parentId === null);
  if (root?.rating == null) return;
  const categories: cardRepo.CardCategory[] = ratings.nodes
    .filter((n) => n.parentId === root.id && n.rating != null)
    .map((n) => ({
      name: n.name,
      templateKey: n.templateKey,
      value: n.rating!,
      growth: growth.get(n.id) ?? 0,
    }));
  await cardRepo.upsert(db, {
    userId,
    seasonId: ratings.season.id,
    seasonLabel: ratings.season.label,
    mode: ratings.season.mode,
    overall: root.rating,
    growth: growth.get(root.id) ?? 0,
    archetype: ratings.archetype?.name ?? null,
    categories,
    recappedDays: await recapRepo.countRecappedDaysSince(db, userId, ratings.season.startsOn),
    flaggedDays: await recapRepo.countFlaggedDaysSince(db, userId, ratings.season.startsOn),
  });
}
