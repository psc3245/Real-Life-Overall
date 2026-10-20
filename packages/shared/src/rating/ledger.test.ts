import { describe, expect, it } from "vitest";
import { leafValuesFromEvents } from "./ledger";

describe("leafValuesFromEvents", () => {
  it("sums deltas per leaf, skipping voided events", () => {
    const values = leafValuesFromEvents([
      { nodeId: "a", delta: 70 },
      { nodeId: "a", delta: 1.25 },
      { nodeId: "a", delta: 5, voidedAt: "2026-10-20T00:00:00Z" },
      { nodeId: "b", delta: 40 },
      { nodeId: "b", delta: -0.333 },
    ]);
    expect(values.get("a")).toBe(71.25);
    expect(values.get("b")).toBe(39.67);
  });

  it("clamps to the rating scale", () => {
    const values = leafValuesFromEvents([
      { nodeId: "hi", delta: 99 },
      { nodeId: "hi", delta: 5 },
      { nodeId: "lo", delta: 2 },
      { nodeId: "lo", delta: -10 },
    ]);
    expect(values.get("hi")).toBe(100);
    expect(values.get("lo")).toBe(0);
  });
});
