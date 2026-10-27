import {
  parsePreferences,
  parseScoutingReport,
  type Preferences,
  type PreferencesPatch,
  type ScoutingReport,
} from "@rlo/shared";
import { eq, sql } from "drizzle-orm";
import type { Database, Executor } from "../db/client";
import { users } from "../db/schema";

/** Columns safe to send to clients. Never select whole user rows into responses. */
export const publicUserColumns = {
  id: users.id,
  username: users.username,
  displayName: users.displayName,
  timezone: users.timezone,
  weekStart: users.weekStart,
  profileVisibility: users.profileVisibility,
  leaderboardOptIn: users.leaderboardOptIn,
  unitSystem: users.unitSystem,
  trackWeight: users.trackWeight,
  trackHeight: users.trackHeight,
  role: users.role,
  preferences: users.preferences,
  createdAt: users.createdAt,
};

type UserRow = {
  [K in keyof typeof publicUserColumns]: (typeof publicUserColumns)[K]["_"]["data"];
};
export type PublicUser = Omit<UserRow, "preferences"> & { preferences: Preferences };

const toPublic = (row: UserRow): PublicUser => ({
  ...row,
  preferences: parsePreferences(row.preferences),
});

export async function findById(db: Database, id: string): Promise<PublicUser | null> {
  const rows = await db.select(publicUserColumns).from(users).where(eq(users.id, id));
  return rows[0] ? toPublic(rows[0]) : null;
}

export async function findByUsername(db: Database, username: string): Promise<PublicUser | null> {
  const rows = await db.select(publicUserColumns).from(users).where(eq(users.username, username));
  return rows[0] ? toPublic(rows[0]) : null;
}

export async function findOrCreateDevUser(db: Database, username: string): Promise<PublicUser> {
  const [existing] = await db
    .select(publicUserColumns)
    .from(users)
    .where(eq(users.username, username));
  if (existing) return toPublic(existing);
  await db
    .insert(users)
    .values({ username, email: `${username}@dev.local`, displayName: username })
    .onConflictDoNothing({ target: users.username });
  const rows = await db.select(publicUserColumns).from(users).where(eq(users.username, username));
  return toPublic(rows[0]!);
}

export async function update(
  db: Database,
  id: string,
  changes: Partial<
    Pick<
      PublicUser,
      | "displayName"
      | "timezone"
      | "weekStart"
      | "username"
      | "profileVisibility"
      | "leaderboardOptIn"
      | "unitSystem"
      | "trackWeight"
      | "trackHeight"
      | "role"
    >
  > & { preferences?: PreferencesPatch },
): Promise<PublicUser | null> {
  const { preferences, ...rest } = changes;
  const rows = await db
    .update(users)
    .set({
      ...rest,
      // Each top-level key in the patch replaces the stored one, except `features`, which merges
      // per feature in the same statement so concurrent toggles from two devices both land.
      ...(preferences && { preferences: mergePreferencesSql(preferences) }),
    })
    .where(eq(users.id, id))
    .returning(publicUserColumns);
  return rows[0] ? toPublic(rows[0]) : null;
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

export async function findScoutingReport(db: Executor, id: string): Promise<ScoutingReport> {
  const rows = await db
    .select({ scoutingReport: users.scoutingReport })
    .from(users)
    .where(eq(users.id, id));
  return parseScoutingReport(rows[0]?.scoutingReport);
}

export async function setScoutingReport(db: Executor, id: string, report: ScoutingReport) {
  await db.update(users).set({ scoutingReport: report }).where(eq(users.id, id));
}

export async function findByAuthSubject(db: Database, subject: string): Promise<PublicUser | null> {
  const rows = await db.select(publicUserColumns).from(users).where(eq(users.authSubject, subject));
  return rows[0] ? toPublic(rows[0]) : null;
}

/** Creates the app user for a signed-in identity, deriving a unique username from the email. */
export async function createForAuth(
  db: Database,
  identity: { id: string; email: string; name: string },
): Promise<PublicUser> {
  const base =
    identity.email
      .split("@")[0]!
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, "")
      .slice(0, 24) || "player";
  for (let attempt = 0; attempt < 5; attempt++) {
    const username = attempt === 0 ? base : `${base}-${crypto.randomUUID().slice(0, 4)}`;
    const rows = await db
      .insert(users)
      .values({
        username,
        email: identity.email,
        displayName: identity.name.trim() || base,
        authSubject: identity.id,
      })
      .onConflictDoNothing()
      .returning(publicUserColumns);
    if (rows[0]) return toPublic(rows[0]);
    const existing = await findByAuthSubject(db, identity.id); // a concurrent request won
    if (existing) return existing;
  }
  throw new Error("Could not allocate a username");
}

function mergePreferencesSql(patch: PreferencesPatch) {
  const { features, ...rest } = patch;
  const merged = sql`coalesce(${users.preferences}, '{}'::jsonb) || ${JSON.stringify(rest)}::jsonb`;
  if (!features) return merged;
  return sql`${merged} || jsonb_build_object('features', coalesce(${users.preferences} -> 'features', '{}'::jsonb) || ${JSON.stringify(features)}::jsonb)`;
}
