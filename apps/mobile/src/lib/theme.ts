import { ratingTier, type RatingTierKey } from "@rlo/shared";

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

const tiers: Record<RatingTierKey, string> = {
  red: "#ff4d4d",
  orange: "#ff9f1c",
  yellow: "#e8e337",
  green: "#3ce06b",
  purple: "#b56cff",
};

export function tierColor(value: number): string {
  return tiers[ratingTier(value)];
}

/** Condensed display type ships with iOS, standing in for the web's Oswald. */
export const fonts = {
  display: "AvenirNextCondensed-Bold",
  heavy: "AvenirNextCondensed-Heavy",
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
