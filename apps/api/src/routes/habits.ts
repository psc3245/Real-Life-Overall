import { createHabitBodySchema, suggestLinksBodySchema, updateHabitBodySchema } from "@rlo/shared";
import { Hono } from "hono";
import type { AppEnv } from "../context";
import * as habits from "../services/habit-service";
import { parseJson } from "../validation";

export const habitRoutes = new Hono<AppEnv>()
  .get("/", async (c) => c.json(await habits.listHabits(c.get("db"), c.get("userId"))))
  .post("/", async (c) => {
    const body = await parseJson(c, createHabitBodySchema);
    return c.json(await habits.createHabit(c.get("db"), c.get("userId"), body), 201);
  })
  .post("/suggest-links", async (c) => {
    const body = await parseJson(c, suggestLinksBodySchema);
    return c.json(await habits.suggestLinks(c.get("db"), c.get("llm"), c.get("userId"), body));
  })
  .patch("/:id", async (c) => {
    const body = await parseJson(c, updateHabitBodySchema);
    return c.json(await habits.updateHabit(c.get("db"), c.get("userId"), c.req.param("id"), body));
  })
  .delete("/:id", async (c) => {
    await habits.archiveHabit(c.get("db"), c.get("userId"), c.req.param("id"));
    return c.body(null, 204);
  });
