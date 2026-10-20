import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import type { AppEnv } from "../context";
import * as userRepo from "../repos/user-repo";

export const DEV_USER_HEADER = "x-dev-user";
const USERNAME_PATTERN = /^[a-z0-9_-]{1,32}$/;

/**
 * Sets `userId` for downstream handlers. Real auth replaces only this middleware (DESIGN.md §8.5).
 * In dev mode the caller picks a user by name; production refuses to boot with AUTH_MODE=dev.
 */
export const requireUser = createMiddleware<AppEnv>(async (c, next) => {
  const env = c.get("env");
  if (env.AUTH_MODE !== "dev") throw new HTTPException(500, { message: "No auth configured" });

  const username = (c.req.header(DEV_USER_HEADER) ?? "dev").toLowerCase();
  if (!USERNAME_PATTERN.test(username)) {
    throw new HTTPException(400, { message: `Invalid ${DEV_USER_HEADER} header` });
  }
  const user = await userRepo.findOrCreateDevUser(c.get("db"), username);
  c.set("userId", user.id);
  await next();
});
