import { levelUpBodySchema } from "@rlo/shared";
import { Hono } from "hono";
import type { AppEnv } from "../context";
import { getSouls, levelUp } from "../services/souls-service";
import { parseJson } from "../validation";

/** Souls mode's bonfire (DESIGN.md §4.7). */
export const soulRoutes = new Hono<AppEnv>()
  .get("/", async (c) => c.json(await getSouls(c.get("db"), c.get("userId"))))
  .post("/level-up", async (c) => {
    const body = await parseJson(c, levelUpBodySchema);
    return c.json(await levelUp(c.get("db"), c.get("userId"), body));
  });
