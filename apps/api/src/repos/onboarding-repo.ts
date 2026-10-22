import type { OnboardingStage } from "@rlo/shared";
import type { QuestionDto } from "@rlo/shared";
import { and, eq, isNull } from "drizzle-orm";
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
    .values({ userId, seasonId, stage: "discovery" })
    .onConflictDoNothing({ target: onboardingSessions.seasonId });
  const rows = await db.select().from(onboardingSessions).where(bySeason);
  return rows[0]!;
}

export async function update(
  db: Executor,
  id: string,
  changes: Partial<
    Pick<
      OnboardingSessionRow,
      | "priorities"
      | "weightRationale"
      | "questionnaire"
      | "answers"
      | "chat"
      | "discovery"
      | "templateRationale"
    > & {
      stage: OnboardingStage;
    }
  >,
): Promise<void> {
  await db.update(onboardingSessions).set(changes).where(eq(onboardingSessions.id, id));
}

/** Atomic first-writer-wins, so concurrent generations can't overwrite answered questions. */
export async function setQuestionnaireIfAbsent(
  db: Executor,
  id: string,
  questions: QuestionDto[],
): Promise<boolean> {
  const rows = await db
    .update(onboardingSessions)
    .set({ questionnaire: questions, answers: {} })
    .where(and(eq(onboardingSessions.id, id), isNull(onboardingSessions.questionnaire)))
    .returning({ id: onboardingSessions.id });
  return rows.length > 0;
}

/**
 * Moves the session from one stage to another only if it is still in `from`, so concurrent
 * requests can't both complete it. Returns whether this call made the transition.
 */
export async function transitionStage(
  db: Executor,
  id: string,
  from: OnboardingStage,
  to: OnboardingStage,
  changes: Partial<Pick<OnboardingSessionRow, "result">> = {},
): Promise<boolean> {
  const rows = await db
    .update(onboardingSessions)
    .set({ stage: to, ...changes })
    .where(and(eq(onboardingSessions.id, id), eq(onboardingSessions.stage, from)))
    .returning({ id: onboardingSessions.id });
  return rows.length > 0;
}

export async function findBySeason(db: Executor, seasonId: string) {
  const rows = await db
    .select()
    .from(onboardingSessions)
    .where(eq(onboardingSessions.seasonId, seasonId));
  return rows[0] ?? null;
}
