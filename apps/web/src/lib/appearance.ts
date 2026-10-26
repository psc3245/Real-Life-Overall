import {
  LIGHT_THEMES,
  type Accent,
  type BodyFont,
  type DisplayFont,
  type Preferences,
  type Theme,
} from "@rlo/shared";

/**
 * Turns appearance preferences into the CSS variables the Tailwind theme reads (styles/index.css).
 * Every color utility resolves through `var(--color-…)`, so swapping the variables on <html>
 * restyles the whole app without touching components.
 */

type Scale = [string, string, string, string, string, string, string]; // 950 900 800 700 500 300 100
const STEPS = ["950", "900", "800", "700", "500", "300", "100"] as const;

export const THEME_INFO: Record<Theme, { label: string; scale: Scale }> = {
  court: {
    label: "Court",
    scale: ["#07090d", "#0d1117", "#151b24", "#1f2833", "#3a4757", "#8b98a9", "#e6edf5"],
  },
  midnight: {
    label: "Midnight",
    scale: ["#050a17", "#0a1326", "#101c36", "#1a2a4a", "#3a4f78", "#8fa2c8", "#e8eefc"],
  },
  carbon: {
    label: "Carbon",
    scale: ["#0a0a0a", "#121212", "#1b1b1b", "#272727", "#474747", "#a3a3a3", "#ededed"],
  },
  oled: {
    label: "OLED black",
    scale: ["#000000", "#050505", "#101010", "#1c1c1c", "#3d3d3d", "#9a9a9a", "#f2f2f2"],
  },
  turf: {
    label: "Turf",
    scale: ["#05100a", "#0a1911", "#10241a", "#1a3426", "#355443", "#8fae9c", "#e6f3eb"],
  },
  daylight: {
    label: "Daylight",
    scale: ["#f4f6f9", "#ffffff", "#e8ecf1", "#d3dae3", "#6b7787", "#46525f", "#0e1621"],
  },
  paper: {
    label: "Paper",
    scale: ["#f6f1e7", "#fffcf5", "#ece4d3", "#dbcfb8", "#857a64", "#5d5444", "#1e1a13"],
  },
};

/** Bright on dark surfaces, deeper on light ones so text stays readable. */
export const ACCENT_INFO: Record<
  Exclude<Accent, "custom">,
  { label: string; dark: string; light: string }
> = {
  mint: { label: "Mint", dark: "#3cf2c8", light: "#0b8f74" },
  ice: { label: "Ice", dark: "#4cc9ff", light: "#0369a1" },
  volt: { label: "Volt", dark: "#c6f432", light: "#4d7c0f" },
  gold: { label: "Gold", dark: "#ffc53d", light: "#a16207" },
  blaze: { label: "Blaze", dark: "#ff8a3d", light: "#c2410c" },
  crimson: { label: "Crimson", dark: "#ff5468", light: "#be123c" },
  flamingo: { label: "Flamingo", dark: "#ff6fb5", light: "#be185d" },
  violet: { label: "Violet", dark: "#b693ff", light: "#6d28d9" },
  mono: { label: "Mono", dark: "#e6edf5", light: "#1f2833" },
};

const TIERS = {
  classic: {
    dark: ["#ff4d4d", "#ff9f1c", "#e8e337", "#3ce06b", "#b56cff"],
    light: ["#dc2626", "#d97706", "#958c00", "#16a34a", "#9333ea"],
  },
  // Okabe-Ito based: distinguishable with the common color-vision deficiencies.
  colorblind: {
    dark: ["#f0743a", "#e69f00", "#f0e442", "#56b4e9", "#d58bb5"],
    light: ["#c2510a", "#b07800", "#8a8200", "#1f78b4", "#a8507f"],
  },
} as const;
const TIER_NAMES = ["red", "orange", "yellow", "green", "purple"] as const;

interface FontInfo {
  label: string;
  stack: string;
  /** Google Fonts `family=` value; omitted for system stacks. */
  google?: string;
}
const SYSTEM = 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif';

export const DISPLAY_FONT_INFO: Record<DisplayFont, FontInfo> = {
  oswald: { label: "Oswald", stack: `"Oswald", ${SYSTEM}`, google: "Oswald:wght@500;600;700" },
  bebas: { label: "Bebas Neue", stack: `"Bebas Neue", ${SYSTEM}`, google: "Bebas+Neue" },
  barlow: {
    label: "Barlow Condensed",
    stack: `"Barlow Condensed", ${SYSTEM}`,
    google: "Barlow+Condensed:wght@500;600;700",
  },
  teko: { label: "Teko", stack: `"Teko", ${SYSTEM}`, google: "Teko:wght@500;600;700" },
  anton: { label: "Anton", stack: `"Anton", ${SYSTEM}`, google: "Anton" },
  inter: { label: "Inter", stack: `"Inter", ${SYSTEM}`, google: "Inter:wght@400;500;600" },
  system: { label: "System", stack: SYSTEM },
};

