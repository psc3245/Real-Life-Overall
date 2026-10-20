import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import type { AppEnv } from "../context";
import * as userRepo from "../repos/user-repo";
import { runForUser } from "../services/scheduler";

/** Development-only helpers. Disabled outside APP_ENV=development. */
export const devRoutes = new Hono<AppEnv>()
  .use("*", async (c, next) => {
    if (c.get("env").APP_ENV !== "development")
      throw new HTTPException(404, { message: "Not found" });
    await next();
  })
  // Runs the 4am job for the current user right now: auto-recaps plus decay catch-up.
  .post("/run-scheduled", async (c) => {
    const user = await userRepo.findById(c.get("db"), c.get("userId"));
    if (!user) throw new HTTPException(404, { message: "User not found" });
    return c.json(
      await runForUser(c.get("db"), c.get("llm"), user.id, user.timezone, { recap: true }),
    );
  });
