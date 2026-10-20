import { describe, expect, it } from "vitest";
import { buildTree, computeNodeValues, leafIds, validateTreeStructure } from "./tree";

const nodes = [
  { id: "ovr", parentId: null, depth: 0, weight: 1 },
  { id: "fit", parentId: "ovr", depth: 1, weight: 3, sortOrder: 1 },
  { id: "car", parentId: "ovr", depth: 1, weight: 1, sortOrder: 0 },
  { id: "cardio", parentId: "fit", depth: 2, weight: 1 },
  { id: "strength", parentId: "fit", depth: 2, weight: 1 },
  { id: "upper", parentId: "strength", depth: 3, weight: 1 },
  { id: "lower", parentId: "strength", depth: 3, weight: 3 },
];

describe("validateTreeStructure", () => {
  it("accepts a valid tree", () => {
    expect(validateTreeStructure(nodes)).toEqual([]);
  });

  it("rejects nodes deeper than the max depth", () => {
    const deep = [...nodes, { id: "x", parentId: "upper", depth: 4, weight: 1 }];
    expect(validateTreeStructure(deep).join()).toMatch(/deeper than 3/);
  });

  it("rejects multiple roots, unknown parents and bad weights", () => {
    const bad = [
      ...nodes,
      { id: "r2", parentId: null, depth: 0, weight: 1 },
      { id: "orphan", parentId: "nope", depth: 1, weight: 1 },
      { id: "zero", parentId: "ovr", depth: 1, weight: 0 },
    ];
    const errors = validateTreeStructure(bad).join("\n");
    expect(errors).toMatch(/exactly one root/);
    expect(errors).toMatch(/unknown parent/);
    expect(errors).toMatch(/positive weight/);
  });
});

describe("buildTree", () => {
  it("nests children in sort order", () => {
    const root = buildTree(nodes);
    expect(root.children.map((c) => c.id)).toEqual(["car", "fit"]);
  });
});

describe("leafIds", () => {
  it("returns only childless, non-root, active nodes", () => {
    expect(leafIds(nodes).sort()).toEqual(["car", "cardio", "lower", "upper"]);
  });
});

describe("computeNodeValues", () => {
  it("rolls weighted means up the tree", () => {
    const values = computeNodeValues(
      nodes,
      new Map([
        ["car", 60],
        ["cardio", 80],
        ["upper", 40],
        ["lower", 80],
      ]),
    );
    expect(values.get("strength")).toBe(70); // (40*1 + 80*3) / 4
    expect(values.get("fit")).toBe(75); // (80 + 70) / 2
    expect(values.get("ovr")).toBe(71.25); // (75*3 + 60*1) / 4
  });

  it("ignores archived children and unvalued leaves", () => {
    const withArchived = nodes.map((n) => (n.id === "car" ? { ...n, archived: true } : n));
    const values = computeNodeValues(withArchived, new Map([["cardio", 50]]));
    expect(values.get("fit")).toBe(50);
    expect(values.get("ovr")).toBe(50);
    expect(values.has("strength")).toBe(false);
  });
});
