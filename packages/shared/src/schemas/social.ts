import { z } from "zod";
import type { BadgeTier } from "./badges";

/**
 * Who can see a player's card (DESIGN.md §7.3). Private is the default. Journals, recaps,
 * rationales, attribute names and personal badges are never shown to anyone else.
 */
export const PROFILE_VISIBILITIES = ["private", "friends", "public"] as const;
export type ProfileVisibility = (typeof PROFILE_VISIBILITIES)[number];

/** Lowercase, 3-24 characters, starting with a letter or digit. Usernames appear in links. */
export const USERNAME_PATTERN = /^[a-z0-9][a-z0-9_-]{2,23}$/;

/** Words that would collide with app routes or read as official. */
export const RESERVED_USERNAMES = new Set([
  "admin",
  "api",
  "app",
  "help",
  "me",
  "moderator",
  "official",
  "ovr",
  "root",
  "settings",
  "staff",
  "support",
  "system",
]);

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(USERNAME_PATTERN, "Use 3-24 lowercase letters, digits, - or _")
  .refine((u) => !RESERVED_USERNAMES.has(u), "That username is reserved");

/** A category on a shared card: the top level of the tree only. */
export interface PublicCategoryDto {
  name: string;
  /** Set when the category came from a template; only these compare across players. */
  templateKey: string | null;
  value: number;
}

/** The shareable slice of a player's ratings, cached per user (refreshed on change). */
export interface PublicCardDto {
  overall: number;
  archetype: string | null;
  seasonLabel: string;
  categories: PublicCategoryDto[];
  /** Days this season the model has recapped (the evidence behind the ratings). */
  recappedDays: number;
  updatedAt: string;
}

export interface PublicBadgeDto {
  key: string;
  name: string;
  /** Highest catalog tier reached. */
  tier: BadgeTier;
}

/** The viewer's relationship to another player. */
export const FRIENDSHIP_STATES = ["none", "outgoing", "incoming", "friends"] as const;
export type FriendshipState = (typeof FRIENDSHIP_STATES)[number];

/** Anti-spam limits on the social graph. */
export const MAX_PENDING_FRIEND_REQUESTS = 20;
export const MAX_FRIENDS = 200;

export interface ProfileDto {
  username: string;
  displayName: string;
  memberSince: string;
  isSelf: boolean;
  /** Null for the owner and for signed-out visitors. */
  friendship: FriendshipState | null;
  /** Only sent to the profile's owner. */
  visibility: ProfileVisibility | null;
  /** Null until the player has finished onboarding. */
  card: PublicCardDto | null;
  badges: PublicBadgeDto[];
}

export interface FriendDto {
  username: string;
  displayName: string;
  /** Overall and archetype, when their visibility lets you see their card. */
  card: { overall: number; archetype: string | null } | null;
  /** When the request was sent or accepted. */
  since: string;
}

export interface FriendsDto {
  friends: FriendDto[];
  /** Requests waiting for your answer. */
  incoming: FriendDto[];
  /** Requests you sent. */
  outgoing: FriendDto[];
}

export interface ComparisonRow {
  name: string;
  mine: number | null;
  theirs: number | null;
}

/**
 * Lines up two players' categories for side-by-side compare: template categories match by
 * template key, custom ones by name (case-insensitive). Shared categories come first in the
 * first player's order, then each side's extras.
 */
export function alignCategories(
  mine: PublicCategoryDto[],
  theirs: PublicCategoryDto[],
): ComparisonRow[] {
  const key = (c: PublicCategoryDto) => c.templateKey ?? `name:${c.name.trim().toLowerCase()}`;
  const theirsByKey = new Map(theirs.map((c) => [key(c), c]));
  const matched = new Set<string>();
  const rows: ComparisonRow[] = [];
  const onlyMine: ComparisonRow[] = [];
  for (const c of mine) {
    const other = theirsByKey.get(key(c));
    if (other) {
      matched.add(key(c));
      rows.push({ name: c.name, mine: c.value, theirs: other.value });
    } else {
      onlyMine.push({ name: c.name, mine: c.value, theirs: null });
    }
  }
  const onlyTheirs = theirs
    .filter((c) => !matched.has(key(c)))
    .map((c) => ({ name: c.name, mine: null, theirs: c.value }));
  return [...rows, ...onlyMine, ...onlyTheirs];
}
