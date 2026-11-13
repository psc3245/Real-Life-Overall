import { DEFAULT_PREFERENCES, SOULS_TALK, TALK } from "@rlo/shared";
import { describe, expect, it } from "vitest";
import { walkthroughSteps } from "./steps";

const all = DEFAULT_PREFERENCES.features;
const ids = (features = all) => walkthroughSteps(TALK.normal, features).map((s) => s.id);

describe("walkthroughSteps", () => {
  it("tour every main feature in nav order", () => {
    expect(ids()).toEqual([
      "welcome",
      "rating",
      "today",
      "log",
      "recap",
      "week",
      "plan",
      "coach",
      "social",
      "stats",
      "account",
    ]);
  });

  it("skip switched-off features and open a group on its first page still on", () => {
    const steps = walkthroughSteps(TALK.normal, {
      ...all,
      week: false,
      coach: false,
      friends: false,
      leaderboards: false,
      habits: false,
    });
    expect(steps.map((s) => s.id)).not.toContain("week");
    expect(steps.map((s) => s.id)).not.toContain("coach");
    expect(steps.map((s) => s.id)).not.toContain("social");
    expect(steps.find((s) => s.id === "plan")?.to).toBe("/goals");
  });

  it("use the player's words", () => {
    const plain = walkthroughSteps(TALK.none, all);
    expect(plain[0]!.title).toBe("The Tour");
    expect(plain.find((s) => s.id === "coach")?.title).toBe("Assistant");
    const souls = walkthroughSteps(SOULS_TALK, all);
    expect(souls.find((s) => s.id === "recap")?.title).toBe("Rest");
  });
});
