import { describe, expect, it } from "vitest";
import { mergeDayPrompts, type CustomPromptDto, type GuidedPromptDto } from "./recaps";

const grateful: CustomPromptDto = { id: "g", question: "What are you grateful for?", days: [0] };
const scout: GuidedPromptDto = { question: "How did the run feel?", answer: null };

describe("mergeDayPrompts", () => {
  it("adds scheduled own questions after the scout's, once", () => {
    const merged = mergeDayPrompts([scout], [grateful]);
    expect(merged).toEqual([scout, { question: grateful.question, answer: null, promptId: "g" }]);
    expect(mergeDayPrompts(merged, [grateful])).toEqual(merged);
  });

  it("keeps answers, follows edits to unanswered ones, and drops removed ones", () => {
    const saved = { question: "Old wording", answer: null, promptId: "g" };
    expect(mergeDayPrompts([saved], [grateful])[0]!.question).toBe(grateful.question);
    // Deleted or no longer scheduled that day: gone unless answered.
    expect(mergeDayPrompts([scout, saved], [])).toEqual([scout]);
    const answered = { ...saved, answer: "Family" };
    expect(mergeDayPrompts([answered], [])).toEqual([answered]);
    expect(mergeDayPrompts([answered], [grateful])).toEqual([answered]);
  });
});
