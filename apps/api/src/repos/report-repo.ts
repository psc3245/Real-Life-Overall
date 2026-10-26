import { and, count, desc, eq, gte, inArray } from "drizzle-orm";
import type { Executor } from "../db/client";
import { reportRuns, reports } from "../db/schema";

export type ReportRow = typeof reports.$inferSelect;
export type ReportRunRow = typeof reportRuns.$inferSelect;

export async function findByUser(db: Executor, userId: string): Promise<ReportRow[]> {
  return db
    .select()
    .from(reports)
    .where(eq(reports.userId, userId))
    .orderBy(desc(reports.updatedAt));
}

export async function findById(db: Executor, userId: string, id: string) {
  const rows = await db
    .select()
    .from(reports)
    .where(and(eq(reports.id, id), eq(reports.userId, userId)));
  return rows[0] ?? null;
}

export async function insert(db: Executor, row: typeof reports.$inferInsert) {
  return (await db.insert(reports).values(row).returning())[0]!;
}

export async function update(
  db: Executor,
  id: string,
  changes: Partial<Pick<ReportRow, "name" | "description" | "charts" | "options" | "defaultRange">>,
) {
  return (await db.update(reports).set(changes).where(eq(reports.id, id)).returning())[0]!;
}

export async function remove(db: Executor, id: string) {
  await db.delete(reports).where(eq(reports.id, id));
}

export async function insertRun(db: Executor, row: typeof reportRuns.$inferInsert) {
  return (await db.insert(reportRuns).values(row).returning())[0]!;
}

/** Runs of a report, newest first, without their (large) results. */
export async function findRuns(db: Executor, userId: string, reportId: string, limit = 50) {
  return db
    .select({
      id: reportRuns.id,
      from: reportRuns.from,
      to: reportRuns.to,
      createdAt: reportRuns.createdAt,
    })
    .from(reportRuns)
    .where(and(eq(reportRuns.reportId, reportId), eq(reportRuns.userId, userId)))
    .orderBy(desc(reportRuns.createdAt))
    .limit(limit);
}

/** The newest run of each report. */
export async function findLatestRuns(db: Executor, reportIds: string[]) {
  if (!reportIds.length) return [];
  const rows = await db
    .select({
      reportId: reportRuns.reportId,
      id: reportRuns.id,
      from: reportRuns.from,
      to: reportRuns.to,
      createdAt: reportRuns.createdAt,
    })
    .from(reportRuns)
    .where(inArray(reportRuns.reportId, reportIds))
    .orderBy(desc(reportRuns.createdAt));
  const latest = new Map<string, (typeof rows)[number]>();
  for (const r of rows) if (!latest.has(r.reportId)) latest.set(r.reportId, r);
  return [...latest.values()];
}

export async function findRun(db: Executor, userId: string, id: string) {
  const rows = await db
    .select()
    .from(reportRuns)
    .where(and(eq(reportRuns.id, id), eq(reportRuns.userId, userId)));
  return rows[0] ?? null;
}

export async function removeRun(db: Executor, id: string) {
  await db.delete(reportRuns).where(eq(reportRuns.id, id));
}

export async function countAiRunsSince(db: Executor, userId: string, since: Date) {
  const [row] = await db
    .select({ n: count() })
    .from(reportRuns)
    .where(
      and(
        eq(reportRuns.userId, userId),
        eq(reportRuns.usedAi, true),
        gte(reportRuns.createdAt, since),
      ),
    );
  return row?.n ?? 0;
}
