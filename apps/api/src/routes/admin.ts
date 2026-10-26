import { setRoleBodySchema } from "@rlo/shared";
import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../context";
import * as admin from "../services/admin-service";
import { idParam, parseJson } from "../validation";

const callsQuerySchema = z.object({
  userId: z.uuid().optional(),
  purpose: z.string().max(64).optional(),
  errors: z.enum(["1", "0"]).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
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
  );
