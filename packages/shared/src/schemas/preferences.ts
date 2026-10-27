import { z } from "zod";
import { SPORTS_TALK_LEVELS } from "../talk";

/**
 * Per-player personalization and configuration (DESIGN.md §7.9), stored as one jsonb document on
 * the user. Every field falls back to its default when missing or invalid, so old documents and
 * removed options never break the app, and new options appear with their defaults.
 */

/** Surface palettes. Each is dark or light; the web maps them to the `court` color scale. */
export const THEMES = ["court", "midnight", "carbon", "oled", "turf", "daylight", "paper"] as const;
export type Theme = (typeof THEMES)[number];
export const LIGHT_THEMES: readonly Theme[] = ["daylight", "paper"];

export const ACCENTS = [
  "mint",
  "ice",
  "volt",
  "gold",
  "blaze",
  "crimson",
  "flamingo",
  "violet",
  "mono",
  "custom",
] as const;
export type Accent = (typeof ACCENTS)[number];

export const DISPLAY_FONTS = [
  "oswald",
  "bebas",
  "barlow",
  "teko",
  "anton",
  "inter",
  "system",
] as const;
export type DisplayFont = (typeof DISPLAY_FONTS)[number];

export const BODY_FONTS = ["inter", "system", "plex", "nunito", "lexend", "mono"] as const;
export type BodyFont = (typeof BODY_FONTS)[number];

export const TEXT_SIZES = ["sm", "md", "lg", "xl"] as const;
export const DENSITIES = ["compact", "cozy", "roomy"] as const;
export const CORNERS = ["sharp", "soft", "round", "pill"] as const;
export const BACKDROPS = ["glow", "grid", "plain"] as const;
export const MOTIONS = ["full", "system", "off"] as const;
export const TIER_PALETTES = ["classic", "colorblind"] as const;
export const PAGE_WIDTHS = ["narrow", "normal", "wide", "full"] as const;
export const START_PAGES = ["home", "today", "log", "ratings", "habits"] as const;
export type StartPage = (typeof START_PAGES)[number];

/**
 * Parts of the app a player can switch off. Off hides the nav link, the Today widget and the
 * day-log section; the data stays and comes back when switched on. Ratings, Today and the log
 * are the core loop and always on.
 */
export const FEATURES = [
  "habits",
  "goals",
  "workouts",
  "journal",
  "guidedPrompts",
  "week",
  "friends",
  "leaderboards",
  "charts",
  "reports",
  "history",
  "focus",
  "adaptiveRating",
  "coach",
] as const;
export type Feature = (typeof FEATURES)[number];

/** Today page widgets, in their default order. */
export const TODAY_WIDGETS = [
  "missed",
  "habits",
  "rating",
  "goals",
  "journal",
  "training",
  "charts",
  "focus",
  "coach",
  "recap",
] as const;
export type TodayWidget = (typeof TODAY_WIDGETS)[number];

/** The feature a widget belongs to; switching the feature off hides the widget too. */
export const TODAY_WIDGET_FEATURE: Partial<Record<TodayWidget, Feature>> = {
  habits: "habits",
  goals: "goals",
  journal: "journal",
  training: "workouts",
  charts: "charts",
  focus: "focus",
  coach: "coach",
};

const DEFAULT_WIDGETS: TodayWidgetConfig[] = TODAY_WIDGETS.map((id) => ({
  id,
  visible: id !== "training",
  wide: ["missed", "charts", "focus", "recap", "training"].includes(id),
}));

export interface TodayWidgetConfig {
  id: TodayWidget;
  visible: boolean;
  /** Spans both columns in the two-column layout. */
  wide: boolean;
}

const widgetSchema = z.object({
  id: z.enum(TODAY_WIDGETS),
  visible: z.boolean().catch(true),
  wide: z.boolean().catch(false),
});

/** Keeps the saved order, drops unknown or repeated widgets and appends any new ones. */
export function normalizeTodayWidgets(raw: unknown): TodayWidgetConfig[] {
  const list = Array.isArray(raw) ? raw : [];
  const seen = new Set<TodayWidget>();
  const out: TodayWidgetConfig[] = [];
  for (const item of list) {
    const parsed = widgetSchema.safeParse(item);
    if (!parsed.success || seen.has(parsed.data.id)) continue;
    seen.add(parsed.data.id);
    out.push(parsed.data);
  }
  for (const w of DEFAULT_WIDGETS) if (!seen.has(w.id)) out.push({ ...w });
  return out;
}

const HEX = /^#[0-9a-f]{6}$/i;

const featuresSchema = z
  .record(z.string(), z.unknown())
  .catch({})
  .transform(
    (raw) =>
      Object.fromEntries(
        FEATURES.map((f) => [f, typeof raw[f] === "boolean" ? raw[f] : true]),
      ) as Record<Feature, boolean>,
  );

