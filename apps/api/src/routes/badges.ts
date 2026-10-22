import { Hono } from "hono";
import type { AppEnv } from "../context";
import { getBadges } from "../services/badge-service";

export const badgeRoutes = new Hono<AppEnv>().get("/", async (c) =>
  c.json(await getBadges(c.get("db"), c.get("userId"))),
);
