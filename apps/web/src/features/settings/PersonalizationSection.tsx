import {
  ACCENTS,
  BODY_FONTS,
  DEFAULT_PREFERENCES,
  DISPLAY_FONTS,
  THEMES,
  type Preferences,
  type PreferencesPatch,
  SPORTS_TALK_INFO,
  SPORTS_TALK_LEVELS,
} from "@rlo/shared";
import { useEffect } from "react";
import { usePreferences, useSetPreferences } from "../../api/preferences";
import { OvrBadge } from "../../components/OvrBadge";
import { StatBar } from "../../components/StatBar";
import {
  ACCENT_INFO,
  accentColor,
  BODY_FONT_INFO,
  DISPLAY_FONT_INFO,
  isLightTheme,
  loadFonts,
  THEME_INFO,
} from "../../lib/appearance";
import {
  HeaderAction,
  SaveStatus,
  Segmented,
  Select,
  SettingBlock,
  SettingRow,
  SettingsCard,
  Toggle,
} from "./controls";

/** The look-and-feel keys "Reset" puts back; Today and configuration have their own. */
const APPEARANCE_KEYS = [
  "theme",
  "accent",
  "customAccent",
  "displayFont",
  "bodyFont",
  "textSize",
  "density",
  "corners",
  "backdrop",
  "motion",
  "allCaps",
  "tierPalette",
  "pageWidth",
  "stickyNav",
  "showApiStatus",
  "startPage",
  "sportsTalk",
] as const satisfies readonly (keyof Preferences)[];

