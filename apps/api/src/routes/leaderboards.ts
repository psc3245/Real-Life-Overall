import { leaderboardQuerySchema } from "@rlo/shared";
import { Hono } from "hono";
import type { AppEnv } from "../context";
import { getLeaderboard } from "../services/leaderboard-service";

export const leaderboardRoutes = new Hono<AppEnv>().get("/", async (c) => {
  const { scope, board } = leaderboardQuerySchema.parse(c.req.query());
  return c.json(await getLeaderboard(c.get("db"), c.get("userId"), scope, board));
});
