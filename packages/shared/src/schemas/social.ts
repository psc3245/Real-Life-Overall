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

export interface ProfileDto {
  username: string;
  displayName: string;
  memberSince: string;
  isSelf: boolean;
  /** Only sent to the profile's owner. */
  visibility: ProfileVisibility | null;
  /** Null until the player has finished onboarding. */
  card: PublicCardDto | null;
  badges: PublicBadgeDto[];
}
