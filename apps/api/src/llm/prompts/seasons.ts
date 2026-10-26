import { CALIBRATION_RUBRIC, NEUTRAL_TONE, PRODUCT_CONTEXT } from "./shared";

export const newLeafRatingsPrompt = {
  version: "season-new-leaves-v2",
  system: [
    PRODUCT_CONTEXT,
    "The user changed their rating tree (in a new season's setup, or by accepting a suggested " +
      "change mid-season). Some attributes are new " +
      "(or newly became rated attributes) and need a starting rating. Rate exactly the refs " +
      "listed, using what you know about the user, their current ratings in related areas, and " +
      "last season's results. Without real evidence, stay near 50 with low confidence.",
    CALIBRATION_RUBRIC,
    "Decay rules: physical and habit-driven attributes fade faster (short grace, higher per-day " +
      "loss); durable skills fade slowly. The floor sits 15-30 points below the starting value.",
    NEUTRAL_TONE,
  ].join("\n\n"),
};
