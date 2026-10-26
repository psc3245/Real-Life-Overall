import { coachMessageBodySchema } from "@rlo/shared";
import { Hono } from "hono";
import type { AppEnv } from "../context";
import { badRequest } from "../errors";
import * as coach from "../services/coach-service";
import { idParam, parseJson } from "../validation";

/** The coach chat (DESIGN.md §5.9). */
export const coachRoutes = new Hono<AppEnv>()
  .get("/", async (c) => c.json(await coach.getCoach(c.get("db"), c.get("userId"))))
  .delete("/", async (c) => c.json(await coach.clearCoach(c.get("db"), c.get("userId"))))
  .post("/messages", async (c) => {
    const { content } = await parseJson(c, coachMessageBodySchema);
    return c.json(await coach.sendMessage(c.get("db"), c.get("llm"), c.get("userId"), content));
  })
  .post("/messages/:id/suggestions/:index/:action", async (c) => {
    const id = idParam(c, "id", "Message");
    const action = c.req.param("action");
    const index = Number(c.req.param("index"));
    if ((action !== "accept" && action !== "dismiss") || !Number.isInteger(index)) {
      throw badRequest("Use /accept or /dismiss with a suggestion index");
    }
    return c.json(await coach.resolveSuggestion(c.get("db"), c.get("userId"), id, index, action));
  });
