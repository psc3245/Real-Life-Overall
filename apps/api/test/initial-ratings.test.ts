import { describe, expect, it } from "vitest";
import { initialRatingsSchemaFor, normalizeInitialRatings } from "../src/services/initial-ratings";

const rating = (ref: string, over: Record<string, unknown> = {}) => ({
  ref,
  value: 62.37,
  confidence: "medium" as const,
  rationale: " You run twice a week. ",
  decayGraceDays: 4,
  decayPerDay: 0.3,
  decayFloor: 40,
  ...over,
});
const output = (ratings: ReturnType<typeof rating>[]) => ({
  ratings,
  archetype: { name: "Builder", description: "Builds things." },
  summary: "Solid.",
});
const idByRef = new Map([
  ["n1", "parent"],
  ["n2", "a"],
  ["n3", "b"],
]);

describe("initialRatingsSchemaFor", () => {
  const schema = initialRatingsSchemaFor(["n2", "n3"]);
  it("requires every rated attribute exactly once", () => {
    expect(schema.safeParse(output([rating("n2"), rating("n3")])).success).toBe(true);
    expect(schema.safeParse(output([rating("n2")])).success).toBe(false);
    expect(schema.safeParse(output([rating("n2"), rating("n2"), rating("n3")])).success).toBe(
      false,
    );
  });
});

describe("normalizeInitialRatings", () => {
  it("maps refs to leaves and rounds values", () => {
    const [r] = normalizeInitialRatings(output([rating("n2")]), idByRef, new Set(["a", "b"]));
    expect(r).toEqual({
      nodeId: "a",
      value: 62.4,
      confidence: "medium",
      rationale: "You run twice a week.",
      decay: { graceDays: 4, perDay: 0.3, floor: 40, notes: "" },
    });
  });

  it("clamps out-of-range numbers and keeps the floor below the value", () => {
    const [high, low] = normalizeInitialRatings(
      output([
        rating("n2", { value: 140, decayGraceDays: 90, decayPerDay: 5, decayFloor: 300 }),
        rating("n3", { value: -5, decayGraceDays: 0.2, decayPerDay: 0, decayFloor: -10 }),
      ]),
      idByRef,
      new Set(["a", "b"]),
    );
    expect(high).toMatchObject({ value: 100, decay: { graceDays: 30, perDay: 1, floor: 100 } });
    expect(low).toMatchObject({ value: 0, decay: { graceDays: 1, perDay: 0.05, floor: 0 } });
  });

  it("ignores parents, unknown refs and duplicates", () => {
    const out = normalizeInitialRatings(
      output([rating("n1"), rating("n9"), rating("n2"), rating("n2", { value: 10 })]),
      idByRef,
      new Set(["a", "b"]),
    );
    expect(out.map((r) => [r.nodeId, r.value])).toEqual([["a", 62.4]]);
  });
});
