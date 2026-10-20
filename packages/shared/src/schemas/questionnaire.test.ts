import { describe, expect, it } from "vitest";
import { unansweredRequired, validateAnswer, type QuestionDto } from "./questionnaire";

const base: Omit<QuestionDto, "type"> = {
  id: "q1",
  nodeIds: ["n"],
  prompt: "?",
  options: ["Never", "Sometimes", "Often"],
  min: 0,
  max: 10,
  minLabel: null,
  maxLabel: null,
  unit: null,
};
const q = (type: QuestionDto["type"], extra: Partial<QuestionDto> = {}): QuestionDto => ({
  ...base,
  type,
  ...extra,
});

describe("validateAnswer", () => {
  it("checks choice answers against options", () => {
    expect(validateAnswer(q("single_choice"), "Often")).toBeNull();
    expect(validateAnswer(q("single_choice"), "Always")).not.toBeNull();
    expect(validateAnswer(q("multi_choice"), ["Never", "Often"])).toBeNull();
    expect(validateAnswer(q("multi_choice"), ["Never", "Never"])).not.toBeNull();
    expect(validateAnswer(q("multi_choice"), [])).toBeNull();
  });

  it("checks numeric bounds", () => {
    expect(validateAnswer(q("slider"), 7)).toBeNull();
    expect(validateAnswer(q("slider"), 11)).toMatch(/at most 10/);
    expect(validateAnswer(q("number", { min: null, max: null }), -3)).toBeNull();
    expect(validateAnswer(q("number"), Number.NaN)).not.toBeNull();
    expect(validateAnswer(q("number"), "5")).not.toBeNull();
  });

  it("caps text length", () => {
    expect(validateAnswer(q("short_text"), "hi")).toBeNull();
    expect(validateAnswer(q("short_text"), "x".repeat(501))).not.toBeNull();
  });
});

describe("unansweredRequired", () => {
  it("ignores optional short-text questions", () => {
    const questions = [q("slider", { id: "a" }), q("short_text", { id: "b" })];
    expect(unansweredRequired(questions, {}).map((x) => x.id)).toEqual(["a"]);
    expect(unansweredRequired(questions, { a: 3 })).toEqual([]);
  });
});
