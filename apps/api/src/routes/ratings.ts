import { Hono } from "hono";
import { MAX_HISTORY_DAYS, RATING_EVENT_SOURCES } from "@rlo/shared";
import { z } from "zod";
import type { AppEnv } from "../context";
import { getActivity, getHistory } from "../services/history-service";
import { getChanges, getRatings } from "../services/ratings-service";

/** `?days=` for history views, capped at a year (bad values fall back to the default). */
const daysQuery = (fallback: number) =>
  z.object({ days: z.coerce.number().int().min(1).max(MAX_HISTORY_DAYS).catch(fallback) });

const changesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).catch(50),
  offset: z.coerce.number().int().min(0).catch(0),
  /** Comma-separated event sources. */
  source: z
    .string()
    .optional()
    .transform((s) => (s ? s.split(",") : undefined))
    .pipe(z.array(z.enum(RATING_EVENT_SOURCES)).optional()),
  nodeId: z.uuid().optional(),
});

export const ratingsRoutes = new Hono<AppEnv>()
  .get("/", async (c) => c.json(await getRatings(c.get("db"), c.get("userId"))))
  .get("/history", async (c) => {
    const { days } = daysQuery(90).parse(c.req.query());
    return c.json(await getHistory(c.get("db"), c.get("userId"), days));
  })
  .get("/activity", async (c) => {
    const { days } = daysQuery(120).parse(c.req.query());
    return c.json(await getActivity(c.get("db"), c.get("userId"), days));
  })
  .get("/changes", async (c) => {
    const query = changesQuerySchema.parse(c.req.query());
    const { source: sources, ...rest } = query;
    return c.json(await getChanges(c.get("db"), c.get("userId"), { ...rest, sources }));
  });
