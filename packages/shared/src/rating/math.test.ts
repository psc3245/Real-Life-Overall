import { describe, expect, it } from "vitest";
import { normalizeWeights, ratingTier } from "./math";

describe("ratingTier", () => {
  it.each([
    [0, "red"],
    [59.99, "red"],
    [60, "orange"],
    [79.9, "yellow"],
    [85, "green"],
    [90, "purple"],
  ] as const)("%d → %s", (value, tier) => {
    expect(ratingTier(value)).toBe(tier);
  });
});

describe("normalizeWeights", () => {
  it("scales to sum 1", () => {
    expect(normalizeWeights([1, 3])).toEqual([0.25, 0.75]);
  });
  it("falls back to equal weights", () => {
    expect(normalizeWeights([0, 0])).toEqual([0.5, 0.5]);
  });
});
