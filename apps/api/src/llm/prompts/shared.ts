/** Fragments reused across prompts (DESIGN.md §5.7). */
export const NEUTRAL_TONE =
  "Write in a neutral, informative tone. No hype, no emojis. A Voice section may follow; " +
  "it sets how much sports framing to use.";

export const PRODUCT_CONTEXT =
  "You are part of an app where people build a 2K-style rating of their own life: an Overall " +
  "made of categories they choose (e.g. Fitness, Career), each split into attributes, rated 0-100.";

/**
 * What the numbers mean (DESIGN.md §5.1). Without anchors, models cluster ratings at 70-85.
 * Shared by every prompt that sets or moves ratings so the scale stays consistent.
 */
export const CALIBRATION_RUBRIC = [
  "Rating scale (0-100), relative to adults of a similar age:",
  "- 30: well below typical; little to no activity in this area",
  "- 50: typical adult; average habits and results",
  "- 60: somewhat above average",
  "- 70: clearly above average; consistent effort with visible results",
  "- 80: top ~15%; strong, sustained performance",
  "- 85: top ~5%",
  "- 90: top ~1%; exceptional",
  "- 95+: elite or professional level; reserve for clear evidence",
  "Use the full range. Most people are average at most things; a typical profile mixes " +
    "40s-60s with a few higher strengths and some lower gaps.",
].join("\n");
