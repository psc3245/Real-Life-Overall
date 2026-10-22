import { createPauseBodySchema, endPauseBodySchema } from "@rlo/shared";
import { Hono } from "hono";
import type { AppEnv } from "../context";
import * as pauses from "../services/pause-service";
import { parseJson } from "../validation";

export const pauseRoutes = new Hono<AppEnv>()
  .get("/", async (c) => c.json(await pauses.listPauses(c.get("db"), c.get("userId"))))
  .post("/", async (c) => {
    const body = await parseJson(c, createPauseBodySchema);
    return c.json(await pauses.createPause(c.get("db"), c.get("userId"), body), 201);
  })
  .post("/:id/end", async (c) => {
    const { endsOn } = await parseJson(c, endPauseBodySchema);
    const result = await pauses.endPause(c.get("db"), c.get("userId"), c.req.param("id"), endsOn);
    return result ? c.json(result) : c.body(null, 204);
  });
