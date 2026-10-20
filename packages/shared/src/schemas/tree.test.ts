import { describe, expect, it } from "vitest";
import { treeDraftSchema } from "./tree";

const base = [
  { key: "fit", parentKey: null, name: "Fitness" },
  { key: "cardio", parentKey: "fit", name: "Cardio" },
];

describe("treeDraftSchema", () => {
  it("accepts a two-level tree and applies defaults", () => {
    const parsed = treeDraftSchema.parse({ nodes: base });
    expect(parsed.nodes[0]).toMatchObject({ weight: 1, description: "", templateKey: null });
  });

  it("allows three levels below Overall but not four", () => {
    const three = [...base, { key: "c1", parentKey: "cardio", name: "Running" }];
    expect(treeDraftSchema.safeParse({ nodes: three }).success).toBe(true);
    const four = [...three, { key: "c2", parentKey: "c1", name: "Sprints" }];
    const result = treeDraftSchema.safeParse({ nodes: four });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toMatch(/deeper than 3/);
  });

  it("rejects cycles, unknown parents and reserved keys", () => {
    const cycle = [
      { key: "a", parentKey: "b", name: "A" },
      { key: "b", parentKey: "a", name: "B" },
    ];
    expect(treeDraftSchema.safeParse({ nodes: cycle }).error?.issues[0]?.message).toMatch(/cycle/);
    const orphan = [...base, { key: "x", parentKey: "missing", name: "X" }];
    expect(treeDraftSchema.safeParse({ nodes: orphan }).error?.issues[0]?.message).toMatch(
      /unknown parent/,
    );
    const reserved = [{ key: "__overall__", parentKey: null, name: "O" }];
    expect(treeDraftSchema.safeParse({ nodes: reserved }).success).toBe(false);
  });

  it("rejects blank names", () => {
    const blank = [{ key: "a", parentKey: null, name: "   " }];
    expect(treeDraftSchema.safeParse({ nodes: blank }).success).toBe(false);
  });
});