const todayObject = z.object({
  layout: z.enum(["columns", "stack"]).catch("columns"),
  greeting: z.boolean().catch(true),
  showLogButton: z.boolean().catch(true),
  hideDoneHabits: z.boolean().catch(false),
  goalsShown: z.number().int().min(1).max(20).catch(4),
  moversShown: z.number().int().min(0).max(10).catch(4),
  widgets: z.unknown().optional().transform(normalizeTodayWidgets),
});
const todaySchema = todayObject.catch(() => todayObject.parse({}));

export const preferencesSchema = z.object({
  theme: z.enum(THEMES).catch("court"),
  accent: z.enum(ACCENTS).catch("mint"),
  customAccent: z.string().regex(HEX).catch("#3cf2c8"),
  displayFont: z.enum(DISPLAY_FONTS).catch("oswald"),
  bodyFont: z.enum(BODY_FONTS).catch("inter"),
  textSize: z.enum(TEXT_SIZES).catch("md"),
  density: z.enum(DENSITIES).catch("cozy"),
  corners: z.enum(CORNERS).catch("soft"),
  backdrop: z.enum(BACKDROPS).catch("glow"),
  motion: z.enum(MOTIONS).catch("system"),
  allCaps: z.boolean().catch(true),
  tierPalette: z.enum(TIER_PALETTES).catch("classic"),
  pageWidth: z.enum(PAGE_WIDTHS).catch("normal"),
  stickyNav: z.boolean().catch(false),
  showApiStatus: z.boolean().catch(true),
  startPage: z.enum(START_PAGES).catch("home"),
  /** How much sports framing the app and the model use (DESIGN.md §7.10). */
  sportsTalk: z.enum(SPORTS_TALK_LEVELS).catch("normal"),
  features: featuresSchema,
  today: todaySchema,
});

export type Preferences = z.infer<typeof preferencesSchema>;
export type TodayPreferences = Preferences["today"];

/** Reads a stored document (or anything else) into complete preferences. */
export function parsePreferences(raw: unknown): Preferences {
  return preferencesSchema.parse(raw && typeof raw === "object" ? raw : {});
}

export const DEFAULT_PREFERENCES: Preferences = parsePreferences({});

/**
 * PATCH /me body: any top-level keys, each replaced whole except `features`, which merges per
 * feature so two devices toggling different features can't overwrite each other. `today` is
 * replaced whole (send the full object). Strict here so typos are rejected rather than stored.
 */
export const preferencesPatchSchema = z
  .object({
    theme: z.enum(THEMES),
    accent: z.enum(ACCENTS),
    customAccent: z.string().regex(HEX),
    displayFont: z.enum(DISPLAY_FONTS),
    bodyFont: z.enum(BODY_FONTS),
    textSize: z.enum(TEXT_SIZES),
    density: z.enum(DENSITIES),
    corners: z.enum(CORNERS),
    backdrop: z.enum(BACKDROPS),
    motion: z.enum(MOTIONS),
    allCaps: z.boolean(),
    tierPalette: z.enum(TIER_PALETTES),
    pageWidth: z.enum(PAGE_WIDTHS),
    stickyNav: z.boolean(),
    showApiStatus: z.boolean(),
    startPage: z.enum(START_PAGES),
    sportsTalk: z.enum(SPORTS_TALK_LEVELS),
    features: z
      .object(
        Object.fromEntries(FEATURES.map((f) => [f, z.boolean()])) as Record<Feature, z.ZodBoolean>,
      )
      .partial()
      .strict(),
    today: z.object({
      layout: z.enum(["columns", "stack"]),
      greeting: z.boolean(),
      showLogButton: z.boolean(),
      hideDoneHabits: z.boolean(),
      goalsShown: z.number().int().min(1).max(20),
      moversShown: z.number().int().min(0).max(10),
      widgets: z.array(widgetSchema).max(TODAY_WIDGETS.length),
    }),
  })
  .partial()
  .strict();
export type PreferencesPatch = z.infer<typeof preferencesPatchSchema>;

/** Two queued patches as one: later keys win, and `features` merges per feature. */
export function mergePreferencesPatches(
  a: PreferencesPatch,
  b: PreferencesPatch,
): PreferencesPatch {
  const merged = { ...a, ...b };
  if (a.features && b.features) merged.features = { ...a.features, ...b.features };
  return merged;
}

/** Preferences with a patch applied, the way the API stores it. */
export function applyPreferencesPatch(prefs: Preferences, patch: PreferencesPatch): Preferences {
  const { features, ...rest } = patch;
  return { ...prefs, ...rest, features: { ...prefs.features, ...features } };
}
