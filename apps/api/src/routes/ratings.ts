import { Hono } from "hono";
import type { AppEnv } from "../context";
import { getChanges, getRatings } from "../services/ratings-service";

export const ratingsRoutes = new Hono<AppEnv>()
  .get("/", async (c) => c.json(await getRatings(c.get("db"), c.get("userId"))))
  .get("/changes", async (c) => {
    const limit = Math.min(200, Math.max(1, Number(c.req.query("limit")) || 50));
    return c.json(await getChanges(c.get("db"), c.get("userId"), limit));
  });
