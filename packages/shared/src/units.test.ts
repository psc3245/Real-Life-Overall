import { describe, expect, it } from "vitest";
import {
  bmi,
  formatDuration,
  formatHeight,
  fromDisplayWeight,
  parseDuration,
  toDisplayDistance,
  toDisplayWeight,
} from "./units";

describe("units", () => {
  it("round-trips weights in either system", () => {
    expect(toDisplayWeight(fromDisplayWeight(135, "imperial"), "imperial")).toBe(135);
    expect(toDisplayWeight(100, "metric")).toBe(100);
    expect(toDisplayDistance(5000, "imperial")).toBe(3.11);
  });

  it("formats heights, durations and BMI", () => {
    expect(formatHeight(180.34, "imperial")).toBe("5′11″");
    expect(formatHeight(180.34, "metric")).toBe("180 cm");
    expect(formatDuration(95)).toBe("1:35");
    expect(formatDuration(3725)).toBe("1:02:05");
    expect(bmi(80, 180)).toBe(24.7);
  });

  it("parses m:ss, h:mm:ss and plain minutes", () => {
    expect(parseDuration("1:30")).toBe(90);
    expect(parseDuration("1:00:00")).toBe(3600);
    expect(parseDuration("25")).toBe(1500);
    expect(parseDuration("0:45")).toBe(45);
    expect(parseDuration("abc")).toBeNull();
    expect(parseDuration("")).toBeNull();
  });
});
