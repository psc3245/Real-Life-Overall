import { CATEGORY_TEMPLATES, treeDraftSchema, type RatingNodeDto } from "@rlo/shared";
import { describe, expect, it } from "vitest";
import {
  addNode,
  addTemplate,
  childrenOf,
  depthOf,
  nodesToDraft,
  removeNode,
  updateNode,
  usedTemplateKeys,
} from "./draft";

const fitness = CATEGORY_TEMPLATES.find((t) => t.key === "fitness")!;

describe("draft helpers", () => {
  it("adds a template category with its attributes", () => {
    const draft = addTemplate([], fitness);
    const [category] = childrenOf(draft, null);
    expect(category).toMatchObject({ name: "Fitness", templateKey: "fitness" });
    expect(childrenOf(draft, category!.key).map((n) => n.name)).toEqual(
      fitness.attributes.map((a) => a.name),
    );
    expect(usedTemplateKeys(draft)).toEqual(new Set(["fitness"]));
    expect(treeDraftSchema.safeParse({ nodes: draft }).success).toBe(true);
  });

  it("computes depth and removes whole subtrees", () => {
    let draft = addNode([], null, { name: "Mind" });
    const mind = draft[0]!.key;
    draft = addNode(draft, mind, { name: "Focus" });
    const focus = draft[1]!.key;
    draft = addNode(draft, focus, { name: "Deep Work" });
    expect(depthOf(draft, draft[2]!.key)).toBe(3);

    draft = updateNode(draft, focus, { name: "Attention" });
    expect(draft[1]!.name).toBe("Attention");
    expect(removeNode(draft, focus).map((n) => n.name)).toEqual(["Mind"]);
  });

  it("round-trips server nodes, hiding the Overall root", () => {
    const nodes: RatingNodeDto[] = [
      {
        id: "r",
        parentId: null,
        name: "Overall",
        description: "",
        depth: 0,
        weight: 1,
        sortOrder: 0,
        templateKey: null,
      },
      {
        id: "c",
        parentId: "r",
        name: "Career",
        description: "",
        depth: 1,
        weight: 3,
        sortOrder: 0,
        templateKey: null,
      },
      {
        id: "s",
        parentId: "c",
        name: "Skills",
        description: "",
        depth: 2,
        weight: 1,
        sortOrder: 0,
        templateKey: null,
      },
    ];
    expect(nodesToDraft(nodes)).toMatchObject([
      { key: "c", parentKey: null, weight: 3 },
      { key: "s", parentKey: "c" },
    ]);
  });
});
