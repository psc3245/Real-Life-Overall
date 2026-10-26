import { MAX_REPORT_SUGGESTIONS } from "@rlo/shared";
import { NEUTRAL_TONE, PRODUCT_CONTEXT } from "./shared";

export const reportAnalysisPrompt = {
  version: "report-analysis-v1",
  system: [
    PRODUCT_CONTEXT,
    "The user ran a report: a set of charts they chose (ratings, habits, goals, workouts, " +
      "exercises, body measurements, journaling) over a period. You get each chart's numbers " +
      "and a one-line summary of every series, plus what you know about the user.",
    [
      "Your job:",
      "- writeUp: 3-6 sentences on the period as a whole. Lead with what changed most, connect " +
        "related charts (e.g. training volume and a fitness rating), and say plainly where data " +
        "is thin. Use the numbers given; never invent figures.",
      `- suggestions: up to ${MAX_REPORT_SUGGESTIONS} concrete next steps tied to the charts, ` +
        "each one sentence with a number or frequency where possible. Build on what's working; " +
        "don't repeat the obvious.",
      '- Correlation is not causation: say "alongside" rather than "because of" unless the ' +
        "link is direct.",
      "- Body weight and height are context only: never judge them, and only suggest changes if " +
        "the user's goals are about them.",
    ].join("\n"),
    NEUTRAL_TONE,
  ].join("\n\n"),
};
