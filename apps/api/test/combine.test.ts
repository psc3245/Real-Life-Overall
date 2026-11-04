import type { OnboardingStateDto, RatingsDto } from "@rlo/shared";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { users } from "../src/db/schema";
import { json } from "./flows";
import { createTestApp } from "./helpers";

const body = async <T>(res: Response) => (await res.json()) as T;

// A template category with two template attributes, plus a custom category and attribute.
const tree = {
  nodes: [
    { key: "fit", parentKey: null, name: "Fitness", templateKey: "fitness" },
    { key: "cardio", parentKey: "fit", name: "Cardio", templateKey: "fitness.cardio" },
    { key: "strength", parentKey: "fit", name: "Strength", templateKey: "fitness.strength" },
    { key: "games", parentKey: null, name: "Games" },
    { key: "chess", parentKey: "games", name: "Chess" },
  ],
};

async function freeApp() {
  const t = await createTestApp(); // no model responses: any LLM call fails the test
  const me = await body<{ id: string }>(await t.request("/me"));
  await t.db.update(users).set({ role: "user" }).where(eq(users.id, me.id));
  return t;
}

describe("the Combine", () => {
  it("onboards a free account with no model calls", async () => {
    const { request, model } = await freeApp();
    expect((await request("/onboarding/discovery", { method: "POST" })).status).toBe(403);
    await request("/onboarding/discovery/skip", { method: "POST" });
    await request("/onboarding/tree", { method: "PUT", ...json(tree) });
    const built = await body<OnboardingStateDto>(await request("/onboarding"));
    await request("/onboarding/weights", {
      method: "PUT",
      ...json({ weights: [{ nodeId: built.nodes[1]!.id, weight: 5 }] }),
    });

    const scout = await request("/onboarding/questionnaire", {
      method: "POST",
      ...json({ method: "scout" }),
    });
    expect(scout.status).toBe(403);
    const state = await body<OnboardingStateDto>(
      await request("/onboarding/questionnaire", { method: "POST" }),
    );
    expect(state.method).toBe("combine");
    expect(state.season.mode).toBe("growth");
    expect(state.questionnaire).toHaveLength(2 + 2 + 3); // cardio, strength, chess (generic)

    // Answer everything with the top option.
    const answers = Object.fromEntries(state.questionnaire!.map((q) => [q.id, q.options.at(-1)!]));
    await request("/onboarding/answers", { method: "PUT", ...json({ answers }) });
    const submitted = await body<OnboardingStateDto>(
      await request("/onboarding/questionnaire/submit", { method: "POST" }),
    );
    expect(submitted.stage).toBe("rating"); // no follow-up chat
    const done = await body<OnboardingStateDto>(
      await request("/onboarding/rate", { method: "POST" }),
    );
    expect(done.stage).toBe("complete");
    expect(model.doGenerateCalls).toHaveLength(0);

    const ratings = await body<RatingsDto>(await request("/ratings"));
    // A Growth season: the rating runs underneath.
    const value = (name: string) => ratings.nodes.find((n) => n.name === name)!.rating;
    expect(value("Cardio")).toBe(90); // (88 + 92) / 2
    expect(value("Strength")).toBe(89);
    expect(value("Chess")).toBeCloseTo((85 + 86 + 64 * 0.5) / 2.5, 1);
    expect(ratings.archetype?.name).toBe("Balanced Athlete"); // the runner-up is custom
  });

  it("is open to premium accounts too", async () => {
    const t = await createTestApp();
    await t.request("/onboarding/tree", { method: "PUT", ...json(tree) });
    const built = await body<OnboardingStateDto>(await t.request("/onboarding"));
    await t.request("/onboarding/weights", {
      method: "PUT",
      ...json({ weights: [{ nodeId: built.nodes[1]!.id, weight: 5 }] }),
    });
    const state = await body<OnboardingStateDto>(
      await t.request("/onboarding/questionnaire", {
        method: "POST",
        ...json({ method: "combine" }),
      }),
    );
    expect(state.method).toBe("combine");
    expect(t.model.doGenerateCalls).toHaveLength(0);
  });
});