export const BODY_FONT_INFO: Record<BodyFont, FontInfo> = {
  inter: { label: "Inter", stack: `"Inter", ${SYSTEM}`, google: "Inter:wght@400;500;600" },
  system: { label: "System", stack: SYSTEM },
  plex: {
    label: "IBM Plex Sans",
    stack: `"IBM Plex Sans", ${SYSTEM}`,
    google: "IBM+Plex+Sans:wght@400;500;600",
  },
  nunito: {
    label: "Nunito Sans",
    stack: `"Nunito Sans", ${SYSTEM}`,
    google: "Nunito+Sans:wght@400;500;600",
  },
  lexend: { label: "Lexend", stack: `"Lexend", ${SYSTEM}`, google: "Lexend:wght@400;500;600" },
  mono: {
    label: "JetBrains Mono",
    stack: `"JetBrains Mono", ui-monospace, monospace`,
    google: "JetBrains+Mono:wght@400;500;600",
  },
};

const TEXT_SIZE = { sm: "87.5%", md: "100%", lg: "112.5%", xl: "125%" } as const;
const SPACING = { compact: "0.21rem", cozy: "0.25rem", roomy: "0.29rem" } as const;
/** Tailwind radius tokens: sm md lg xl 2xl. */
const RADII = {
  sharp: ["0", "0", "0", "0", "0"],
  soft: ["0.25rem", "0.375rem", "0.5rem", "0.75rem", "1rem"],
  round: ["0.375rem", "0.625rem", "0.875rem", "1.25rem", "1.625rem"],
  pill: ["0.5rem", "0.875rem", "1.25rem", "1.75rem", "2.25rem"],
} as const;
const RADIUS_NAMES = ["sm", "md", "lg", "xl", "2xl"] as const;

export const isLightTheme = (theme: Theme) => LIGHT_THEMES.includes(theme);

export function accentColor(prefs: Pick<Preferences, "theme" | "accent" | "customAccent">) {
  if (prefs.accent === "custom") return prefs.customAccent;
  const light = isLightTheme(prefs.theme);
  if (prefs.accent === "mono") return THEME_INFO[prefs.theme].scale[6];
  return ACCENT_INFO[prefs.accent][light ? "light" : "dark"];
}

export function appearanceVars(prefs: Preferences): Record<string, string> {
  const light = isLightTheme(prefs.theme);
  const accent = accentColor(prefs);
  const vars: Record<string, string> = {
    "--color-neon": accent,
    "--color-neon-dim": `color-mix(in oklab, ${accent} 55%, ${light ? "white" : "black"})`,
    "--color-flare": light ? "#e11d48" : "#ff4d6d",
    "--font-display": DISPLAY_FONT_INFO[prefs.displayFont].stack,
    "--font-sans": BODY_FONT_INFO[prefs.bodyFont].stack,
    "--spacing": SPACING[prefs.density],
    "font-size": TEXT_SIZE[prefs.textSize],
  };
  THEME_INFO[prefs.theme].scale.forEach((c, i) => (vars[`--color-court-${STEPS[i]}`] = c));
  TIERS[prefs.tierPalette][light ? "light" : "dark"].forEach(
    (c, i) => (vars[`--color-tier-${TIER_NAMES[i]}`] = c),
  );
  RADII[prefs.corners].forEach((r, i) => (vars[`--radius-${RADIUS_NAMES[i]}`] = r));
  return vars;
}

const loadedFonts = new Set(["Oswald:wght@500;600;700", "Inter:wght@400;500;600"]);

/** Adds a Google Fonts stylesheet for each family not loaded yet (index.html preloads the defaults). */
export function loadFonts(fonts: FontInfo[]) {
  if (typeof document === "undefined") return;
  for (const { google } of fonts) {
    if (!google || loadedFonts.has(google)) continue;
    loadedFonts.add(google);
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = `https://fonts.googleapis.com/css2?family=${google}&display=swap`;
    document.head.appendChild(link);
  }
}

/** Applies preferences to <html>: variables inline, toggles as data attributes for index.css. */
export function applyAppearance(prefs: Preferences, root = document.documentElement) {
  for (const [name, value] of Object.entries(appearanceVars(prefs))) {
    root.style.setProperty(name, value);
  }
  root.style.colorScheme = isLightTheme(prefs.theme) ? "light" : "dark";
  root.dataset.backdrop = prefs.backdrop;
  root.dataset.motion = prefs.motion;
  root.dataset.caps = prefs.allCaps ? "on" : "off";
  root.dataset.theme = isLightTheme(prefs.theme) ? "light" : "dark";
  loadFonts([DISPLAY_FONT_INFO[prefs.displayFont], BODY_FONT_INFO[prefs.bodyFont]]);
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", THEME_INFO[prefs.theme].scale[0]);
}

/** Whether to skip animations: the player's choice, else the system setting. */
export function reducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  const choice = document.documentElement.dataset.motion;
  if (choice === "off") return true;
  if (choice === "full") return false;
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
}
