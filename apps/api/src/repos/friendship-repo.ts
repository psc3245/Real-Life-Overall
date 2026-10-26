import { and, count, eq, or } from "drizzle-orm";
import type { Executor } from "../db/client";
import { friendships, playerCards, users } from "../db/schema";

export type FriendshipRow = typeof friendships.$inferSelect;

const pair = (a: string, b: string) =>
  or(
    and(eq(friendships.requesterId, a), eq(friendships.addresseeId, b)),
    and(eq(friendships.requesterId, b), eq(friendships.addresseeId, a)),
  );

export async function findPair(db: Executor, a: string, b: string): Promise<FriendshipRow | null> {
  const rows = await db.select().from(friendships).where(pair(a, b));
  return rows[0] ?? null;
}

export async function insertRequest(db: Executor, requesterId: string, addresseeId: string) {
  await db.insert(friendships).values({ requesterId, addresseeId }).onConflictDoNothing();
}

export async function accept(db: Executor, id: string) {
  await db
    .update(friendships)
    .set({ status: "accepted", respondedAt: new Date() })
    .where(eq(friendships.id, id));
}

export async function deletePair(db: Executor, a: string, b: string) {
  await db.delete(friendships).where(pair(a, b));
}

export async function countPendingSent(db: Executor, userId: string) {
  const [row] = await db
    .select({ n: count() })
    .from(friendships)
    .where(and(eq(friendships.requesterId, userId), eq(friendships.status, "pending")));
  return row?.n ?? 0;
}

export async function countFriends(db: Executor, userId: string) {
  const [row] = await db
    .select({ n: count() })
    .from(friendships)
    .where(
      and(
        eq(friendships.status, "accepted"),
        or(eq(friendships.requesterId, userId), eq(friendships.addresseeId, userId)),
      ),
    );
  return row?.n ?? 0;
}

/** Ids of accepted friends. */
export async function findFriendIds(db: Executor, userId: string): Promise<string[]> {
  const rows = await db
    .select({ requesterId: friendships.requesterId, addresseeId: friendships.addresseeId })
    .from(friendships)
    .where(
      and(
        eq(friendships.status, "accepted"),
        or(eq(friendships.requesterId, userId), eq(friendships.addresseeId, userId)),
      ),
    );
  return rows.map((r) => (r.requesterId === userId ? r.addresseeId : r.requesterId));
}

/** Every request and friendship involving the user, with the other player and their card. */
export async function findAllFor(db: Executor, userId: string) {
  // `side` is the other player's role in the row.
  const other = (side: "requester" | "addressee") =>
    db
      .select({
        id: friendships.id,
        status: friendships.status,
        createdAt: friendships.createdAt,
        respondedAt: friendships.respondedAt,
        userId: users.id,
        username: users.username,
        displayName: users.displayName,
        visibility: users.profileVisibility,
        mode: playerCards.mode,
        overall: playerCards.overall,
        growth: playerCards.growth,
        archetype: playerCards.archetype,
      })
      .from(friendships)
      .innerJoin(
        users,
        eq(users.id, side === "addressee" ? friendships.addresseeId : friendships.requesterId),
      )
      .leftJoin(playerCards, eq(playerCards.userId, users.id))
      .where(eq(side === "addressee" ? friendships.requesterId : friendships.addresseeId, userId));
  const [sent, received] = await Promise.all([other("addressee"), other("requester")]);
  return [
    ...sent.map((r) => ({ ...r, sentByMe: true })),
    ...received.map((r) => ({ ...r, sentByMe: false })),
  ];
}
