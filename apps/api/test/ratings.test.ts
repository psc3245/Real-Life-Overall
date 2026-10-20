import type { OnboardingStateDto, RatingsDto } from "@rlo/shared";
import { describe, expect, it } from "vitest";
import { decayRules, ratingEvents } from "../src/db/schema";
import { createTestApp, jsonResult } from "./helpers";

// Refs by depth then order: Fitness n1, Career n2, Cardio n3, Strength n4.
// Rated leaves: Career (n2), Cardio (n3), Strength (n4).
const tree = {
  nodes: [
    { key: "fit", parentKey: null, name: "Fitness" },
    { key: "career", parentKey: null, name: "Career" },
    { key: "cardio", parentKey: "fit", name: "Cardio" },
    { key: "strength", parentKey: "fit", name: "Strength" },
  ],
};
const questionnaire = jsonResult({
  questions: [
    {
      refs: ["n2", "n3", "n4"],
      type: "number",
      prompt: "How many hours a week?",
      options: [],
      min: null,
      max: null,
      minLabel: null,
      maxLabel: null,
      unit: "hours",
    },
  ],
});
const rating = (ref: string, value: number) => ({
  ref,
  value,
  confidence: "high",
  rationale: `Because of ${ref}.`,
  decayGraceDays: 5,
  decayPerDay: 0.25,
  decayFloor: value - 20,
});
const ratingsOutput = jsonResult({
  ratings: [rating("n2", 80), rating("n3", 70), rating("n4", 50)],
  archetype: { name: "Desk Athlete", description: "Strong at work, building fitness." },
  summary: "Career leads; strength is the gap.",
});
const json = (body: unknown) => ({ body: JSON.stringify(body) });

async function toRatingStage(responses = [ratingsOutput]) {
  const t = await createTestApp({ doGenerate: [questionnaire, ...responses] });
  const state = (await (
    await t.request("/onboarding/tree", { method: "PUT", ...json(tree) })
  ).json()) as OnboardingStateDto;
  const weightOf: Record<string, number> = { Fitness: 3, Career: 1 };
  await t.request("/onboarding/weights", {
    method: "PUT",
    ...json({
      weights: state.nodes
        .filter((n) => n.parentId)
        .map((n) => ({ nodeId: n.id, weight: weightOf[n.name] ?? 5 })),
    }),
  });
  await t.request("/onboarding/questionnaire", { method: "POST" });
  await t.request("/onboarding/answers", { method: "PUT", ...json({ answers: { q1: 6 } }) });
  await t.request("/onboarding/questionnaire/submit", { method: "POST" });
  await t.request("/onboarding/followup/finish", { method: "POST" });
  return t;
}

describe("initial ratings", () => {
  it("rates every leaf, rolls up the overall, and activates the season", async () => {
    const { request, model } = await toRatingStage();
    const done = (await (
      await request("/onboarding/rate", { method: "POST" })
    ).json()) as OnboardingStateDto;
    expect(done.stage).toBe("complete");

    const prompt = JSON.stringify(model.doGenerateCalls.at(-1)!.prompt);
    expect(prompt).toContain("A: 6 hours");
    expect(prompt).toContain("Follow-up conversation:\\n(skipped)");
    expect(prompt).toContain("95+: elite");

    const ratings = (await (await request("/ratings")).json()) as RatingsDto;
    const byName = new Map(ratings.nodes.map((n) => [n.name, n]));
    expect(ratings.season.status).toBe("active");
    expect(ratings.archetype).toEqual({
      name: "Desk Athlete",
      description: "Strong at work, building fitness.",
    });
    expect(ratings.summary).toBe("Career leads; strength is the gap.");
    expect(byName.get("Cardio")).toMatchObject({
      value: 70,
      rationale: "Because of n3.",
      confidence: "high",
      decay: { graceDays: 5, perDay: 0.25, floor: 50 },
    });
    expect(byName.get("Fitness")!.value).toBe(60); // (70 + 50) / 2
    expect(byName.get("Overall")!.value).toBe(65); // (60*3 + 80*1) / 4
    expect(byName.get("Fitness")!.rationale).toBeNull();
  });

  it("is idempotent once complete", async () => {
    const { request, db, model } = await toRatingStage();
    await request("/onboarding/rate", { method: "POST" });
    const again = await request("/onboarding/rate", { method: "POST" });
    expect(again.status).toBe(200);
    expect(model.doGenerateCalls).toHaveLength(2); // questionnaire + one rating call
    expect(await db.select().from(ratingEvents)).toHaveLength(3);
    expect(await db.select().from(decayRules)).toHaveLength(3);
  });

  it("writes only once when two rating requests race", async () => {
    const { request, db } = await toRatingStage([ratingsOutput, ratingsOutput]);
    const results = await Promise.all([
      request("/onboarding/rate", { method: "POST" }),
      request("/onboarding/rate", { method: "POST" }),
    ]);
    expect(results.map((r) => r.status)).toEqual([200, 200]);
    expect(await db.select().from(ratingEvents)).toHaveLength(3);
  });

  it("refuses to rate before scouting is finished, and has no ratings until then", async () => {
    const { request } = await createTestApp();
    await request("/onboarding/tree", { method: "PUT", ...json(tree) });
    expect((await request("/onboarding/rate", { method: "POST" })).status).toBe(409);
    expect((await request("/ratings")).status).toBe(404);
  });

  it("retries when the model skips an attribute", async () => {
    const incomplete = jsonResult({
      ratings: [rating("n2", 80)],
      archetype: { name: "X", description: "Y" },
      summary: "Z",
    });
    const { request, model } = await toRatingStage([incomplete, ratingsOutput]);
    const res = await request("/onboarding/rate", { method: "POST" });
    expect(res.status).toBe(200);
    expect(model.doGenerateCalls).toHaveLength(3);
  });
});
