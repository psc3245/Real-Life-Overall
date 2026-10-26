import { z } from "zod";
import { CATEGORY_TEMPLATES } from "../templates";
import type { UnitSystem } from "../units";
import type { UserRole } from "./admin";
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

/** The signed-in player's own account (GET/PATCH /me). */
export interface MeDto {
  id: string;
  username: string;
  displayName: string;
  timezone: string;
  /** 0 = Sunday … 6 = Saturday */
  weekStart: number;
  profileVisibility: ProfileVisibility;
  leaderboardOptIn: boolean;
  unitSystem: UnitSystem;
  trackWeight: boolean;
  trackHeight: boolean;
  role: UserRole;
  createdAt: string;
}

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

// Leaderboards (DESIGN.md §7.3)

/** Global boards only count ratings backed by this many recapped days this season. */
export const LEADERBOARD_MIN_RECAPPED_DAYS = 7;
/**
 * Players whose recaps are flagged this often sit out of global boards. Flags also cover
 * ambiguity, so the bar is lenient: at least 5 flagged days and over half of all recapped days.
 */
export const LEADERBOARD_FLAGGED_MIN_DAYS = 5;
export const LEADERBOARD_FLAGGED_MAX_SHARE = 0.5;
export const LEADERBOARD_SIZE = 50;

export const LEADERBOARD_SCOPES = ["friends", "global"] as const;
export type LeaderboardScope = (typeof LEADERBOARD_SCOPES)[number];

/** Boards: Overall, plus one per template category (custom categories don't compare). */
export const LEADERBOARD_BOARDS = [
  { key: "overall", name: "Overall" },
  ...CATEGORY_TEMPLATES.map((t) => ({ key: t.key, name: t.name })),
];
export const leaderboardQuerySchema = z.object({
  scope: z.enum(LEADERBOARD_SCOPES).default("friends"),
  board: z
    .string()
    .default("overall")
    .refine((b) => LEADERBOARD_BOARDS.some((x) => x.key === b), "Unknown board"),
});

export type IneligibleReason = "few-recaps" | "flagged";

/** Whether a card's evidence is strong enough for global boards. */
export function leaderboardIneligibility(card: {
  recappedDays: number;
  flaggedDays: number;
}): IneligibleReason[] {
  const reasons: IneligibleReason[] = [];
  if (card.recappedDays < LEADERBOARD_MIN_RECAPPED_DAYS) reasons.push("few-recaps");
  if (
    card.flaggedDays >= LEADERBOARD_FLAGGED_MIN_DAYS &&
    card.flaggedDays > card.recappedDays * LEADERBOARD_FLAGGED_MAX_SHARE
  ) {
    reasons.push("flagged");
  }
  return reasons;
}

export interface LeaderboardEntryDto {
  rank: number;
  username: string;
  displayName: string;
  archetype: string | null;
  value: number;
  recappedDays: number;
  /** Too few recapped days to count on global boards yet. */
  provisional: boolean;
  isMe: boolean;
}

export interface LeaderboardDto {
  scope: LeaderboardScope;
  board: string;
  seasonLabel: string;
  entries: LeaderboardEntryDto[];
  /** Your row, even when it's outside the top of the board (null if you're not on it). */
  me: LeaderboardEntryDto | null;
  /** Why you're not on the global board, if you aren't. */
  globalStatus: {
    optedIn: boolean;
    visibility: ProfileVisibility;
    hasCard: boolean;
    reasons: IneligibleReason[];
    recappedDays: number;
  };
}
