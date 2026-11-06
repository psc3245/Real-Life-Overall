import {
  accountActionBodySchema,
  adminUsersQuerySchema,
  BUG_REPORT_STATUSES,
  createAccountBodySchema,
  deleteAccountBodySchema,
  setAccountSeasonModeBodySchema,
  setRoleBodySchema,
  updateBugReportBodySchema,
} from "@rlo/shared";
import { Hono, type Context } from "hono";
import { z } from "zod";
import type { AppEnv } from "../context";
import { notFound } from "../errors";
import { authFor } from "../middleware/auth";
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

/** Better Auth, when the API runs with real sign-in (dev mode has no auth identities). */
const authOrNull = (c: Context<AppEnv>) =>
  c.get("env").AUTH_MODE === "better-auth" ? authFor(c) : null;
const links = (c: Context<AppEnv>) => ({ origin: c.get("env").PUBLIC_URL });

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
  .get("/users", async (c) => {
    const { limit, ...filter } = adminUsersQuerySchema.parse(c.req.query());
    return c.json(await admin.listUsers(c.get("db"), filter, limit));
  })
  .post("/users", async (c) => {
    const body = await parseJson(c, createAccountBodySchema);
    return c.json(await admin.createAccount(c.get("db"), authOrNull(c), links(c), body), 201);
  })
  .delete("/users/:id", async (c) => {
    const { confirm } = await parseJson(c, deleteAccountBodySchema);
    await admin.deleteAccount(c.get("db"), c.get("userId"), idParam(c, "id", "User"), confirm);
    return c.body(null, 204);
  })
  .post("/users/:id/actions", async (c) => {
    const { action } = await parseJson(c, accountActionBodySchema);
    const id = idParam(c, "id", "User");
    await admin.accountAction(c.get("db"), authOrNull(c), links(c), id, action);
    return c.body(null, 204);
  })
  .patch("/users/:id", async (c) => {
    const { role } = await parseJson(c, setRoleBodySchema);
    await admin.setRole(c.get("db"), c.get("userId"), idParam(c, "id", "User"), role);
    return c.body(null, 204);
  })
  .put("/users/:id/season-mode", async (c) => {
    const { mode } = await parseJson(c, setAccountSeasonModeBodySchema);
    await admin.setSeasonMode(c.get("db"), idParam(c, "id", "User"), mode);
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