export function PersonalizationSection() {
  const prefs = usePreferences();
  const set = useSetPreferences();
  const isDefault = APPEARANCE_KEYS.every((k) => prefs[k] === DEFAULT_PREFERENCES[k]);

  // Load every font once so the pickers can show each one in its own face.
  useEffect(() => {
    loadFonts([...Object.values(DISPLAY_FONT_INFO), ...Object.values(BODY_FONT_INFO)]);
  }, []);

  const reset = () =>
    set(
      Object.fromEntries(
        APPEARANCE_KEYS.map((k) => [k, DEFAULT_PREFERENCES[k]]),
      ) as PreferencesPatch,
    );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3 text-sm">
        <p className="text-court-300">
          Changes apply instantly and follow you to any device you sign in on.
        </p>
        <span className="flex items-baseline gap-4">
          <SaveStatus />
          {!isDefault && <HeaderAction onClick={reset}>Reset look</HeaderAction>}
        </span>
      </div>

      <Preview />

      <SettingsCard title="Theme & color">
        <SettingBlock label="Theme">
          <div
            role="radiogroup"
            aria-label="Theme"
            className="grid grid-cols-2 gap-2 sm:grid-cols-4"
          >
            {THEMES.map((theme) => {
              const [bg, card, , border, , muted, text] = THEME_INFO[theme].scale;
              const selected = prefs.theme === theme;
              return (
                <button
                  key={theme}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => set({ theme })}
                  className={`overflow-hidden rounded-xl border-2 text-left ${selected ? "border-neon" : "border-court-700 hover:border-court-500"}`}
                >
                  <span className="block p-2.5" style={{ background: bg }}>
                    <span
                      className="block space-y-1.5 rounded-md border p-2"
                      style={{ background: card, borderColor: border }}
                    >
                      <span
                        className="block h-1.5 w-2/3 rounded-full"
                        style={{ background: accentColor({ ...prefs, theme }) }}
                      />
                      <span
                        className="block h-1 w-full rounded-full"
                        style={{ background: muted }}
                      />
                      <span
                        className="block h-1 w-1/2 rounded-full"
                        style={{ background: muted }}
                      />
                    </span>
                  </span>
                  <span
                    className="flex items-center justify-between px-2.5 py-1.5 text-xs font-medium"
                    style={{ background: card, color: text }}
                  >
                    {THEME_INFO[theme].label}
                    <span style={{ color: muted }}>{isLightTheme(theme) ? "light" : "dark"}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </SettingBlock>
        <SettingBlock label="Accent color">
          <div
            role="radiogroup"
            aria-label="Accent color"
            className="flex flex-wrap items-center gap-2"
          >
            {ACCENTS.filter((a) => a !== "custom").map((accent) => {
              const color = accentColor({ ...prefs, accent });
              const selected = prefs.accent === accent;
              return (
                <button
                  key={accent}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={ACCENT_INFO[accent].label}
                  title={ACCENT_INFO[accent].label}
                  onClick={() => set({ accent })}
                  className={`h-8 w-8 rounded-full border-2 ${selected ? "border-court-100 ring-2 ring-neon ring-offset-2 ring-offset-court-900" : "border-court-700 hover:scale-110"} transition`}
                  style={{ background: color }}
                />
              );
            })}
            <label
              className={`flex h-8 cursor-pointer items-center gap-2 rounded-full border-2 pr-3 pl-1 text-sm ${prefs.accent === "custom" ? "border-neon text-neon" : "border-court-700 text-court-300 hover:border-court-500"}`}
            >
              <input
                type="color"
                value={prefs.customAccent}
                onChange={(e) => set({ accent: "custom", customAccent: e.target.value })}
                onClick={() => prefs.accent !== "custom" && set({ accent: "custom" })}
                className="h-5 w-5 cursor-pointer rounded-full border-0 bg-transparent p-0"
                aria-label="Custom accent color"
              />
              Custom
            </label>
          </div>
        </SettingBlock>
        <SettingRow
          label="Rating colors"
          detail="How ratings are colored by tier."
          htmlFor="pref-tiers"
        >
          <Select
            id="pref-tiers"
            label="Rating colors"
            value={prefs.tierPalette}
            onChange={(tierPalette) => set({ tierPalette })}
            options={[
              { value: "classic", label: "Classic" },
              { value: "colorblind", label: "Color-blind safe" },
            ]}
          />
        </SettingRow>
        <SettingRow label="Background" htmlFor="pref-backdrop">
          <Select
            id="pref-backdrop"
            label="Background"
            value={prefs.backdrop}
            onChange={(backdrop) => set({ backdrop })}
            options={[
              { value: "glow", label: "Glow" },
              { value: "grid", label: "Grid" },
              { value: "plain", label: "Plain" },
            ]}
          />
        </SettingRow>
      </SettingsCard>

      <SettingsCard title="Type">
        <SettingBlock label="Headline font">
          <div
            role="radiogroup"
            aria-label="Headline font"
            className="grid grid-cols-2 gap-2 sm:grid-cols-4"
          >
            {DISPLAY_FONTS.map((font) => (
              <FontOption
                key={font}
                selected={prefs.displayFont === font}
                onSelect={() => set({ displayFont: font })}
                stack={DISPLAY_FONT_INFO[font].stack}
                label={DISPLAY_FONT_INFO[font].label}
                sample={<span className="text-2xl font-bold uppercase">OVR 87</span>}
              />
            ))}
          </div>
        </SettingBlock>
        <SettingBlock label="Body font">
          <div
            role="radiogroup"
            aria-label="Body font"
            className="grid grid-cols-2 gap-2 sm:grid-cols-3"
          >
            {BODY_FONTS.map((font) => (
              <FontOption
                key={font}
                selected={prefs.bodyFont === font}
                onSelect={() => set({ bodyFont: font })}
                stack={BODY_FONT_INFO[font].stack}
                label={BODY_FONT_INFO[font].label}
                sample={<span className="text-sm">Logged a 5k run today.</span>}
              />
            ))}
          </div>
        </SettingBlock>
        <SettingRow label="Text size">
          <Segmented
            label="Text size"
            value={prefs.textSize}
            onChange={(textSize) => set({ textSize })}
            options={[
              { value: "sm", label: "S" },
              { value: "md", label: "M" },
              { value: "lg", label: "L" },
              { value: "xl", label: "XL" },
            ]}
          />
        </SettingRow>
        <Toggle
          checked={prefs.allCaps}
          onChange={(allCaps) => set({ allCaps })}
          label="All-caps headings and labels"
          detail="The 2K menu look. Turn off for sentence case everywhere."
        />
      </SettingsCard>

      <SettingsCard title="Layout">
        <SettingRow label="Density" detail="Spacing between things." htmlFor="pref-density">
          <Select
            id="pref-density"
            label="Density"
            value={prefs.density}
            onChange={(density) => set({ density })}
            options={[
              { value: "compact", label: "Compact" },
              { value: "cozy", label: "Cozy" },
              { value: "roomy", label: "Roomy" },
            ]}
          />
        </SettingRow>
        <SettingRow label="Corners" htmlFor="pref-corners">
          <Select
            id="pref-corners"
            label="Corners"
            value={prefs.corners}
            onChange={(corners) => set({ corners })}
            options={[
              { value: "sharp", label: "Sharp" },
              { value: "soft", label: "Soft" },
              { value: "round", label: "Round" },
              { value: "pill", label: "Extra round" },
            ]}
          />
        </SettingRow>
        <SettingRow label="Page width" htmlFor="pref-width">
          <Select
            id="pref-width"
            label="Page width"
            value={prefs.pageWidth}
            onChange={(pageWidth) => set({ pageWidth })}
            options={[
              { value: "narrow", label: "Narrow" },
              { value: "normal", label: "Normal" },
              { value: "wide", label: "Wide" },
              { value: "full", label: "Full" },
            ]}
          />
        </SettingRow>
        <Toggle
          checked={prefs.stickyNav}
          onChange={(stickyNav) => set({ stickyNav })}
          label="Pin the menu bar"
          detail="Keeps the main navigation at the top of the screen as you scroll."
        />
      </SettingsCard>

      <SettingsCard title="Behavior">
        <SettingRow
          label="Sports talk"
          detail={`${SPORTS_TALK_INFO[prefs.sportsTalk].detail} Changes the app's wording and how the AI writes your recaps, reviews and coach replies.`}
          htmlFor="pref-talk"
        >
          <Select
            id="pref-talk"
            label="Sports talk"
            value={prefs.sportsTalk}
            onChange={(sportsTalk) => set({ sportsTalk })}
            options={SPORTS_TALK_LEVELS.map((level) => ({
              value: level,
              label: SPORTS_TALK_INFO[level].label,
            }))}
          />
        </SettingRow>
        <SettingRow label="Open the app on" htmlFor="pref-start">
          <Select
            id="pref-start"
            label="Open the app on"
            value={prefs.startPage}
            onChange={(startPage) => set({ startPage })}
            options={[
              { value: "home", label: "Home" },
              { value: "today", label: "Today" },
              { value: "log", label: "Log" },
              { value: "ratings", label: "Rating" },
              { value: "habits", label: "Habits" },
            ]}
          />
        </SettingRow>
        <SettingRow label="Animations" htmlFor="pref-motion">
          <Select
            id="pref-motion"
            label="Animations"
            value={prefs.motion}
            onChange={(motion) => set({ motion })}
            options={[
              { value: "full", label: "Full" },
              { value: "system", label: "Match system" },
              { value: "off", label: "Off" },
            ]}
          />
        </SettingRow>
        <Toggle
          checked={prefs.showApiStatus}
          onChange={(showApiStatus) => set({ showApiStatus })}
          label="Show connection status"
          detail="The API dot in the header. It always shows when the connection is down."
        />
      </SettingsCard>
    </div>
  );
}

function FontOption({
  selected,
  onSelect,
  stack,
  label,
  sample,
}: {
  selected: boolean;
  onSelect: () => void;
  stack: string;
  label: string;
  sample: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={`space-y-1 rounded-lg border px-3 py-2 text-left ${selected ? "border-neon bg-neon/10" : "border-court-700 hover:border-court-500"}`}
    >
      <span className="block truncate text-court-100" style={{ fontFamily: stack }}>
        {sample}
      </span>
      <span className="block text-xs text-court-500">{label}</span>
    </button>
  );
}

/** A small slice of the app in the current style, so changes are visible without leaving. */
function Preview() {
  return (
    <div
      aria-hidden
      className="flex flex-wrap items-center gap-5 rounded-xl border border-court-700 bg-court-900/70 p-5"
    >
      <OvrBadge value={84} size="md" />
      <div className="min-w-48 flex-1 space-y-3">
        <p className="font-display text-xl font-semibold uppercase tracking-wider">Preview</p>
        <StatBar label="Fitness" value={91} />
        <StatBar label="Career" value={76} />
        <StatBar label="Sleep" value={58} />
      </div>
      <div className="flex flex-col gap-2">
        <span className="rounded-lg bg-neon px-4 py-2 text-center font-display text-sm font-semibold uppercase tracking-wider text-court-950">
          Log today
        </span>
        <span className="rounded-lg border border-court-500 px-4 py-2 text-center text-sm">
          Secondary
        </span>
      </div>
    </div>
  );
}
