import {
  isValidTimeZone,
  lockedFeatures,
  preferencesPatchSchema,
  PROFILE_VISIBILITIES,
  UNIT_SYSTEMS,
  usernameSchema,
  type Feature,
} from "@rlo/shared";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import type { AppEnv } from "../context";
import { conflict, isUniqueViolation } from "../errors";
import * as userRepo from "../repos/user-repo";
import { parseJson } from "../validation";

/** Adds the account's locked features and switches them off (DESIGN.md §8.9). */
function withAccess(user: userRepo.PublicUser) {
  const locked = lockedFeatures(user.role);
  const features = { ...user.preferences.features };
  for (const f of Object.keys(locked) as Feature[]) features[f] = false;
  return { ...user, preferences: { ...user.preferences, features }, locked };
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
  .get("/", async (c) => {
    const user = await userRepo.findById(c.get("db"), c.get("userId"));
    if (!user) throw new HTTPException(404, { message: "User not found" });
    return c.json(withAccess(user));
  })
  .patch("/", async (c) => {
    const changes = await parseJson(c, updateMeSchema);
    const user = await userRepo.update(c.get("db"), c.get("userId"), changes).catch((error) => {
      if (isUniqueViolation(error)) throw conflict("That username is taken");
      throw error;
    });
    if (!user) throw new HTTPException(404, { message: "User not found" });
    return c.json(withAccess(user));
  });
