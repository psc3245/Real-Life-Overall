import type { OnboardingStateDto, WeightSuggestionDto } from "@rlo/shared";
import { describe, expect, it } from "vitest";
import { onboardingSessions, ratingNodes } from "../src/db/schema";
import { createTestApp, jsonResult } from "./helpers";

const tree = {
  nodes: [
    { key: "fit", parentKey: null, name: "Fitness", templateKey: "fitness" },
    { key: "cardio", parentKey: "fit", name: "Cardio" },
    { key: "strength", parentKey: "fit", name: "Strength" },
    { key: "upper", parentKey: "strength", name: "Upper Body" },
    { key: "career", parentKey: null, name: "Career" },
  ],
};

const json = (body: unknown) => ({ body: JSON.stringify(body) });

describe("onboarding", () => {
  it("starts in discovery with a current-quarter season", async () => {
    const { request } = await createTestApp();
    const res = await request("/onboarding");
    const state = (await res.json()) as OnboardingStateDto;
    expect(state.stage).toBe("discovery");
    expect(state.discovery).toEqual({ messages: [], done: false });
    expect(state.season.label).toMatch(/^\d{4}-Q[1-4]$/);
    expect(state.season.status).toBe("setup");
    expect(state.nodes).toEqual([]);
  });

  it("saves a tree with an Overall root and computed depths", async () => {
    const { request } = await createTestApp();
    const res = await request("/onboarding/tree", { method: "PUT", ...json(tree) });
    expect(res.status).toBe(200);
    const state = (await res.json()) as OnboardingStateDto;

    expect(state.stage).toBe("weights");
    const byName = new Map(state.nodes.map((n) => [n.name, n]));
    const root = byName.get("Overall")!;
    expect(root).toMatchObject({ parentId: null, depth: 0 });
    expect(byName.get("Fitness")).toMatchObject({
      parentId: root.id,
      depth: 1,
      templateKey: "fitness",
    });
    expect(byName.get("Upper Body")).toMatchObject({
      parentId: byName.get("Strength")!.id,
      depth: 3,
    });
  });

  it("replaces the tree on re-save", async () => {
    const { request, db } = await createTestApp();
    await request("/onboarding/tree", { method: "PUT", ...json(tree) });
    await request("/onboarding/tree", {
      method: "PUT",
      ...json({ nodes: [{ key: "mind", parentKey: null, name: "Mind" }] }),
    });
    const names = (await db.select().from(ratingNodes)).map((n) => n.name).sort();
    expect(names).toEqual(["Mind", "Overall"]);
  });

  it("rejects trees deeper than three levels", async () => {
    const { request } = await createTestApp();
    const deep = {
      nodes: [...tree.nodes, { key: "grip", parentKey: "upper", name: "Grip" }],
    };
    const res = await request("/onboarding/tree", { method: "PUT", ...json(deep) });
    expect(res.status).toBe(400);
  });

  it("keeps each user's onboarding separate", async () => {
    const { request } = await createTestApp();
    await request("/onboarding/tree", { method: "PUT", ...json(tree), user: "alice" });
    const bob = (await (
      await request("/onboarding", { user: "bob" })
    ).json()) as OnboardingStateDto;
    expect(bob.nodes).toEqual([]);
  });

  it("suggests weights from the LLM, mapping refs back to node ids", async () => {
    const { request, model } = await createTestApp({
      // Nodes are listed by depth then order: Fitness, Career, Cardio, Strength, Upper Body.
      doGenerate: jsonResult({
        weights: [
          { ref: "n1", importance: 9 },
          { ref: "n2", importance: 4.4 },
          { ref: "n3", importance: 42 },
          { ref: "bogus", importance: 1 },
        ],
        rationale: "Fitness is the stated focus.",
      }),
    });
    await request("/onboarding/tree", { method: "PUT", ...json(tree) });
    const res = await request("/onboarding/weights/suggest", {
      method: "POST",
      ...json({ priorities: "Getting in shape this year" }),
    });
    expect(res.status).toBe(200);
    const suggestion = (await res.json()) as WeightSuggestionDto;
    const state = (await (await request("/onboarding")).json()) as OnboardingStateDto;
    const weightOf = (name: string) =>
      suggestion.weights.find((w) => w.nodeId === state.nodes.find((n) => n.name === name)!.id)
        ?.weight;

    expect(weightOf("Fitness")).toBe(9);
    expect(weightOf("Career")).toBe(4);
    expect(weightOf("Cardio")).toBe(10); // clamped
    expect(weightOf("Strength")).toBe(5); // missing → default
    expect(suggestion.rationale).toBe("Fitness is the stated focus.");
    expect(state.priorities).toBe("Getting in shape this year");
    expect(state.weightRationale).toBe("Fitness is the stated focus.");

    const prompt = JSON.stringify(model.doGenerateCalls[0]!.prompt);
    expect(prompt).toContain("Getting in shape this year");
    expect(prompt).toContain("[n4] Strength");
  });

  it("saves weights and locks the structure once the questionnaire exists", async () => {
    const { request, db } = await createTestApp();
    const state = (await (
      await request("/onboarding/tree", { method: "PUT", ...json(tree) })
    ).json()) as OnboardingStateDto;
    const fitness = state.nodes.find((n) => n.name === "Fitness")!;

    const saved = await request("/onboarding/weights", {
      method: "PUT",
      ...json({ weights: [{ nodeId: fitness.id, weight: 8 }] }),
    });
    const after = (await saved.json()) as OnboardingStateDto;
    expect(after.stage).toBe("questionnaire");
    expect(after.nodes.find((n) => n.id === fitness.id)!.weight).toBe(8);

    // Still editable until a questionnaire is generated.
    const reEdit = await request("/onboarding/tree", { method: "PUT", ...json(tree) });
    expect(reEdit.status).toBe(200);

    await db.update(onboardingSessions).set({ stage: "questionnaire", questionnaire: [] });
    const locked = await request("/onboarding/tree", { method: "PUT", ...json(tree) });
    expect(locked.status).toBe(409);
  });

  it("rejects weights for nodes outside the user's tree", async () => {
    const { request } = await createTestApp();
    await request("/onboarding/tree", { method: "PUT", ...json(tree) });
    const res = await request("/onboarding/weights", {
      method: "PUT",
      ...json({ weights: [{ nodeId: crypto.randomUUID(), weight: 3 }] }),
    });
    expect(res.status).toBe(400);
  });

  it("suggests attributes, dropping ones the user already has", async () => {
    const { request } = await createTestApp({
      doGenerate: jsonResult({
        attributes: [
          { name: "Cardio", description: "dup" },
          { name: "Mobility", description: "Range of motion" },
        ],
      }),
    });
    const res = await request("/onboarding/attributes/suggest", {
      method: "POST",
      ...json({ name: "Fitness", existing: ["cardio"] }),
    });
    expect(await res.json()).toEqual([{ name: "Mobility", description: "Range of motion" }]);
  });

  it("returns 502 with a clear message when the LLM keeps failing", async () => {
    const bad = jsonResult({ nope: true });
    const { request } = await createTestApp({ doGenerate: [bad, bad, bad] });
    const res = await request("/onboarding/attributes/suggest", {
      method: "POST",
      ...json({ name: "Fitness" }),
    });
    expect(res.status).toBe(502);
    expect(await res.json()).toMatchObject({ retryable: true });
  });
});
