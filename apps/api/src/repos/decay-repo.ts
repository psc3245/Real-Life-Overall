import { and, desc, eq, gte, inArray, isNull, min } from "drizzle-orm";
import type { Executor } from "../db/client";
import { decayRuns, ratingEvents } from "../db/schema";

export async function latestRunDate(db: Executor, userId: string): Promise<string | null> {
  const rows = await db
    .select({ localDate: decayRuns.localDate })
    .from(decayRuns)
    .where(and(eq(decayRuns.userId, userId), isNull(decayRuns.voidedAt)))
    .orderBy(desc(decayRuns.localDate))
    .limit(1);
  return rows[0]?.localDate ?? null;
}

export async function insertRun(db: Executor, row: typeof decayRuns.$inferInsert) {
  const rows = await db.insert(decayRuns).values(row).returning({ id: decayRuns.id });
  return rows[0]!.id;
}

/** Voids decay runs on or after `from`, and their events, so they can be recomputed. */
export async function voidFrom(db: Executor, userId: string, from: string): Promise<void> {
  const runs = await db
    .update(decayRuns)
    .set({ voidedAt: new Date() })
    .where(
      and(eq(decayRuns.userId, userId), gte(decayRuns.localDate, from), isNull(decayRuns.voidedAt)),
    )
    .returning({ id: decayRuns.id });
  if (!runs.length) return;
  await db
    .update(ratingEvents)
    .set({ voidedAt: new Date() })
    .where(
      and(
        inArray(
          ratingEvents.decayRunId,
          runs.map((r) => r.id),
        ),
        isNull(ratingEvents.voidedAt),
      ),
    );
}

/** When onboarding ratings were written: decay can't start before then. */
export async function onboardedAt(db: Executor, seasonId: string): Promise<Date | null> {
  const rows = await db
    .select({ at: min(ratingEvents.createdAt) })
    .from(ratingEvents)
    .where(and(eq(ratingEvents.seasonId, seasonId), eq(ratingEvents.source, "onboarding")));
  return rows[0]?.at ?? null;
}
