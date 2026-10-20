import { dateParamSchema, saveEntryBodySchema, saveJournalBodySchema } from "@rlo/shared";
import { Hono } from "hono";
import type { AppEnv } from "../context";
import * as days from "../services/day-service";
import { parseJson } from "../validation";

export const dayRoutes = new Hono<AppEnv>()
  .get("/today", async (c) => c.json(await days.getDay(c.get("db"), c.get("userId"))))
  .get("/:date", async (c) => {
    const date = dateParamSchema.parse(c.req.param("date"));
    return c.json(await days.getDay(c.get("db"), c.get("userId"), date));
  })
  .put("/:date/journal", async (c) => {
    const date = dateParamSchema.parse(c.req.param("date"));
    const { journal } = await parseJson(c, saveJournalBodySchema);
    return c.json(await days.saveJournal(c.get("db"), c.get("userId"), date, journal));
  })
  .put("/:date/habits/:habitId", async (c) => {
    const date = dateParamSchema.parse(c.req.param("date"));
    const value = await parseJson(c, saveEntryBodySchema);
    return c.json(
      await days.saveEntry(c.get("db"), c.get("userId"), date, c.req.param("habitId"), value),
    );
  });
