import {
  isValidTimeZone,
  preferencesPatchSchema,
  PROFILE_VISIBILITIES,
  UNIT_SYSTEMS,
  usernameSchema,
} from "@rlo/shared";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import type { AppEnv } from "../context";
import { conflict, isUniqueViolation } from "../errors";
import * as userRepo from "../repos/user-repo";
import { parseJson } from "../validation";

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
    return c.json(user);
  })
  .patch("/", async (c) => {
    const changes = await parseJson(c, updateMeSchema);
    const user = await userRepo.update(c.get("db"), c.get("userId"), changes).catch((error) => {
      if (isUniqueViolation(error)) throw conflict("That username is taken");
      throw error;
    });
    if (!user) throw new HTTPException(404, { message: "User not found" });
    return c.json(user);
  });
