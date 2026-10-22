import { eq } from "drizzle-orm";
import type { Database, Executor } from "../db/client";
import { users } from "../db/schema";

/** Columns safe to send to clients. Never select whole user rows into responses. */
export const publicUserColumns = {
  id: users.id,
  username: users.username,
  displayName: users.displayName,
  timezone: users.timezone,
  weekStart: users.weekStart,
  createdAt: users.createdAt,
};

export type PublicUser = {
  [K in keyof typeof publicUserColumns]: (typeof publicUserColumns)[K]["_"]["data"];
};

export async function findById(db: Database, id: string): Promise<PublicUser | null> {
  const rows = await db.select(publicUserColumns).from(users).where(eq(users.id, id));
  return rows[0] ?? null;
}

export async function findOrCreateDevUser(db: Database, username: string): Promise<PublicUser> {
  const [existing] = await db
    .select(publicUserColumns)
    .from(users)
    .where(eq(users.username, username));
  if (existing) return existing;
  await db
    .insert(users)
    .values({ username, email: `${username}@dev.local`, displayName: username })
    .onConflictDoNothing({ target: users.username });
  const rows = await db.select(publicUserColumns).from(users).where(eq(users.username, username));
  return rows[0]!;
}

export async function update(
  db: Database,
  id: string,
  changes: Partial<Pick<PublicUser, "displayName" | "timezone" | "weekStart">>,
): Promise<PublicUser | null> {
  const rows = await db
    .update(users)
    .set(changes)
    .where(eq(users.id, id))
    .returning(publicUserColumns);
  return rows[0] ?? null;
}

export async function findProfileSummary(db: Database, id: string): Promise<string | null> {
  const rows = await db
    .select({ profileSummary: users.profileSummary })
    .from(users)
    .where(eq(users.id, id));
  return rows[0]?.profileSummary ?? null;
}

export async function setProfileSummary(db: Executor, id: string, profileSummary: string) {
  await db.update(users).set({ profileSummary }).where(eq(users.id, id));
}
