import {
  MAX_FRIENDS,
  MAX_PENDING_FRIEND_REQUESTS,
  type FriendDto,
  type FriendsDto,
  type FriendshipState,
} from "@rlo/shared";
import { HTTPException } from "hono/http-exception";
import type { Database } from "../db/client";
import { badRequest, notFound } from "../errors";
import * as friendshipRepo from "../repos/friendship-repo";
import type { FriendshipRow } from "../repos/friendship-repo";
import * as userRepo from "../repos/user-repo";

export function stateOf(row: FriendshipRow | null, viewerId: string): FriendshipState {
  if (!row) return "none";
  if (row.status === "accepted") return "friends";
  return row.requesterId === viewerId ? "outgoing" : "incoming";
}

export async function friendshipState(db: Database, viewerId: string, otherId: string) {
  return stateOf(await friendshipRepo.findPair(db, viewerId, otherId), viewerId);
}

async function otherPlayer(db: Database, userId: string, username: string) {
  const other = await userRepo.findByUsername(db, username.toLowerCase());
  if (!other) throw notFound("Player not found");
  if (other.id === userId) throw badRequest("That's you");
  return other;
}

/**
 * Sends a friend request, or accepts theirs if they already asked. Repeating a request is a
 * no-op. Usernames are discoverable this way by exact match; cards are not (see canView).
 */
export async function befriend(
  db: Database,
  userId: string,
  username: string,
): Promise<FriendshipState> {
  const other = await otherPlayer(db, userId, username);
  const existing = await friendshipRepo.findPair(db, userId, other.id);
  if (existing?.status === "pending" && existing.addresseeId === userId) {
    if ((await friendshipRepo.countFriends(db, userId)) >= MAX_FRIENDS) {
      throw badRequest(`You can have up to ${MAX_FRIENDS} friends`);
    }
    await friendshipRepo.accept(db, existing.id);
    return "friends";
  }
  if (existing) return stateOf(existing, userId);

  if ((await friendshipRepo.countPendingSent(db, userId)) >= MAX_PENDING_FRIEND_REQUESTS) {
    throw new HTTPException(429, {
      message: `You have ${MAX_PENDING_FRIEND_REQUESTS} requests waiting. Wait for answers first.`,
    });
  }
  if ((await friendshipRepo.countFriends(db, userId)) >= MAX_FRIENDS) {
    throw badRequest(`You can have up to ${MAX_FRIENDS} friends`);
  }
  await friendshipRepo.insertRequest(db, userId, other.id);
  // A concurrent request from them may have won the unique pair; report what's there.
  return friendshipState(db, userId, other.id);
}

/** Cancels a sent request, declines a received one, or ends a friendship. */
export async function unfriend(db: Database, userId: string, username: string) {
  const other = await otherPlayer(db, userId, username);
  await friendshipRepo.deletePair(db, userId, other.id);
}

export async function listFriends(db: Database, userId: string): Promise<FriendsDto> {
  const rows = await friendshipRepo.findAllFor(db, userId);
  const toDto = (r: (typeof rows)[number]): FriendDto => ({
    username: r.username,
    displayName: r.displayName,
    // Friends see each other's card unless it's private.
    card:
      r.status === "accepted" && r.visibility !== "private" && r.overall != null
        ? { overall: r.overall, archetype: r.archetype }
        : null,
    since: (r.respondedAt ?? r.createdAt).toISOString(),
  });
  const byName = (a: FriendDto, b: FriendDto) => a.displayName.localeCompare(b.displayName);
  return {
    friends: rows
      .filter((r) => r.status === "accepted")
      .map(toDto)
      .sort(byName),
    incoming: rows.filter((r) => r.status === "pending" && !r.sentByMe).map(toDto),
    outgoing: rows.filter((r) => r.status === "pending" && r.sentByMe).map(toDto),
  };
}
