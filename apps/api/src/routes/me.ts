import {
  isValidTimeZone,
  lockedFeatures,
  preferencesPatchSchema,
  setOwnRoleBodySchema,
  PROFILE_VISIBILITIES,
  UNIT_SYSTEMS,
  usernameSchema,
  type AiUsageDto,
  type Feature,
} from "@rlo/shared";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import type { AppEnv } from "../context";
import { badRequest, conflict, isUniqueViolation } from "../errors";
import * as adminRepo from "../repos/admin-repo";
import * as userRepo from "../repos/user-repo";
import { budgetUsage } from "../llm/client";
import { parseJson } from "../validation";

/**
 * Adds the account's locked features and switches them off, and whether the player can change
 * their own type (DESIGN.md §8.9).
 */
function withAccess(user: userRepo.PublicUser, selfUpgrade: boolean) {
  const locked = lockedFeatures(user.role);
  const features = { ...user.preferences.features };
  for (const f of Object.keys(locked) as Feature[]) features[f] = false;
  return { ...user, preferences: { ...user.preferences, features }, locked, selfUpgrade };
}

const updateMeSchema = z
  .object({
    displayName: z.string().trim().min(1).max(40),
    timezone: z.string().refine(isValidTimeZone, "Unknown timezone"),
    weekStart: z.number().int().min(0).max(6),
    username: usernameSchema,
    profileVisibility: z.enum(PROFILE_VISIBILITIES),
    leaderboardOptIn: z.boolean(),
    unitSystem: z.enum(UNIT_SYSTEMS),
    trackWeight: z.boolean(),
    trackHeight: z.boolean(),
    preferences: preferencesPatchSchema,
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, "Provide at least one field");

export const meRoutes = new Hono<AppEnv>()
  .get("/ai-usage", async (c) => {
    const env = c.get("env");
    const { spentUsd, budgetUsd } = await budgetUsage(
      c.get("db"),
      { premiumUsd: env.LLM_USER_DAILY_BUDGET_USD, freeUsd: env.LLM_FREE_DAILY_BUDGET_USD },
      c.get("userId"),
    );
    const usage: AiUsageDto = {
      usedPercent: Math.min(100, Math.ceil((spentUsd / budgetUsd) * 100)),
    };
    return c.json(usage);
  })
  .get("/", async (c) => {
    const user = await userRepo.findById(c.get("db"), c.get("userId"));
    if (!user) throw new HTTPException(404, { message: "User not found" });
    return c.json(withAccess(user, c.get("env").SELF_UPGRADES));
  })
  /** The upgrade page's switch: Free, Premium or Dev, free of charge while it's on. */
  .put("/role", async (c) => {
    const env = c.get("env");
    if (!env.SELF_UPGRADES) {
      throw new HTTPException(403, { message: "Ask an admin to change your account type" });
    }
    const { role } = await parseJson(c, setOwnRoleBodySchema);
    const db = c.get("db");
    const current = await userRepo.findById(db, c.get("userId"));
    if (!current) throw new HTTPException(404, { message: "User not found" });
    // An admin switching here would lose the admin page; /admin changes admin accounts.
    if (current.role === "admin") throw badRequest("Admins change their type from /admin");
    await adminRepo.setRole(db, current.id, role);
    const user = await userRepo.findById(db, current.id);
    return c.json(withAccess(user!, env.SELF_UPGRADES));
  })
  .patch("/", async (c) => {
    const changes = await parseJson(c, updateMeSchema);
    const user = await userRepo.update(c.get("db"), c.get("userId"), changes).catch((error) => {
      if (isUniqueViolation(error)) throw conflict("That username is taken");
      throw error;
    });
    if (!user) throw new HTTPException(404, { message: "User not found" });
    return c.json(withAccess(user, c.get("env").SELF_UPGRADES));
  });
