import {
  dateParamSchema,
  saveEntryBodySchema,
  saveJournalBodySchema,
  savePromptAnswersBodySchema,
} from "@rlo/shared";
import { Hono } from "hono";
import type { AppEnv } from "../context";
import * as days from "../services/day-service";
import { runDailyRecap } from "../services/recap-service";
import { idParam, parseJson } from "../validation";

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
      await days.saveEntry(
        c.get("db"),
        c.get("userId"),
        date,
        idParam(c, "habitId", "Habit"),
        value,
      ),
    );
  })
  .put("/:date/prompts", async (c) => {
    const date = dateParamSchema.parse(c.req.param("date"));
    const { answers } = await parseJson(c, savePromptAnswersBodySchema);
    return c.json(await days.savePromptAnswers(c.get("db"), c.get("userId"), date, answers));
  })
  .post("/:date/recap", async (c) => {
    const date = dateParamSchema.parse(c.req.param("date"));
    return c.json(await runDailyRecap(c.get("db"), c.get("llm"), c.get("userId"), date));
  });
