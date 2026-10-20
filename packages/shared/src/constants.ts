export const RATING_MIN = 0;
export const RATING_MAX = 100;

/** Levels allowed below Overall: Category (1) → Attribute (2) → Sub-attribute (3). */
export const MAX_RATING_DEPTH = 3;

export const MAX_TREE_NODES = 80;
export const MAX_NODE_NAME_LENGTH = 40;
export const MAX_NODE_DESCRIPTION_LENGTH = 200;

/** 2K-style value tiers, lowest first. `min` is inclusive. */
export const RATING_TIERS = [
  { key: "red", min: 0, label: "Developing" },
  { key: "orange", min: 60, label: "Solid" },
  { key: "yellow", min: 70, label: "Strong" },
  { key: "green", min: 80, label: "Elite" },
  { key: "purple", min: 90, label: "Legendary" },
] as const;

export type RatingTierKey = (typeof RATING_TIERS)[number]["key"];
