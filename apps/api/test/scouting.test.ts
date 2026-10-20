import type { OnboardingStateDto } from "@rlo/shared";
import { describe, expect, it } from "vitest";
import { llmCalls } from "../src/db/schema";
import { createTestApp, jsonResult } from "./helpers";

// Listed to the model by depth then order: Fitness n1, Career n2, Cardio n3, Strength n4.
// Rated leaves: Career (n2), Cardio (n3), Strength (n4).
const tree = {
  nodes: [
    { key: "fit", parentKey: null, name: "Fitness" },
    { key: "career", parentKey: null, name: "Career" },
    { key: "cardio", parentKey: "fit", name: "Cardio" },
    { key: "strength", parentKey: "fit", name: "Strength" },
  ],
};

const question = (refs: string[], over: Record<string, unknown> = {}) => ({
  refs,
  type: "single_choice",
  prompt: `About ${refs.join("+")}?`,
  options: ["Never", "Sometimes", "Often"],
  min: null,
  max: null,
  minLabel: null,
  maxLabel: null,
  unit: null,
  ...over,
});

const questionnaire = jsonResult({
  questions: [
    question(["n2"]),
    question(["n3", "n4"], { type: "number", options: [], unit: "days/week", min: 0, max: 7 }),
    question(["n3"], { type: "short_text", options: [] }),
  ],
});

const json = (body: unknown) => ({ body: JSON.stringify(body) });

async function toQuestionnaireStage(extraResponses: ReturnType<typeof jsonResult>[] = []) {
  const t = await createTestApp({ doGenerate: [questionnaire, ...extraResponses] });
  const state = (await (
    await t.request("/onboarding/tree", { method: "PUT", ...json(tree) })
  ).json()) as OnboardingStateDto;
  await t.request("/onboarding/weights", {
    method: "PUT",
    ...json({ weights: [{ nodeId: state.nodes[1]!.id, weight: 7 }] }),
  });
  return t;
}

const state = async (res: Response) => (await res.json()) as OnboardingStateDto;

describe("scouting questionnaire", () => {
  it("generates once, normalizes, and locks the tree", async () => {
    const { request, model } = await toQuestionnaireStage();
    const generated = await state(await request("/onboarding/questionnaire", { method: "POST" }));

    expect(generated.questionnaire).toHaveLength(3);
    const byName = new Map(generated.nodes.map((n) => [n.name, n.id]));
    expect(generated.questionnaire![1]).toMatchObject({
      id: "q2",
      type: "number",
      nodeIds: [byName.get("Cardio"), byName.get("Strength")],
      unit: "days/week",
    });
    const prompt = JSON.stringify(model.doGenerateCalls[0]!.prompt);
    expect(prompt).toContain("[n3] Cardio (rated attribute)");

    // Idempotent: a second call returns the same questions without another LLM call.
    const again = await state(await request("/onboarding/questionnaire", { method: "POST" }));
    expect(again.questionnaire).toEqual(generated.questionnaire);
    expect(model.doGenerateCalls).toHaveLength(1);

    const locked = await request("/onboarding/tree", { method: "PUT", ...json(tree) });
    expect(locked.status).toBe(409);
  });

  it("autosaves partial answers with validation and clearing", async () => {
    const { request } = await toQuestionnaireStage();
    await request("/onboarding/questionnaire", { method: "POST" });

    const saved = await state(
      await request("/onboarding/answers", {
        method: "PUT",
        ...json({ answers: { q1: "Often", q3: "  Training for a 10k  " } }),
      }),
    );
    expect(saved.answers).toEqual({ q1: "Often", q3: "Training for a 10k" });

    const cleared = await state(
      await request("/onboarding/answers", { method: "PUT", ...json({ answers: { q3: null } }) }),
    );
    expect(cleared.answers).toEqual({ q1: "Often" });

    for (const bad of [{ q1: "Always" }, { q2: 9 }, { q99: "x" }]) {
      const res = await request("/onboarding/answers", {
        method: "PUT",
        ...json({ answers: bad }),
      });
      expect(res.status).toBe(400);
    }
  });

  it("requires every non-text answer before submitting", async () => {
    const { request } = await toQuestionnaireStage();
    await request("/onboarding/questionnaire", { method: "POST" });
    await request("/onboarding/answers", { method: "PUT", ...json({ answers: { q1: "Never" } }) });

    const early = await request("/onboarding/questionnaire/submit", { method: "POST" });
    expect(early.status).toBe(400);

    await request("/onboarding/answers", { method: "PUT", ...json({ answers: { q2: 3 } }) });
    const submitted = await state(
      await request("/onboarding/questionnaire/submit", { method: "POST" }),
    );
    expect(submitted.stage).toBe("followup");

    const lateEdit = await request("/onboarding/answers", {
      method: "PUT",
      ...json({ answers: { q1: "Often" } }),
    });
    expect(lateEdit.status).toBe(409);
  });
});

