import { isPremiumRole, isTesterRole, type SeasonMode, type UserRole } from "@rlo/shared";
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

/** Premium-only routes (DESIGN.md §8.9); runs after requireUser. Free accounts get a 403. */
export const requirePremium = createMiddleware<AppEnv>(async (c, next) => {
  if (!isPremiumRole(c.get("role") ?? "user")) throw premiumRequired();
  await next();
});

/** Dev and admin accounts only (bug reports); runs after requireUser. */
export const requireTester = createMiddleware<AppEnv>(async (c, next) => {
  if (!isTesterRole(c.get("role") ?? "user"))
    throw new HTTPException(404, { message: "Not found" });
  await next();
});

/** The 403 for a free account reaching a premium feature; answered with `code: "premium_required"`. */
export class PremiumRequiredError extends HTTPException {
  constructor(message = "This is a Premium feature.") {
    super(403, { message });
  }
}
const premiumRequired = () => new PremiumRequiredError();

/** Rating seasons are premium; free accounts play Growth seasons (DESIGN.md §8.9). */
export function assertSeasonModeAllowed(role: UserRole | undefined, mode: SeasonMode) {
  if (mode === "rating" && !isPremiumRole(role ?? "user")) {
    throw new PremiumRequiredError(
      "Rating seasons are a Premium feature. Free seasons score growth.",
    );
  }
}

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
