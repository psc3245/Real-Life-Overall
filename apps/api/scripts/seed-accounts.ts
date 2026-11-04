/**
 * Test accounts for every account type (DESIGN.md §8.9), on the dev database:
 *   npm run seed:accounts -w @rlo/api
 *
 * - Four fresh accounts that can sign in, one per type, each new (onboarding not started), so
 *   Free walks the Combine and Premium can pick the scout. Re-running resets them.
 * - The seeded demo player (`npm run seed:demo`) becomes Premium, to test a full season.
 * - The rivals get a mix of types so /admin shows each one.
 * Uses DATABASE_URL from apps/api/.env.
 */
import { ROLE_LABELS, type UserRole } from "@rlo/shared";
import { eq, like } from "drizzle-orm";
import { passwordHasher } from "../src/auth/password";
import { createNeonDb } from "../src/db/client";
import { authAccounts, authUsers, users } from "../src/db/schema";

/** Shared by every test account below. Dev database only. */
export const TEST_PASSWORD = "test-player-2026";
const DOMAIN = "accounts.test";
const TIMEZONE = "America/Chicago";

/** `weeks`: how long ago they went Premium, so the "N weeks Premium" markers have something to show. */
const ACCOUNTS: { username: string; name: string; role: UserRole; weeks?: number }[] = [
  { username: "free", name: "Frankie Free", role: "user" },
  { username: "premium", name: "Pat Premium", role: "premium", weeks: 3 },
  { username: "playtester", name: "Dana Dev", role: "dev", weeks: 6 },
  { username: "boss", name: "Alex Admin", role: "admin", weeks: 12 },
];
const weeksAgo = (weeks: number) => new Date(Date.now() - weeks * 7 * 86_400_000);

const RIVAL_ROLES: Record<string, UserRole> = {
  maya: "premium",
  devon: "dev",
  priya: "premium",
  marcus: "admin",
};

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set (apps/api/.env)");
  const { db, dispose } = createNeonDb(url);
  try {
    const hash = await passwordHasher(100_000).hash(TEST_PASSWORD);
    for (const a of ACCOUNTS) {
      const email = `${a.username}@${DOMAIN}`;
      // Replace any previous copy (cascades remove its data).
      await db.delete(authUsers).where(eq(authUsers.email, email));
      await db.delete(users).where(eq(users.email, email));
      await db.delete(users).where(eq(users.username, a.username));

      const authId = crypto.randomUUID();
      await db.insert(authUsers).values({ id: authId, name: a.name, email, emailVerified: true });
      await db.insert(authAccounts).values({
        id: crypto.randomUUID(),
        userId: authId,
        accountId: authId,
        providerId: "credential",
        password: hash,
      });
      await db.insert(users).values({
        email,
        username: a.username,
        displayName: a.name,
        timezone: TIMEZONE,
        authSubject: authId,
        role: a.role,
        premiumSince: a.weeks === undefined ? null : weeksAgo(a.weeks),
      });
      console.log(`${ROLE_LABELS[a.role].padEnd(8)} ${email}`);
    }

    const demo = await db
      .update(users)
      .set({ role: "premium", premiumSince: weeksAgo(8) })
      .where(eq(users.username, "demo"))
      .returning({ email: users.email });
    console.log(
      demo[0]
        ? `Premium  ${demo[0].email} (the seeded demo season)`
        : "No demo player; run seed:demo",
    );

    const rivals = await db
      .select({ id: users.id, username: users.username })
      .from(users)
      .where(like(users.email, "%@demo-rival.test"));
    for (const r of rivals) {
      await db
        .update(users)
        .set({
          role: RIVAL_ROLES[r.username] ?? "user",
          premiumSince: RIVAL_ROLES[r.username] ? weeksAgo(4) : null,
        })
        .where(eq(users.id, r.id));
    }
    console.log(`Gave ${rivals.length} rivals a mix of account types (they can't sign in)`);
  } finally {
    await dispose();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
