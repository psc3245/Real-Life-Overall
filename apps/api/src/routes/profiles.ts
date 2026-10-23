import { Hono } from "hono";
import type { AppEnv } from "../context";
import { getProfile } from "../services/profile-service";

/** Public profile pages; signed-out visitors can open public ones (optionalUser). */
export const profileRoutes = new Hono<AppEnv>().get("/:username", async (c) =>
  c.json(await getProfile(c.get("db"), c.get("userId") ?? null, c.req.param("username"))),
);
