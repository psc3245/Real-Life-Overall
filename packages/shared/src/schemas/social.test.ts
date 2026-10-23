import { describe, expect, it } from "vitest";
import { alignCategories, usernameSchema } from "./social";

const cat = (name: string, value: number, templateKey: string | null = null) => ({
  name,
  value,
  templateKey,
});

describe("alignCategories", () => {
  it("matches templates by key and custom categories by name", () => {
    const rows = alignCategories(
      [cat("Fitness", 70, "fitness"), cat("Music", 60), cat("Career", 80, "career")],
      [
        cat("Career", 75, "career"),
        cat("Training", 65, "fitness"),
        cat("music ", 50),
        cat("Faith", 40),
      ],
    );
    expect(rows).toEqual([
      { name: "Fitness", mine: 70, theirs: 65 }, // renamed template still matches
      { name: "Music", mine: 60, theirs: 50 },
      { name: "Career", mine: 80, theirs: 75 },
      { name: "Faith", mine: null, theirs: 40 },
    ]);
  });

  it("keeps unmatched categories on their own side", () => {
    expect(alignCategories([cat("Mind", 55, "mind")], [cat("Social", 45, "social")])).toEqual([
      { name: "Mind", mine: 55, theirs: null },
      { name: "Social", mine: null, theirs: 45 },
    ]);
  });
});

describe("usernameSchema", () => {
  it("normalizes case and rejects reserved or malformed names", () => {
    expect(usernameSchema.parse(" Jordan_R ")).toBe("jordan_r");
    for (const bad of ["me", "settings", "ab", "a b", "_lead", "x".repeat(25)]) {
      expect(usernameSchema.safeParse(bad).success, bad).toBe(false);
    }
  });
});
