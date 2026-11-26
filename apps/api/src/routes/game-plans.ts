import { createGamePlanBodySchema, updateGamePlanBodySchema } from "@rlo/shared";
import { Hono } from "hono";
import type { AppEnv } from "../context";
import * as plans from "../services/game-plan-service";
import { idParam, parseJson } from "../validation";

/** Game Plans: emphases for a stretch of time, with no numbers (DESIGN.md §7.16). */
export const gamePlanRoutes = new Hono<AppEnv>()
  .get("/", async (c) => c.json(await plans.listGamePlans(c.get("db"), c.get("userId"))))
  .post("/", async (c) => {
    const body = await parseJson(c, createGamePlanBodySchema);
    return c.json(await plans.createGamePlan(c.get("db"), c.get("userId"), body), 201);
  })
  .patch("/:id", async (c) => {
    const body = await parseJson(c, updateGamePlanBodySchema);
    return c.json(
      await plans.updateGamePlan(c.get("db"), c.get("userId"), idParam(c, "id", "Game Plan"), body),
    );
  })
  .delete("/:id", async (c) => {
    await plans.deleteGamePlan(c.get("db"), c.get("userId"), idParam(c, "id", "Game Plan"));
    return c.body(null, 204);
  });
