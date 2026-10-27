import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import type { AppEnv } from "../context";
import * as userRepo from "../repos/user-repo";
import { createAuth, type Auth } from "../auth/auth";
import type { Context } from "hono";

export const DEV_USER_HEADER = "x-dev-user";
const USERNAME_PATTERN = /^[a-z0-9_-]{1,32}$/;

/**
 * Sets `userId` for downstream handlers. Real auth replaces only this middleware (DESIGN.md §8.5).
 * In dev mode the caller picks a user by name; production refuses to boot with AUTH_MODE=dev.
 */
export const requireUser = createMiddleware<AppEnv>(async (c, next) => {
  const env = c.get("env");
  if (env.AUTH_MODE === "better-auth") {
    const session = await authFor(c).api.getSession({ headers: c.req.raw.headers });
    if (!session) throw new HTTPException(401, { message: "Sign in required" });
    const db = c.get("db");
    const user =
      (await userRepo.findByAuthSubject(db, session.user.id)) ??
      (await userRepo.createForAuth(db, session.user));
    c.set("userId", user.id);
    c.set("role", user.role);
    await next();
    return;
  }

  const username = (c.req.header(DEV_USER_HEADER) ?? "dev").toLowerCase();
  if (!USERNAME_PATTERN.test(username)) {
    throw new HTTPException(400, { message: `Invalid ${DEV_USER_HEADER} header` });
  }
  const user = await userRepo.findOrCreateDevUser(c.get("db"), username);
  c.set("userId", user.id);
  c.set("role", user.role);
  await next();
});

/**
 * Admin-only routes (DESIGN.md §8.7); runs after requireUser. Non-admins get a 404 so the routes
 * don't advertise themselves.
 */
export const requireAdmin = createMiddleware<AppEnv>(async (c, next) => {
  if (c.get("role") !== "admin") throw new HTTPException(404, { message: "Not found" });
  await next();
});

/**
 * For pages anyone can open (public profiles): sets `userId` when the caller is signed in and
 * leaves it unset otherwise. In dev mode only an explicit x-dev-user header counts.
 */
export const optionalUser = createMiddleware<AppEnv>(async (c, next) => {
  const env = c.get("env");
  const db = c.get("db");
  if (env.AUTH_MODE === "better-auth") {
    const session = await authFor(c).api.getSession({ headers: c.req.raw.headers });
    if (session) {
      const user =
        (await userRepo.findByAuthSubject(db, session.user.id)) ??
        (await userRepo.createForAuth(db, session.user));
      c.set("userId", user.id);
    }
  } else {
    const username = c.req.header(DEV_USER_HEADER)?.toLowerCase();
    if (username && USERNAME_PATTERN.test(username)) {
      c.set("userId", (await userRepo.findOrCreateDevUser(db, username)).id);
    }
  }
  await next();
});

/** One Better Auth instance per request, created on first use. */
export function authFor(c: Context<AppEnv>): Auth {
  let auth = c.get("auth");
  if (!auth) {
    auth = createAuth(c.get("env"), c.get("db"), c.get("mailer"));
    c.set("auth", auth);
  }
  return auth;
}