describe("follow-up chat", () => {
  async function toFollowup(replies: { reply: string; done: boolean }[]) {
    const t = await toQuestionnaireStage(replies.map((r) => jsonResult(r)));
    await t.request("/onboarding/questionnaire", { method: "POST" });
    await t.request("/onboarding/answers", {
      method: "PUT",
      ...json({ answers: { q1: "Sometimes", q2: 2 } }),
    });
    await t.request("/onboarding/questionnaire/submit", { method: "POST" });
    return t;
  }

  it("opens, continues with context, and finishes when the model is done", async () => {
    const { request, model } = await toFollowup([
      { reply: "What kind of cardio do you do?", done: false },
      { reply: "Thanks, that's everything.", done: true },
    ]);

    const opened = await state(await request("/onboarding/followup", { method: "POST" }));
    expect(opened.chat).toEqual([{ role: "assistant", content: "What kind of cardio do you do?" }]);
    expect(opened.stage).toBe("followup");

    const contextPrompt = JSON.stringify(model.doGenerateCalls[1]!.prompt);
    expect(contextPrompt).toContain("A: Sometimes");
    expect(contextPrompt).toContain("A: 2 days/week");

    const finished = await state(
      await request("/onboarding/followup", { method: "POST", ...json({ message: "Running" }) }),
    );
    expect(finished.chat.map((m) => m.role)).toEqual(["assistant", "user", "assistant"]);
    expect(finished.stage).toBe("rating");
  });

  it("enforces turn order", async () => {
    const { request } = await toFollowup([{ reply: "Q?", done: false }]);
    const tooEarly = await request("/onboarding/followup", {
      method: "POST",
      ...json({ message: "hi" }),
    });
    expect(tooEarly.status).toBe(400);
    await request("/onboarding/followup", { method: "POST" });
    const missing = await request("/onboarding/followup", { method: "POST" });
    expect(missing.status).toBe(400);
  });

  it("stops after the turn limit even if the model keeps asking", async () => {
    const asks = Array.from({ length: 5 }, (_, i) => ({ reply: `Q${i}?`, done: false }));
    const { request } = await toFollowup(asks);
    let current = await state(await request("/onboarding/followup", { method: "POST" }));
    while (current.stage === "followup") {
      current = await state(
        await request("/onboarding/followup", { method: "POST", ...json({ message: "ok" }) }),
      );
    }
    expect(current.chat.filter((m) => m.role === "assistant")).toHaveLength(5);
    expect(current.stage).toBe("rating");
  });

  it("can be skipped, and saves nothing when the LLM fails", async () => {
    const bad = jsonResult({ nope: true });
    const t = await toQuestionnaireStage([bad, bad, bad]);
    await t.request("/onboarding/questionnaire", { method: "POST" });
    await t.request("/onboarding/answers", {
      method: "PUT",
      ...json({ answers: { q1: "Often", q2: 4 } }),
    });
    await t.request("/onboarding/questionnaire/submit", { method: "POST" });

    const failed = await t.request("/onboarding/followup", { method: "POST" });
    expect(failed.status).toBe(502);
    const after = await state(await t.request("/onboarding"));
    expect(after.chat).toEqual([]);
    expect(await t.db.select().from(llmCalls)).toHaveLength(4); // 1 questionnaire + 3 failures

    const skipped = await state(await t.request("/onboarding/followup/finish", { method: "POST" }));
    expect(skipped.stage).toBe("rating");
  });
});
