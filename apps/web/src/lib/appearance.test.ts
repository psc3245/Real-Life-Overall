import { DEFAULT_PREFERENCES } from "@rlo/shared";
import { describe, expect, it } from "vitest";
import { ACCENT_INFO, applyAppearance, appearanceVars } from "./appearance";

describe("appearance", () => {
  it("defaults to the original dark court theme", () => {
    const vars = appearanceVars(DEFAULT_PREFERENCES);
    expect(vars["--color-court-950"]).toBe("#07090d");
    expect(vars["--color-neon"]).toBe("#3cf2c8");
    expect(vars["--spacing"]).toBe("0.25rem");
  });

  it("uses the deeper accent and light tiers on light themes", () => {
    const vars = appearanceVars({ ...DEFAULT_PREFERENCES, theme: "daylight", accent: "gold" });
    expect(vars["--color-neon"]).toBe(ACCENT_INFO.gold.light);
    expect(vars["--color-court-950"]).toBe("#f4f6f9");
    expect(vars["--color-tier-yellow"]).not.toBe("#e8e337");
  });

  it("keeps a custom accent as chosen", () => {
    const prefs = { ...DEFAULT_PREFERENCES, accent: "custom" as const, customAccent: "#123456" };
    expect(appearanceVars(prefs)["--color-neon"]).toBe("#123456");
  });

  it("writes variables and toggles onto the root element", () => {
    const root = document.createElement("div");
    applyAppearance(
      { ...DEFAULT_PREFERENCES, theme: "paper", allCaps: false, motion: "off" },
      root,
    );
    expect(root.style.getPropertyValue("--color-court-900")).toBe("#fffcf5");
    expect(root.style.colorScheme).toBe("light");
    expect(root.dataset).toMatchObject({ caps: "off", motion: "off", theme: "light" });
  });
});
