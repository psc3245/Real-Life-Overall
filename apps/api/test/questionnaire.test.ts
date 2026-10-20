import { describe, expect, it } from "vitest";
import {
  normalizeQuestions,
  questionnaireSchemaFor,
  targetQuestionCount,
} from "../src/services/questionnaire";

const idByRef = new Map([
  ["n1", "cat"],
  ["n2", "leafA"],
  ["n3", "leafB"],
]);
const leaves = new Set(["leafA", "leafB"]);
const raw = (over: Record<string, unknown>) => ({
  refs: ["n2"],
  type: "short_text" as const,
  prompt: "Tell me more",
  options: [],
  min: null,
  max: null,
  minLabel: null,
  maxLabel: null,
  unit: null,
  ...over,
});

describe("normalizeQuestions", () => {
  it("maps refs to leaf ids, dropping parents and unknown refs", () => {
    const [q] = normalizeQuestions([raw({ refs: ["n1", "n2", " n3 ", "n9"] })], idByRef, leaves);
    expect(q!.nodeIds).toEqual(["leafA", "leafB"]);
  });

  it("drops questions that inform no leaf or have too few options", () => {
    const out = normalizeQuestions(
      [
        raw({ refs: ["n1"] }),
        raw({ type: "single_choice", options: ["Only", " ", "Only"] }),
        raw({ type: "multi_choice", options: ["A", "B"] }),
      ],
      idByRef,
      leaves,
    );
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ id: "q1", type: "multi_choice", options: ["A", "B"] });
  });

  it("repairs bad slider bounds and inverted number bounds", () => {
    const [slider, number] = normalizeQuestions(
      [
        raw({ type: "slider", min: 5, max: 5, minLabel: " Low ", maxLabel: "" }),
        raw({ type: "number", min: 10, max: 1, unit: "hours/week" }),
      ],
      idByRef,
      leaves,
    );
    expect(slider).toMatchObject({ min: 0, max: 10, minLabel: "Low", maxLabel: null });
    expect(number).toMatchObject({ min: null, max: null, unit: "hours/week" });
  });

  it("caps the questionnaire length", () => {
    const many = Array.from({ length: 60 }, () => raw({}));
    expect(normalizeQuestions(many, idByRef, leaves)).toHaveLength(40);
  });
});

describe("questionnaireSchemaFor", () => {
  it("fails when a leaf has no question, so the LLM client retries", () => {
    const schema = questionnaireSchemaFor(["n2", "n3"]);
    expect(schema.safeParse({ questions: [raw({ refs: ["n2"] })] }).success).toBe(false);
    expect(schema.safeParse({ questions: [raw({ refs: ["n2", "n3"] })] }).success).toBe(true);
  });
});

describe("targetQuestionCount", () => {
  it("scales with leaves within bounds", () => {
    expect(targetQuestionCount(1)).toBe(6);
    expect(targetQuestionCount(8)).toBe(16);
    expect(targetQuestionCount(30)).toBe(40);
  });
});
