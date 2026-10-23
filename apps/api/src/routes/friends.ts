import { Hono } from "hono";
import type { AppEnv } from "../context";
import { befriend, listFriends, unfriend } from "../services/friend-service";

export const friendRoutes = new Hono<AppEnv>()
  .get("/", async (c) => c.json(await listFriends(c.get("db"), c.get("userId"))))
  .post("/:username", async (c) => {
    const state = await befriend(c.get("db"), c.get("userId"), c.req.param("username"));
    return c.json({ state });
  })
  .delete("/:username", async (c) => {
    await unfriend(c.get("db"), c.get("userId"), c.req.param("username"));
    return c.json({ state: "none" });
  });
