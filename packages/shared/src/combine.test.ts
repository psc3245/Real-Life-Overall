import { describe, expect, it } from "vitest";
import {
  buildCombineQuestionnaire,
  combineArchetype,
  combineDecay,
  COMBINE_QUESTIONS,
  scoreCombine,
} from "./combine";
import { CATEGORY_TEMPLATES } from "./templates";

const cardio = { id: "n1", name: "Cardio", templateKey: "fitness.cardio" };
const chess = { id: "n2", name: "Chess", templateKey: null };

describe("the Combine", () => {
  it("has questions for every template attribute, options least to most", () => {
    for (const category of CATEGORY_TEMPLATES) {
      for (const attribute of category.attributes) {
        const questions = COMBINE_QUESTIONS[attribute.key];
        expect(questions, attribute.key).toBeDefined();
        for (const q of questions!) {
          const scores = q.options.map(([, s]) => s);
          expect(scores, q.prompt).toEqual([...scores].sort((a, b) => a - b));
          expect(Math.min(...scores)).toBeGreaterThanOrEqual(20);
          expect(Math.max(...scores)).toBeLessThanOrEqual(95);
        }
      }
    }
  });

  it("writes tailored questions for templates and generic ones for custom attributes", () => {
    const questions = buildCombineQuestionnaire([cardio, chess]);
    expect(questions.filter((q) => q.nodeIds[0] === "n1")).toHaveLength(2);
    const generic = questions.filter((q) => q.nodeIds[0] === "n2");
    expect(generic).toHaveLength(3);
    expect(generic[0]!.prompt).toContain("Chess");
    expect(questions.every((q) => q.type === "single_choice")).toBe(true);
  });

  it("scores the weighted mean of answers, and 50 with nothing answered", () => {
    const questionnaire = buildCombineQuestionnaire([cardio, chess]);
    const [q1, q2, g1, g2, g3] = questionnaire;
    expect(q1!.id).toBe("c1");
    const ratings = scoreCombine([cardio, chess], questionnaire, {
      [q1!.id]: "4-5", // 75
      [q2!.id]: "About 5k", // 62
      [g1!.id]: "12-14", // 85
      [g2!.id]: "About average", // 50
      [g3!.id]: "Improved a lot", // 64, half weight
    });
    expect(ratings[0]).toMatchObject({ nodeId: "n1", value: 68.5, confidence: "medium" });
    expect(ratings[0]!.rationale).toContain("About 5k");
    expect(ratings[1]).toMatchObject({ value: 66.8, confidence: "low" }); // (85+50+32)/2.5
    expect(scoreCombine([cardio], questionnaire, {})[0]).toMatchObject({ value: 50 });
  });

  it("picks decay by category and names an archetype", () => {
    expect(combineDecay("fitness.cardio", 70)).toEqual({ graceDays: 3, perDay: 0.25, floor: 55 });
    expect(combineDecay(null, 10).floor).toBe(0);
    const category = (name: string, templateKey: string | null, value: number) => ({
      name,
      templateKey,
      value,
    });
    expect(
      combineArchetype([category("Fitness", "fitness", 72), category("Mind", "mind", 61)]).name,
    ).toBe("Cerebral Athlete");
    expect(
      combineArchetype([category("Fitness", "fitness", 72), category("Mind", "mind", 71)]).name,
    ).toBe("Two-Way Athlete");
    expect(
      combineArchetype([category("A", null, 60), category("B", null, 61), category("C", null, 62)])
        .name,
    ).toBe("Balanced All-Rounder");
  });
});
