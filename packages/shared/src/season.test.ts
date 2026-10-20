import { describe, expect, it } from "vitest";
import { isValidTimeZone, localDateIn, seasonForDate } from "./season";

describe("seasonForDate", () => {
  it("maps dates to calendar quarters", () => {
    expect(seasonForDate("2026-10-20")).toEqual({
      label: "2026-Q4",
      startsOn: "2026-10-01",
      endsOn: "2026-12-31",
    });
    expect(seasonForDate("2028-02-29").endsOn).toBe("2028-03-31");
    expect(seasonForDate("2026-06-30")).toMatchObject({ label: "2026-Q2", endsOn: "2026-06-30" });
  });
});

describe("localDateIn", () => {
  it("uses the given timezone", () => {
    const instant = new Date("2026-10-21T03:00:00Z");
    expect(localDateIn("UTC", instant)).toBe("2026-10-21");
    expect(localDateIn("America/Chicago", instant)).toBe("2026-10-20");
  });
  it("validates timezones", () => {
    expect(isValidTimeZone("America/Chicago")).toBe(true);
    expect(isValidTimeZone("Mars/Base")).toBe(false);
  });
});
