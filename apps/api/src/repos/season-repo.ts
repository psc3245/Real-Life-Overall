import type { SeasonDto } from "@rlo/shared";
import { and, desc, eq } from "drizzle-orm";
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
