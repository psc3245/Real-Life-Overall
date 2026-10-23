import { describe, expect, it } from "vitest";
import { addDays, dayOfWeek, isEditableDate, isValidDate } from "../dates";
import { formatHabitEntry, isHabitDone, normalizeHabitConfig, validateHabitEntry } from "./habits";

describe("dates", () => {
  it("validates and shifts calendar dates", () => {
    expect(isValidDate("2026-02-29")).toBe(false);
    expect(isValidDate("2028-02-29")).toBe(true);
    expect(addDays("2026-12-30", 3)).toBe("2027-01-02");
    expect(dayOfWeek("2026-10-20")).toBe(2); // Tuesday
  });

  it("allows edits within the backfill window only", () => {
    expect(isEditableDate("2026-10-20", "2026-10-20")).toBe(true);
    expect(isEditableDate("2026-10-17", "2026-10-20")).toBe(true);
    expect(isEditableDate("2026-10-16", "2026-10-20")).toBe(false);
    expect(isEditableDate("2026-10-21", "2026-10-20")).toBe(false);
  });
});

describe("normalizeHabitConfig", () => {
  it("fills type defaults and drops irrelevant settings", () => {
    expect(normalizeHabitConfig("counter", { unit: "pages", min: 4 })).toEqual({
      target: 1,
      unit: "pages",
      min: null,
      max: null,
    });
    expect(normalizeHabitConfig("duration", {})).toMatchObject({ target: 30 });
    expect(normalizeHabitConfig("slider", { min: 5, max: 2 })).toMatchObject({ min: 0, max: 10 });
    expect(normalizeHabitConfig("rating", { max: 99 })).toMatchObject({ min: 1, max: 10 });
    expect(normalizeHabitConfig("checkbox", { target: 3 })).toEqual({
      target: null,
      unit: null,
      min: null,
      max: null,
    });
  });
});

describe("validateHabitEntry", () => {
  const cfg = (type: Parameters<typeof normalizeHabitConfig>[0], c = {}) =>
    normalizeHabitConfig(type, c);
  it("checks values per type", () => {
    expect(validateHabitEntry("checkbox", cfg("checkbox"), { num: 1, text: null })).toBeNull();
    expect(validateHabitEntry("checkbox", cfg("checkbox"), { num: 2, text: null })).not.toBeNull();
    expect(validateHabitEntry("counter", cfg("counter"), { num: 2.5, text: null })).not.toBeNull();
    expect(validateHabitEntry("slider", cfg("slider"), { num: 11, text: null })).not.toBeNull();
    expect(validateHabitEntry("rating", cfg("rating"), { num: 5, text: null })).toBeNull();
    expect(validateHabitEntry("rating", cfg("rating"), { num: 0, text: null })).not.toBeNull();
    expect(
      validateHabitEntry("shorttext", cfg("shorttext"), { num: null, text: " " }),
    ).not.toBeNull();
    expect(validateHabitEntry("journal", cfg("journal"), { num: null, text: "Ran." })).toBeNull();
  });

  it("knows when a habit counts as done", () => {
    expect(isHabitDone("counter", cfg("counter", { target: 3 }), { num: 2, text: null })).toBe(
      false,
    );
    expect(isHabitDone("duration", cfg("duration"), { num: 45, text: null })).toBe(true);
    expect(isHabitDone("checknote", cfg("checknote"), { num: 0, text: "skipped" })).toBe(false);
  });
});

describe("lastCompletedWeek", () => {
  it("finds the last finished week for the user's first weekday", async () => {
    const { lastCompletedWeek } = await import("./weekly");
    // 2026-10-21 is a Wednesday.
    expect(lastCompletedWeek("2026-10-21", 1)).toEqual({ start: "2026-10-12", end: "2026-10-18" });
    expect(lastCompletedWeek("2026-10-19", 1)).toEqual({ start: "2026-10-12", end: "2026-10-18" });
    expect(lastCompletedWeek("2026-10-18", 1)).toEqual({ start: "2026-10-05", end: "2026-10-11" });
    expect(lastCompletedWeek("2026-10-21", 0)).toEqual({ start: "2026-10-11", end: "2026-10-17" });
  });
});

describe("formatHabitEntry", () => {
  const config = { target: 8, unit: "glasses", min: null, max: null };
  it("summarizes each type briefly", () => {
    expect(formatHabitEntry("checkbox", config, { num: 1, text: null })).toBe("✓");
    expect(formatHabitEntry("checknote", config, { num: 1, text: "Legs" })).toBe("✓ Legs");
    expect(formatHabitEntry("counter", config, { num: 6, text: null })).toBe("6/8 glasses");
    expect(formatHabitEntry("duration", { ...config, target: 30 }, { num: 25, text: null })).toBe(
      "25/30 min",
    );
    expect(formatHabitEntry("rating", { ...config, max: 5 }, { num: 4, text: null })).toBe("4/5");
    expect(formatHabitEntry("shorttext", config, { num: null, text: " Read ch. 3 " })).toBe(
      "Read ch. 3",
    );
    expect(formatHabitEntry("counter", config, null)).toBe("—");
  });
});
