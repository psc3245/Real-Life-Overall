import { describe, expect, it } from "vitest";
import {
  DEFAULT_PREFERENCES,
  normalizeTodayWidgets,
  parsePreferences,
  preferencesPatchSchema,
  TODAY_WIDGETS,
} from "./schemas/preferences";

describe("preferences", () => {
  it("fill every missing field with its default", () => {
    expect(parsePreferences(null)).toEqual(DEFAULT_PREFERENCES);
    expect(DEFAULT_PREFERENCES.theme).toBe("court");
    expect(Object.values(DEFAULT_PREFERENCES.features).every(Boolean)).toBe(true);
    expect(DEFAULT_PREFERENCES.today.widgets.map((w) => w.id)).toEqual([...TODAY_WIDGETS]);
  });

  it("replace invalid or removed values field by field", () => {
    const prefs = parsePreferences({
      theme: "vaporwave",
      accent: "violet",
      customAccent: "red",
      features: { goals: false, removed: true, charts: "no" },
      today: { layout: "stack", goalsShown: 99 },
    });
    expect(prefs.theme).toBe("court");
    expect(prefs.accent).toBe("violet");
    expect(prefs.customAccent).toBe("#3cf2c8");
    expect(prefs.features.goals).toBe(false);
    expect(prefs.features.charts).toBe(true);
    expect(prefs.features).not.toHaveProperty("removed");
    expect(prefs.today.layout).toBe("stack");
    expect(prefs.today.goalsShown).toBe(4);
  });

  it("keep the saved widget order and append new widgets", () => {
    const widgets = normalizeTodayWidgets([
      { id: "recap", visible: false, wide: true },
      { id: "habits", visible: true, wide: false },
      { id: "recap", visible: true, wide: true },
      { id: "gone", visible: true, wide: false },
    ]);
    expect(widgets.slice(0, 2)).toEqual([
      { id: "recap", visible: false, wide: true },
      { id: "habits", visible: true, wide: false },
    ]);
    expect(widgets.map((w) => w.id).sort()).toEqual([...TODAY_WIDGETS].sort());
  });

  it("reject unknown keys in a patch", () => {
    expect(preferencesPatchSchema.safeParse({ theme: "oled" }).success).toBe(true);
    expect(preferencesPatchSchema.safeParse({ them: "oled" }).success).toBe(false);
    // Top-level keys replace the stored value whole, so features must be complete.
    expect(preferencesPatchSchema.safeParse({ features: { goals: false } }).success).toBe(false);
    const features = { ...DEFAULT_PREFERENCES.features, goals: false };
    expect(preferencesPatchSchema.safeParse({ features }).success).toBe(true);
  });
});
