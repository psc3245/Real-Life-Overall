import { dateParamSchema, saveBodyBodySchema } from "@rlo/shared";
import { Hono } from "hono";
import type { AppEnv } from "../context";
import * as body from "../services/body-service";
import { parseJson } from "../validation";

/** Height and weight tracking (DESIGN.md §7.5). */
export const bodyRoutes = new Hono<AppEnv>()
  .get("/", async (c) => c.json(await body.getBody(c.get("db"), c.get("userId"))))
  .put("/:date", async (c) => {
    const date = dateParamSchema.parse(c.req.param("date"));
    const values = await parseJson(c, saveBodyBodySchema);
    return c.json(await body.saveBody(c.get("db"), c.get("userId"), date, values));
  });
