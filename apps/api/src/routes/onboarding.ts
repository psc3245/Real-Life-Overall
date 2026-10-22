import {
  followupMessageBodySchema,
  saveAnswersBodySchema,
  saveWeightsBodySchema,
  suggestAttributesBodySchema,
  suggestWeightsBodySchema,
  treeDraftSchema,
} from "@rlo/shared";
import { Hono } from "hono";
import type { AppEnv } from "../context";
import * as onboarding from "../services/onboarding-service";
import { parseJson, parseOptionalJson } from "../validation";

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
  })
  .post("/questionnaire", async (c) =>
    c.json(await onboarding.generateQuestionnaire(c.get("db"), c.get("llm"), c.get("userId"))),
  )
  .put("/answers", async (c) => {
    const { answers } = await parseJson(c, saveAnswersBodySchema);
    return c.json(await onboarding.saveAnswers(c.get("db"), c.get("userId"), answers));
  })
  .post("/questionnaire/submit", async (c) =>
    c.json(await onboarding.submitQuestionnaire(c.get("db"), c.get("userId"))),
  )
  .post("/followup", async (c) => {
    // The opening turn has no body; later turns carry the user's reply.
    const message = await parseOptionalJson(c, followupMessageBodySchema);
    return c.json(
      await onboarding.continueFollowup(
        c.get("db"),
        c.get("llm"),
        c.get("userId"),
        message?.message,
      ),
    );
  })
  .post("/followup/finish", async (c) =>
    c.json(await onboarding.finishFollowup(c.get("db"), c.get("userId"))),
  )
  .post("/rate", async (c) =>
    c.json(await onboarding.rateInitial(c.get("db"), c.get("llm"), c.get("userId"))),
  )
  .post("/discovery", async (c) => {
    const body = await parseOptionalJson(c, followupMessageBodySchema);
    return c.json(
      await onboarding.continueDiscovery(c.get("db"), c.get("llm"), c.get("userId"), body?.message),
    );
  })
  .post("/discovery/skip", async (c) =>
    c.json(await onboarding.skipDiscovery(c.get("db"), c.get("userId"))),
  )
  .post("/template", async (c) =>
    c.json(await onboarding.draftTemplate(c.get("db"), c.get("llm"), c.get("userId"))),
  );
