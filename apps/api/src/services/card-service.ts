import type { PublicCategoryDto, RatingsDto } from "@rlo/shared";
import type { Database } from "../db/client";
import * as cardRepo from "../repos/card-repo";
import * as recapRepo from "../repos/recap-repo";

/**
 * Writes the shareable slice of freshly computed ratings to `player_cards`. Only the top of the
 * tree goes in: Overall, archetype and category values. Players without a rating get no card.
 */
export async function syncCard(db: Database, userId: string, ratings: RatingsDto): Promise<void> {
  const root = ratings.nodes.find((n) => n.parentId === null);
  if (root?.value == null) return;
  const categories: PublicCategoryDto[] = ratings.nodes
    .filter((n) => n.parentId === root.id && n.value != null)
    .map((n) => ({ name: n.name, templateKey: n.templateKey, value: n.value! }));
  await cardRepo.upsert(db, {
    userId,
    seasonId: ratings.season.id,
    seasonLabel: ratings.season.label,
    overall: root.value,
    archetype: ratings.archetype?.name ?? null,
    categories,
    recappedDays: await recapRepo.countRecappedDaysSince(db, userId, ratings.season.startsOn),
  });
}
