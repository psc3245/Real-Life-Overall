import { MAX_DISCOVERY_TURNS, type OnboardingStateDto } from "@rlo/shared";
import { describe, expect, it } from "vitest";
import { templateToDraft } from "../src/services/template";
import { json } from "./flows";
import { createTestApp, jsonResult } from "./helpers";

const state = async (res: Response) => (await res.json()) as OnboardingStateDto;
const ask = (reply: string, done = false) => jsonResult({ reply, done });
const leaf = (name: string, weight = 5) => ({
  name,
  description: `${name}.`,
  weight,
  subAttributes: [],
});

const template = jsonResult({
  categories: [
    {
      name: "Fitness",
      description: "Training for a half marathon.",
      weight: 8,
      templateKey: "fitness",
      attributes: [
        leaf("Endurance", 9),
        { ...leaf("Strength", 4), subAttributes: [leaf("Upper Body"), leaf("Lower Body")] },
      ],
    },
    {
      name: "Craft",
      description: "Getting better at software engineering.",
      weight: 9,
      templateKey: "not-a-template",
      attributes: [leaf("Skills", 7), leaf("Shipping", 6)],
    },
  ],
  rationale: "Fitness and craft came up most, so they lead.",
  priorities: "Half marathon in spring; promotion to senior engineer.",
});

describe("templateToDraft", () => {
  it("nests, clamps weights, dedupes and drops unknown template keys", () => {
    const draft = templateToDraft({
      categories: [
        {
          name: "  Fitness ",
          description: "d",
          weight: 42,
          templateKey: "fitness",
          attributes: [
            leaf("Cardio", 0),
            leaf("cardio"),
            { ...leaf("Strength"), subAttributes: [leaf("Legs")] },
          ],
        },
        {
          name: "Mind",
          description: "d",
          weight: 5,
          templateKey: "bogus",
          attributes: [leaf("Focus")],
        },
        { name: "fitness", description: "dup", weight: 5, templateKey: null, attributes: [] },
      ],
      rationale: "r",
      priorities: "p",
    });
    expect(draft.map((n) => [n.name, n.parentKey === null, n.weight, n.templateKey])).toEqual([
      ["Fitness", true, 10, "fitness"],
      ["Cardio", false, 1, null],
      ["Strength", false, 5, null],
      ["Legs", false, 5, null],
      ["Mind", true, 5, null],
      ["Focus", false, 5, null],
    ]);
  });
});

describe("discovery onboarding", () => {
  it("chats, then drafts an editable tree with weights from the conversation", async () => {
    const { request, model } = await createTestApp({
      doGenerate: [
        ask("Hi! What do you want the next few months to look like?"),
        ask("What does a good week look like for your training?"),
        ask("Thanks, I'll draft your rating tree.", true),
        template,
      ],
    });
    const opened = await state(await request("/onboarding/discovery", { method: "POST" }));
    expect(opened.discovery.messages).toEqual([
      { role: "assistant", content: "Hi! What do you want the next few months to look like?" },
    ]);
    expect((await request("/onboarding/template", { method: "POST" })).status).toBe(400); // too early

    await request("/onboarding/discovery", {
      method: "POST",
      ...json({ message: "Run a half marathon and get promoted." }),
    });
    const done = await state(
      await request("/onboarding/discovery", {
        method: "POST",
        ...json({ message: "Three runs and two lifts." }),
      }),
    );
    expect(done.discovery.done).toBe(true);
    expect(done.stage).toBe("discovery");

    const drafted = await state(await request("/onboarding/template", { method: "POST" }));
    expect(drafted.stage).toBe("tree");
    expect(drafted.priorities).toBe("Half marathon in spring; promotion to senior engineer.");
    expect(drafted.templateRationale).toBe("Fitness and craft came up most, so they lead.");
    const byName = new Map(drafted.nodes.map((n) => [n.name, n]));
    expect(byName.get("Craft")).toMatchObject({ depth: 1, weight: 9, templateKey: null });
    expect(byName.get("Endurance")).toMatchObject({ depth: 2, weight: 9 });
    expect(byName.get("Upper Body")).toMatchObject({
      depth: 3,
      parentId: byName.get("Strength")!.id,
    });

    const prompt = JSON.stringify(model.doGenerateCalls.at(-1)!.prompt);
    expect(prompt).toContain("User: Run a half marathon and get promoted.");
    expect(prompt).toContain("- fitness: Fitness — Cardio, Strength, Mobility, Athleticism");

    // Drafting is one-shot; the user edits the tree from here.
    expect((await request("/onboarding/template", { method: "POST" })).status).toBe(409);
    const edited = await request("/onboarding/tree", {
      method: "PUT",
      ...json({ nodes: [{ key: "a", parentKey: null, name: "Fitness" }] }),
    });
    expect((await state(edited)).stage).toBe("weights");
  });

  it("enforces turn order and wraps up at the turn limit", async () => {
    const asks = Array.from({ length: MAX_DISCOVERY_TURNS }, (_, i) => ask(`Q${i}?`));
    const { request } = await createTestApp({ doGenerate: asks });
    expect(
      (await request("/onboarding/discovery", { method: "POST", ...json({ message: "hi" }) }))
        .status,
    ).toBe(400);
    let s = await state(await request("/onboarding/discovery", { method: "POST" }));
    expect((await request("/onboarding/discovery", { method: "POST" })).status).toBe(400);
    while (!s.discovery.done) {
      s = await state(
        await request("/onboarding/discovery", { method: "POST", ...json({ message: "ok" }) }),
      );
    }
    expect(s.discovery.messages.filter((m) => m.role === "assistant")).toHaveLength(
      MAX_DISCOVERY_TURNS,
    );
  });

  it("can be skipped to build the tree by hand", async () => {
    const { request } = await createTestApp();
    const skipped = await state(await request("/onboarding/discovery/skip", { method: "POST" }));
    expect(skipped.stage).toBe("tree");
    expect((await request("/onboarding/discovery", { method: "POST" })).status).toBe(409);
  });
});
