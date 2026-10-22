/**
 * Categorical series colors for the dark chart surface, in fixed order (validated with the
 * dataviz palette checker against #0d1117: lightness band, chroma, CVD and contrast all pass).
 * Assign by a category's position in the tree so a color always follows the same category.
 */
export const CATEGORY_COLORS = [
  "#3987e5", // blue
  "#d95926", // orange
  "#199e70", // aqua
  "#c98500", // yellow
  "#d55181", // magenta
  "#008300", // green
  "#9085e9", // violet
  "#e66767", // red
] as const;

export const OVERALL_COLOR = "var(--color-neon)";
export const GRID_COLOR = "var(--color-court-700)";
export const AXIS_TEXT = "var(--color-court-500)";
