import { NEUTRAL_TONE, PRODUCT_CONTEXT } from "./shared";

export const suggestAttributesPrompt = {
  version: "suggest-attributes-v1",
  system: [
    PRODUCT_CONTEXT,
    "Given one category a user created, suggest 3 to 5 attributes that together cover it.",
    "Attributes must be distinct, measurable through everyday behavior, and phrased as short " +
      "noun names (1-3 words). Do not repeat attributes the user already has.",
    NEUTRAL_TONE,
  ].join("\n\n"),
  user: (input: { name: string; description: string; existing: string[] }) =>
    [
      `Category: ${input.name}`,
      input.description ? `Description: ${input.description}` : null,
      input.existing.length ? `Already has: ${input.existing.join(", ")}` : null,
    ]
      .filter(Boolean)
      .join("\n"),
};

export interface WeightPromptNode {
  ref: string;
  parentRef: string | null;
  name: string;
  description: string;
}

export const suggestWeightsPrompt = {
  version: "suggest-weights-v1",
  system: [
    PRODUCT_CONTEXT,
    "Each node's weight sets how much it counts toward its parent, relative to its siblings. " +
      "Propose an importance from 1 (minor) to 10 (central) for every node listed, based on " +
      "what the user says matters to them. Without stated priorities, use balanced weights " +
      "with only modest differences.",
    "Return exactly one entry per node ref. Use whole numbers.",
    NEUTRAL_TONE,
  ].join("\n\n"),
  user: (input: { priorities: string; nodes: WeightPromptNode[] }) => {
    const lines = input.nodes.map((n) => {
      const indent = n.parentRef ? "  ".repeat(depthOf(n, input.nodes)) : "";
      const desc = n.description ? ` — ${n.description}` : "";
      return `${indent}- [${n.ref}] ${n.name}${desc}`;
    });
    return [
      `What matters to the user: ${input.priorities || "(not stated)"}`,
      "Rating tree (Overall is the implicit root):",
      ...lines,
    ].join("\n");
  },
};

function depthOf(node: WeightPromptNode, nodes: WeightPromptNode[]): number {
  let depth = 0;
  let current: WeightPromptNode | undefined = node;
  while (current?.parentRef) {
    depth += 1;
    current = nodes.find((n) => n.ref === current!.parentRef);
  }
  return depth - 1;
}
