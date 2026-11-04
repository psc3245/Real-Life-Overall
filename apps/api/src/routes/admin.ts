import { BUG_REPORT_STATUSES, setRoleBodySchema, updateBugReportBodySchema } from "@rlo/shared";
import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../context";
import { notFound } from "../errors";
import * as bugReportRepo from "../repos/bug-report-repo";
import * as admin from "../services/admin-service";
import { idParam, parseJson } from "../validation";

const callsQuerySchema = z.object({
  userId: z.uuid().optional(),
  purpose: z.string().max(64).optional(),
  errors: z.enum(["1", "0"]).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

const bugReportsQuerySchema = z.object({
  status: z.enum(BUG_REPORT_STATUSES).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});

/** Admin tools and debug data (DESIGN.md §8.7). Mounted behind requireUser + requireAdmin. */
export const adminRoutes = new Hono<AppEnv>()
  .get("/overview", async (c) => c.json(await admin.overview(c.get("db"))))
  .get("/llm-calls", async (c) => {
    const q = callsQuerySchema.parse(c.req.query());
    return c.json(
      await admin.listCalls(
        c.get("db"),
        { userId: q.userId, purpose: q.purpose, errorsOnly: q.errors === "1" },
        q.limit,
      ),
    );
  })
  .get("/users", async (c) => c.json(await admin.listUsers(c.get("db"))))
  .patch("/users/:id", async (c) => {
    const { role } = await parseJson(c, setRoleBodySchema);
    await admin.setRole(c.get("db"), c.get("userId"), idParam(c, "id", "User"), role);
    return c.body(null, 204);
  })
  .get("/recaps/:id", async (c) =>
    c.json(await admin.recapDebug(c.get("db"), idParam(c, "id", "Recap"))),
  )
  .get("/bug-reports", async (c) => {
    const q = bugReportsQuerySchema.parse(c.req.query());
    return c.json(await bugReportRepo.list(c.get("db"), q.status, q.limit));
  })
  .patch("/bug-reports/:id", async (c) => {
    const { status } = await parseJson(c, updateBugReportBodySchema);
    const id = idParam(c, "id", "Bug report");
    if (!(await bugReportRepo.setStatus(c.get("db"), id, status))) {
      throw notFound("Bug report not found");
    }
    return c.body(null, 204);
  });
