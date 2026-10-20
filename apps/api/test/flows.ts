import type { OnboardingStateDto } from "@rlo/shared";
import { createTestApp, jsonResult } from "./helpers";

type Response = ReturnType<typeof jsonResult>;

// Refs by depth then order: Fitness n1, Career n2, Cardio n3, Strength n4.
// Rated leaves: Career (n2), Cardio (n3), Strength (n4).
export const standardTree = {
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
      prompt: "Hours?",
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

export const standardRatings = jsonResult({
  ratings: [rating("n2", 80), rating("n3", 70), rating("n4", 50)],
  archetype: { name: "Desk Athlete", description: "Strong at work." },
  summary: "Career leads.",
});

export const json = (body: unknown) => ({ body: JSON.stringify(body) });

/** A test app whose dev user has finished onboarding; `responses` queue after onboarding's. */
export async function createRatedApp(responses: Response[] = []) {
  const t = await createTestApp({ doGenerate: [questionnaire, standardRatings, ...responses] });
  await t.request("/onboarding/tree", { method: "PUT", ...json(standardTree) });
  const state = (await (await t.request("/onboarding")).json()) as OnboardingStateDto;
  await t.request("/onboarding/weights", {
    method: "PUT",
    ...json({ weights: [{ nodeId: state.nodes[1]!.id, weight: 5 }] }),
  });
  await t.request("/onboarding/questionnaire", { method: "POST" });
  await t.request("/onboarding/answers", { method: "PUT", ...json({ answers: { q1: 5 } }) });
  await t.request("/onboarding/questionnaire/submit", { method: "POST" });
  await t.request("/onboarding/followup/finish", { method: "POST" });
  const done = (await (
    await t.request("/onboarding/rate", { method: "POST" })
  ).json()) as OnboardingStateDto;
  if (done.stage !== "complete") throw new Error(`Onboarding did not complete: ${done.stage}`);
  const nodeId = (name: string) => done.nodes.find((n) => n.name === name)!.id;
  return { ...t, nodeId };
}
