import { describe, expect, it } from "vitest";
import { isValidTimeZone, localDateIn, seasonForDate } from "./season";

describe("seasonForDate", () => {
  it("maps dates before monthly seasons to calendar quarters", () => {
    expect(seasonForDate("2026-08-20")).toEqual({
      label: "2026-Q3",
      startsOn: "2026-07-01",
      endsOn: "2026-09-30",
    });
    expect(seasonForDate("2024-02-29").endsOn).toBe("2024-03-31");
    expect(seasonForDate("2026-06-30")).toMatchObject({ label: "2026-Q2", endsOn: "2026-06-30" });
  });
  it("cuts 2026-Q4 short at the switch to monthly seasons", () => {
    expect(seasonForDate("2026-11-30")).toEqual({
      label: "2026-Q4",
      startsOn: "2026-10-01",
      endsOn: "2026-11-30",
    });
  });
  it("maps dates from the switch on to calendar months", () => {
    expect(seasonForDate("2026-12-01")).toEqual({
      label: "2026-12",
      startsOn: "2026-12-01",
      endsOn: "2026-12-31",
    });
    expect(seasonForDate("2028-02-10")).toMatchObject({ label: "2028-02", endsOn: "2028-02-29" });
    expect(seasonForDate("2027-04-30")).toMatchObject({ label: "2027-04", startsOn: "2027-04-01" });
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
