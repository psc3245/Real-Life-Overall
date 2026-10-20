import type { OnboardingStage } from "@rlo/shared";
import { eq } from "drizzle-orm";
import type { Executor } from "../db/client";
import { onboardingSessions } from "../db/schema";

export type OnboardingSessionRow = typeof onboardingSessions.$inferSelect;

export async function findOrCreate(
  db: Executor,
  userId: string,
  seasonId: string,
): Promise<OnboardingSessionRow> {
  const bySeason = eq(onboardingSessions.seasonId, seasonId);
  const [existing] = await db.select().from(onboardingSessions).where(bySeason);
  if (existing) return existing;
  await db
    .insert(onboardingSessions)
    .values({ userId, seasonId })
    .onConflictDoNothing({ target: onboardingSessions.seasonId });
  const rows = await db.select().from(onboardingSessions).where(bySeason);
  return rows[0]!;
}

export async function update(
  db: Executor,
  id: string,
  changes: Partial<
    Pick<OnboardingSessionRow, "priorities" | "weightRationale" | "questionnaire"> & {
      stage: OnboardingStage;
    }
  >,
): Promise<void> {
  await db.update(onboardingSessions).set(changes).where(eq(onboardingSessions.id, id));
}
