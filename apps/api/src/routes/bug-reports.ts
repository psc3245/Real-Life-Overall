import { bugReportBodySchema } from "@rlo/shared";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import type { AppEnv } from "../context";
import * as bugReportRepo from "../repos/bug-report-repo";
import { parseJson } from "../validation";

/** Enough for a heavy testing session, not enough to flood the inbox. */
export const MAX_BUG_REPORTS_PER_DAY = 30;

/** Bug reports from dev and admin accounts (DESIGN.md §8.9). Behind requireUser + requireTester. */
export const bugReportRoutes = new Hono<AppEnv>().post("/", async (c) => {
  const body = await parseJson(c, bugReportBodySchema);
  const db = c.get("db");
  const userId = c.get("userId");
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  if ((await bugReportRepo.countSince(db, userId, since)) >= MAX_BUG_REPORTS_PER_DAY) {
    throw new HTTPException(429, { message: "That's a lot of bugs today. Try again tomorrow." });
  }
  const report = await bugReportRepo.insert(db, userId, {
    ...body,
    appVersion: body.appVersion ?? null,
    device: body.device ?? null,
  });
  return c.json(report, 201);
});
