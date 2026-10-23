import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../context";
import { getActivity, getHistory } from "../services/history-service";
import { getChanges, getRatings } from "../services/ratings-service";

const SOURCES = ["onboarding", "daily_recap", "weekly_review", "decay", "recalibration"] as const;

const changesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).catch(50),
  offset: z.coerce.number().int().min(0).catch(0),
  /** Comma-separated event sources. */
  source: z
    .string()
    .optional()
    .transform((s) => (s ? s.split(",") : undefined))
    .pipe(z.array(z.enum(SOURCES)).optional()),
  nodeId: z.uuid().optional(),
});

export const ratingsRoutes = new Hono<AppEnv>()
  .get("/", async (c) => c.json(await getRatings(c.get("db"), c.get("userId"))))
  .get("/history", async (c) => {
    const days = Number(c.req.query("days")) || 90;
    return c.json(await getHistory(c.get("db"), c.get("userId"), days));
  })
  .get("/activity", async (c) => {
    const days = Number(c.req.query("days")) || 120;
    return c.json(await getActivity(c.get("db"), c.get("userId"), days));
  })
  .get("/changes", async (c) => {
    const query = changesQuerySchema.parse(c.req.query());
    const { source: sources, ...rest } = query;
    return c.json(await getChanges(c.get("db"), c.get("userId"), { ...rest, sources }));
  });
