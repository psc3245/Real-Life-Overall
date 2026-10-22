import { Hono } from "hono";
import type { AppEnv } from "../context";
import { getActivity, getHistory } from "../services/history-service";
import { getChanges, getRatings } from "../services/ratings-service";

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
    const limit = Math.min(200, Math.max(1, Number(c.req.query("limit")) || 50));
    return c.json(await getChanges(c.get("db"), c.get("userId"), limit));
  });
