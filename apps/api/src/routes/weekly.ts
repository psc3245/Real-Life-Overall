import { Hono } from "hono";
import type { AppEnv } from "../context";
import { badRequest } from "../errors";
import * as weekly from "../services/weekly-service";
import { idParam } from "../validation";

export const weeklyRoutes = new Hono<AppEnv>()
  .get("/", async (c) => c.json(await weekly.getWeeklyState(c.get("db"), c.get("userId"))))
  .get("/focus", async (c) => c.json(await weekly.currentFocus(c.get("db"), c.get("userId"))))
  .get("/:id", async (c) =>
    c.json(
      await weekly.getWeeklyReview(c.get("db"), c.get("userId"), idParam(c, "id", "Weekly review")),
    ),
  )
  .post("/run", async (c) =>
    c.json(await weekly.runWeeklyReview(c.get("db"), c.get("llm"), c.get("userId"))),
  )
  .post("/:id/proposals/:index/:action", async (c) => {
    const id = idParam(c, "id", "Weekly review");
    const action = c.req.param("action");
    const index = Number(c.req.param("index"));
    if ((action !== "accept" && action !== "dismiss") || !Number.isInteger(index)) {
      throw badRequest("Use /accept or /dismiss with a proposal index");
    }
    return c.json(await weekly.resolveProposal(c.get("db"), c.get("userId"), id, index, action));
  });
