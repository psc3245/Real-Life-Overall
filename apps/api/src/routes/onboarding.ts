import {
  saveWeightsBodySchema,
  suggestAttributesBodySchema,
  suggestWeightsBodySchema,
  treeDraftSchema,
} from "@rlo/shared";
import { Hono } from "hono";
import type { AppEnv } from "../context";
import * as onboarding from "../services/onboarding-service";
import { parseJson } from "../validation";

export const onboardingRoutes = new Hono<AppEnv>()
  .get("/", async (c) => c.json(await onboarding.getState(c.get("db"), c.get("userId"))))
  .put("/tree", async (c) => {
    const draft = await parseJson(c, treeDraftSchema);
    return c.json(await onboarding.saveTree(c.get("db"), c.get("userId"), draft));
  })
  .post("/attributes/suggest", async (c) => {
    const body = await parseJson(c, suggestAttributesBodySchema);
    return c.json(await onboarding.suggestAttributes(c.get("llm"), c.get("userId"), body));
  })
  .post("/weights/suggest", async (c) => {
    const { priorities } = await parseJson(c, suggestWeightsBodySchema);
    return c.json(
      await onboarding.suggestWeights(c.get("db"), c.get("llm"), c.get("userId"), priorities),
    );
  })
  .put("/weights", async (c) => {
    const { weights } = await parseJson(c, saveWeightsBodySchema);
    return c.json(await onboarding.saveWeights(c.get("db"), c.get("userId"), weights));
  });
