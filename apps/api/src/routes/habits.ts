import {
  createHabitBodySchema,
  dateParamSchema,
  HABIT_STAT_RANGES,
  suggestLinksBodySchema,
  updateHabitBodySchema,
} from "@rlo/shared";
import { z } from "zod";
import { Hono } from "hono";
import type { AppEnv } from "../context";
import * as habits from "../services/habit-service";
import { idParam, parseJson } from "../validation";

const statsQuerySchema = z.object({
  range: z.enum(HABIT_STAT_RANGES).default("week"),
  /** Any date in the period to show; defaults to today. */
  date: dateParamSchema.optional(),
});

export const habitRoutes = new Hono<AppEnv>()
  .get("/", async (c) => c.json(await habits.listHabits(c.get("db"), c.get("userId"))))
  .get("/stats", async (c) => {
    const { range, date } = statsQuerySchema.parse(c.req.query());
    return c.json(await habits.getHabitStats(c.get("db"), c.get("userId"), range, date));
  })
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
    return c.json(
      await habits.updateHabit(c.get("db"), c.get("userId"), idParam(c, "id", "Habit"), body),
    );
  })
  .delete("/:id", async (c) => {
    await habits.archiveHabit(c.get("db"), c.get("userId"), idParam(c, "id", "Habit"));
    return c.body(null, 204);
  });
