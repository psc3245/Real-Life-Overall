import { describe, expect, it } from "vitest";
import { computeNodeValues } from "./tree";
import { growthDelta, growthTier, leafGrowthFromEvents, leafScoresFromEvents } from "./growth";

describe("growthDelta", () => {
  it("counts recap gains and weekly corrections, nothing else", () => {
    expect(growthDelta({ source: "daily_recap", delta: 1.5 })).toBe(1.5);
    expect(growthDelta({ source: "daily_recap", delta: -1 })).toBe(0);
    expect(growthDelta({ source: "weekly_review", delta: -2 })).toBe(-2);
    expect(growthDelta({ source: "weekly_review", delta: 1 })).toBe(1);
    expect(growthDelta({ source: "decay", delta: -0.5 })).toBe(0);
    expect(growthDelta({ source: "onboarding", delta: 70 })).toBe(0);
    expect(growthDelta({ source: "recalibration", delta: 70 })).toBe(0);
  });
});

describe("leafGrowthFromEvents", () => {
  it("sums gains only, takes back corrections, floors at zero", () => {
    const growth = leafGrowthFromEvents([
      { nodeId: "a", source: "onboarding", delta: 70 },
      { nodeId: "a", source: "daily_recap", delta: 1.5 },
      { nodeId: "a", source: "decay", delta: -0.5 },
      { nodeId: "a", source: "daily_recap", delta: 2 },
      { nodeId: "a", source: "daily_recap", delta: 3, voidedAt: "2026-10-20T00:00:00Z" },
      { nodeId: "b", source: "onboarding", delta: 40 },
      { nodeId: "b", source: "daily_recap", delta: 1 },
      { nodeId: "b", source: "weekly_review", delta: -3 },
      { nodeId: "c", source: "recalibration", delta: 55 },
    ]);
    expect(growth.get("a")).toBe(3.5);
    expect(growth.get("b")).toBe(0);
    expect(growth.get("c")).toBe(0);
  });

  it("averages over every rated leaf when rolled up", () => {
    const nodes = [
      { id: "root", parentId: null, depth: 0, weight: 1 },
      { id: "x", parentId: "root", depth: 1, weight: 1 },
      { id: "y", parentId: "root", depth: 1, weight: 1 },
    ];
    const leaves = leafScoresFromEvents("growth", [
      { nodeId: "x", source: "onboarding", delta: 50 },
      { nodeId: "x", source: "daily_recap", delta: 4 },
      { nodeId: "y", source: "onboarding", delta: 80 },
    ]);
    expect(computeNodeValues(nodes, leaves).get("root")).toBe(2);
  });
});

describe("growthTier", () => {
  it("climbs with season-sized thresholds", () => {
    expect(growthTier(0)).toBe("red");
    expect(growthTier(4)).toBe("orange");
    expect(growthTier(25)).toBe("purple");
  });
});
