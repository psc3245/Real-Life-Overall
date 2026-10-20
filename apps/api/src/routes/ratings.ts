import { Hono } from "hono";
import type { AppEnv } from "../context";
import { getRatings } from "../services/ratings-service";

export const ratingsRoutes = new Hono<AppEnv>().get("/", async (c) =>
  c.json(await getRatings(c.get("db"), c.get("userId"))),
);
