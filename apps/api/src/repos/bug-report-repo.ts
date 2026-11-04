import type { BugReportBody, BugReportDto, BugReportStatus } from "@rlo/shared";
import { and, count, desc, eq, gte, type SQL } from "drizzle-orm";
import type { Executor } from "../db/client";
import { bugReports, users } from "../db/schema";

export async function insert(
  db: Executor,
  userId: string,
  body: Omit<Required<BugReportBody>, "appVersion" | "device"> & {
    appVersion: string | null;
    device: string | null;
  },
): Promise<{ id: string }> {
  const [row] = await db
    .insert(bugReports)
    .values({ userId, ...body })
    .returning({ id: bugReports.id });
  return row!;
}

export async function countSince(db: Executor, userId: string, since: Date): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(bugReports)
    .where(and(eq(bugReports.userId, userId), gte(bugReports.createdAt, since)));
  return row?.n ?? 0;
}

/** Newest first, with the reporter's username (admins only). */
export async function list(
  db: Executor,
  status: BugReportStatus | undefined,
  limit: number,
): Promise<BugReportDto[]> {
  const where: SQL | undefined = status ? eq(bugReports.status, status) : undefined;
  const rows = await db
    .select({
      id: bugReports.id,
      userId: bugReports.userId,
      username: users.username,
      message: bugReports.message,
      page: bugReports.page,
      platform: bugReports.platform,
      appVersion: bugReports.appVersion,
      device: bugReports.device,
      status: bugReports.status,
      createdAt: bugReports.createdAt,
      resolvedAt: bugReports.resolvedAt,
    })
    .from(bugReports)
    .innerJoin(users, eq(users.id, bugReports.userId))
    .where(where)
    .orderBy(desc(bugReports.createdAt))
    .limit(limit);
  return rows.map((r) => ({
    ...r,
    createdAt: r.createdAt.toISOString(),
    resolvedAt: r.resolvedAt?.toISOString() ?? null,
  }));
}

export async function setStatus(db: Executor, id: string, status: BugReportStatus) {
  const rows = await db
    .update(bugReports)
    .set({ status, resolvedAt: status === "resolved" ? new Date() : null })
    .where(eq(bugReports.id, id))
    .returning({ id: bugReports.id });
  return rows[0] ?? null;
}
