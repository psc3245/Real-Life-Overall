import { HABIT_TYPE_LABELS, type HabitType } from "@rlo/shared";
import { NEUTRAL_TONE, PRODUCT_CONTEXT } from "./shared";
import { renderTree, type PromptNode } from "./tree";

export const suggestLinksPrompt = {
  version: "suggest-links-v1",
  system: [
    PRODUCT_CONTEXT,
    "The user is adding a habit they will log daily. Pick the 1-3 rated attributes that this " +
      "habit most directly builds. Prefer fewer, stronger links over loose associations. Only " +
      "choose nodes marked (rated attribute).",
    NEUTRAL_TONE,
  ].join("\n\n"),
  user: (input: { name: string; type: HabitType; nodes: PromptNode[] }) =>
    [
      `Habit: ${input.name} (logged as: ${HABIT_TYPE_LABELS[input.type]})`,
      "Rating tree (Overall is the implicit root):",
      renderTree(input.nodes, true),
    ].join("\n"),
};
