import { and, desc, eq, lt } from "drizzle-orm";
import type { BodyKind } from "@rlo/shared";
import type { Executor } from "../db/client";
import { bodyMeasurements } from "../db/schema";

export type BodyRow = typeof bodyMeasurements.$inferSelect;

/** Newest first. */
export async function findAll(db: Executor, userId: string): Promise<BodyRow[]> {
  return db
    .select()
    .from(bodyMeasurements)
    .where(eq(bodyMeasurements.userId, userId))
    .orderBy(desc(bodyMeasurements.localDate));
}

export async function findOn(db: Executor, userId: string, localDate: string) {
  return db
    .select()
    .from(bodyMeasurements)
    .where(and(eq(bodyMeasurements.userId, userId), eq(bodyMeasurements.localDate, localDate)));
}

/** The latest value of `kind` before `localDate`. */
export async function findLatestBefore(
  db: Executor,
  userId: string,
  kind: BodyKind,
  localDate: string,
): Promise<BodyRow | null> {
  const rows = await db
    .select()
    .from(bodyMeasurements)
    .where(
      and(
        eq(bodyMeasurements.userId, userId),
        eq(bodyMeasurements.kind, kind),
        lt(bodyMeasurements.localDate, localDate),
      ),
    )
    .orderBy(desc(bodyMeasurements.localDate))
    .limit(1);
  return rows[0] ?? null;
}

export async function upsert(
  db: Executor,
  userId: string,
  localDate: string,
  kind: BodyKind,
  value: number,
) {
  await db
    .insert(bodyMeasurements)
    .values({ userId, localDate, kind, value })
    .onConflictDoUpdate({
      target: [bodyMeasurements.userId, bodyMeasurements.localDate, bodyMeasurements.kind],
      set: { value },
    });
}

export async function remove(db: Executor, userId: string, localDate: string, kind: BodyKind) {
  await db
    .delete(bodyMeasurements)
    .where(
      and(
        eq(bodyMeasurements.userId, userId),
        eq(bodyMeasurements.localDate, localDate),
        eq(bodyMeasurements.kind, kind),
      ),
    );
}
