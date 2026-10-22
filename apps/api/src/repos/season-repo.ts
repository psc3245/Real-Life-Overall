import type { SeasonDto } from "@rlo/shared";
import { and, desc, eq } from "drizzle-orm";
import { seasons as seasonsTable, users, type seasonStatus } from "../db/schema";
import type { Executor } from "../db/client";
import { seasons } from "../db/schema";

const seasonColumns = {
  id: seasons.id,
  label: seasons.label,
  startsOn: seasons.startsOn,
  endsOn: seasons.endsOn,
  status: seasons.status,
};

export async function findLatest(db: Executor, userId: string): Promise<SeasonDto | null> {
  const rows = await db
    .select(seasonColumns)
    .from(seasons)
    .where(eq(seasons.userId, userId))
    .orderBy(desc(seasons.startsOn))
    .limit(1);
  return rows[0] ?? null;
}

/** Select-first so the common path is one query; the unique index settles concurrent creates. */
export async function findOrCreate(
  db: Executor,
  userId: string,
  period: { label: string; startsOn: string; endsOn: string },
): Promise<SeasonDto> {
  const byLabel = and(eq(seasons.userId, userId), eq(seasons.label, period.label));
  const [existing] = await db.select(seasonColumns).from(seasons).where(byLabel);
  if (existing) return existing;
  await db
    .insert(seasons)
    .values({ userId, ...period })
    .onConflictDoNothing({ target: [seasons.userId, seasons.label] });
  const rows = await db.select(seasonColumns).from(seasons).where(byLabel);
  return rows[0]!;
}

export async function findLatestActive(db: Executor, userId: string): Promise<SeasonDto | null> {
  const rows = await db
    .select(seasonColumns)
    .from(seasons)
    .where(and(eq(seasons.userId, userId), eq(seasons.status, "active")))
    .orderBy(desc(seasons.startsOn))
    .limit(1);
  return rows[0] ?? null;
}

export async function findArchetype(db: Executor, seasonId: string) {
  const rows = await db
    .select({ name: seasons.archetype, description: seasons.archetypeDescription })
    .from(seasons)
    .where(eq(seasons.id, seasonId));
  return rows[0]?.name ? { name: rows[0].name, description: rows[0].description ?? "" } : null;
}

export async function update(
  db: Executor,
  id: string,
  changes: {
    status?: (typeof seasonStatus.enumValues)[number];
    archetype?: string;
    archetypeDescription?: string;
  },
): Promise<void> {
  await db.update(seasons).set(changes).where(eq(seasons.id, id));
}

/** Users with an active season: the ones scheduled jobs care about. */
export async function findActiveUsers(db: Executor) {
  return db
    .selectDistinct({ userId: users.id, timezone: users.timezone })
    .from(seasonsTable)
    .innerJoin(users, eq(users.id, seasonsTable.userId))
    .where(eq(seasonsTable.status, "active"));
}
