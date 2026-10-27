import { ratingTier, type Preferences, type RatingTierKey } from "@rlo/shared";

type TierPalette = Preferences["tierPalette"];

/** 2K-style menu palette, matching the web theme (apps/web/src/styles/index.css). */
export const colors = {
  court950: "#07090d",
  court900: "#0d1117",
  court800: "#151b24",
  court700: "#1f2833",
  court500: "#3a4757",
  court300: "#8b98a9",
  court100: "#e6edf5",
  neon: "#3cf2c8",
  neonDim: "#1d8f76",
  flare: "#ff4d6d",
} as const;

const TIER_PALETTES: Record<TierPalette, Record<RatingTierKey, string>> = {
  classic: {
    red: "#ff4d4d",
    orange: "#ff9f1c",
    yellow: "#e8e337",
    green: "#3ce06b",
    purple: "#b56cff",
  },
  // Okabe-Ito based, matching the web: distinguishable with common color-vision deficiencies.
  colorblind: {
    red: "#f0743a",
    orange: "#e69f00",
    yellow: "#f0e442",
    green: "#56b4e9",
    purple: "#d58bb5",
  },
};
let tiers = TIER_PALETTES.classic;

/**
 * The player's tier palette (a synced preference). Set from the root layout before screens render;
 * screens that read preferences re-render when it changes.
 */
export function setTierPalette(palette: TierPalette) {
  tiers = TIER_PALETTES[palette];
}

/** A rating's tier color (0-100 scale). */
export function tierColor(value: number): string {
  return tiers[ratingTier(value)];
}

/** A tier's color by key (growth uses its own thresholds). */
export function tierKeyColor(tier: RatingTierKey): string {
  return tiers[tier];
}

/** Condensed display type ships with iOS, standing in for the web's Oswald. */
export const fonts = {
  display: "AvenirNextCondensed-Bold",
  heavy: "AvenirNextCondensed-Heavy",
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
