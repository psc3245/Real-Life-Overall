import { describe, expect, it } from "vitest";
import { refsFor, renderTree, toPromptNodes } from "../src/llm/prompts/tree";

const node = (id: string, parentId: string | null, name: string) => ({
  id,
  parentId,
  name,
  description: "",
});

describe("renderTree", () => {
  it("nests each node directly under its parent even when input is ordered by depth", () => {
    // Database order: all categories, then all attributes.
    const nodes = [
      node("root", null, "Overall"),
      node("fit", "root", "Fitness"),
      node("soc", "root", "Social"),
      node("cardio", "fit", "Cardio"),
      node("friends", "soc", "Friendships"),
    ];
    const { refById } = refsFor(nodes);
    expect(renderTree(toPromptNodes(nodes, refById), true)).toBe(
      [
        "- [n1] Fitness",
        "  - [n3] Cardio (rated attribute)",
        "- [n2] Social",
        "  - [n4] Friendships (rated attribute)",
      ].join("\n"),
    );
  });
});
