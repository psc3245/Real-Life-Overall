import { BADGE_CATALOG, BADGE_TIERS, type ProfileDto, type PublicBadgeDto } from "@rlo/shared";
import type { Database } from "../db/client";
import { notFound } from "../errors";
import * as badgeRepo from "../repos/badge-repo";
import * as cardRepo from "../repos/card-repo";
import * as userRepo from "../repos/user-repo";
import type { PublicUser } from "../repos/user-repo";
import { getRatings } from "./ratings-service";

/** Whether `viewerId` (null when signed out) may see `owner`'s card. */
export async function canView(
  db: Database,
  viewerId: string | null,
  owner: PublicUser,
): Promise<boolean> {
  if (viewerId === owner.id) return true;
  return owner.profileVisibility === "public";
}

/** Highest catalog tier per badge. Personal badges are LLM-written from journals: never shared. */
async function publicBadges(db: Database, userId: string): Promise<PublicBadgeDto[]> {
  const best = new Map<string, PublicBadgeDto>();
  for (const row of await badgeRepo.findByUser(db, userId)) {
    if (row.kind !== "catalog" || !row.tier) continue;
    const seen = best.get(row.badgeKey);
    if (!seen || BADGE_TIERS.indexOf(row.tier) > BADGE_TIERS.indexOf(seen.tier)) {
      best.set(row.badgeKey, {
        key: row.badgeKey,
        name: BADGE_CATALOG.find((b) => b.key === row.badgeKey)?.name ?? row.name,
        tier: row.tier,
      });
    }
  }
  return [...best.values()].sort(
    (a, b) =>
      BADGE_TIERS.indexOf(b.tier) - BADGE_TIERS.indexOf(a.tier) || a.key.localeCompare(b.key),
  );
}

/**
 * A player's shareable profile. Hidden profiles answer 404, the same as missing ones, so
 * visibility settings don't reveal who has an account.
 */
export async function getProfile(
  db: Database,
  viewerId: string | null,
  username: string,
): Promise<ProfileDto> {
  const owner = await userRepo.findByUsername(db, username.toLowerCase());
  if (!owner || !(await canView(db, viewerId, owner))) throw notFound("Profile not found");
  const isSelf = viewerId === owner.id;
  // The cached card; the owner's own rating views and the hourly job keep it current.
  let card = await cardRepo.findByUser(db, owner.id);
  if (!card) {
    await getRatings(db, owner.id).catch(() => null); // no rating yet: stays without a card
    card = await cardRepo.findByUser(db, owner.id);
  }
  const badges = await publicBadges(db, owner.id);
  return {
    username: owner.username,
    displayName: owner.displayName,
    memberSince: owner.createdAt.toISOString(),
    isSelf,
    visibility: isSelf ? owner.profileVisibility : null,
    card: card ? cardRepo.toCardDto(card) : null,
    badges,
  };
}
