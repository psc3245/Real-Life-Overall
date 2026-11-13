import { describe, expect, it } from "vitest";
import { cardioLine, formatPace, paceSeconds } from "./cardio";

describe("cardio", () => {
  it("shows pace per mile or km, and speed for rides", () => {
    // 5 km in 25:00.
    expect(paceSeconds(5000, 1500, "metric")).toBe(300);
    expect(formatPace("running", 5000, 1500, "metric")).toBe("5:00 /km");
    expect(formatPace("running", 5000, 1500, "imperial")).toBe("8:03 /mi");
    expect(formatPace("cycling", 20_000, 3600, "metric")).toBe("20 km/h");
    expect(formatPace("running", null, 1500, "metric")).toBeNull();
  });

  it("describes a session in one line", () => {
    expect(
      cardioLine(
        "running",
        5000,
        1500,
        { avgHeartRate: 150, calories: 320, elevationM: null, effort: 7 },
        "metric",
      ),
    ).toBe("5 km in 25:00 (5:00 /km) · avg HR 150 · 320 cal · effort 7/10");
    expect(cardioLine("elliptical", null, 1800, null, "imperial")).toBe("30:00");
  });
});
