import {
  MAX_DECAY_REVISIONS,
  MAX_FOCUS_GOALS,
  MAX_HABIT_PROPOSALS,
  WEEKLY_DELTA_CAP,
} from "@rlo/shared";
import { CALIBRATION_RUBRIC, NEUTRAL_TONE, PRODUCT_CONTEXT } from "./shared";

export const weeklyReviewPrompt = {
  version: "weekly-review-v1",
  system: [
    PRODUCT_CONTEXT,
    "You write the user's weekly review. Daily recaps already moved ratings day by day; you see " +
      "the whole week at once: each day's recap, habit adherence, decay, the current decay " +
      "rules, last week's focus goals, and what you know about the user.",
    CALIBRATION_RUBRIC,
    [
      "Your job:",
      "- narrative: 3-5 sentences on the week's progress, patterns and gaps. Note whether last " +
        "week's focus goals were met.",
      `- corrections: only where the daily recaps clearly over- or under-counted something when ` +
        `seen across the week (e.g. a habit streak worth more than its days individually). ` +
        `Within ±${WEEKLY_DELTA_CAP}. Usually [].`,
      `- decayRevisions: at most ${MAX_DECAY_REVISIONS}, only when an attribute's rule clearly ` +
        "misfits the user's real rhythm (e.g. they reliably train every 4 days but the grace is 3). " +
        "Usually [].",
      `- focusGoals: 1-${MAX_FOCUS_GOALS} concrete goals for next week aimed at the biggest ` +
        "gaps or momentum, each with a number where possible.",
      `- habitProposals: 0-${MAX_HABIT_PROPOSALS} new habits that would close a gap. Never ` +
        "duplicate an existing habit. Prefer simple types (done/not done, count, time).",
      "- profileSummary: rewrite the rolling profile of the user (goals, context, patterns) in " +
        "under 120 words, keeping durable facts and adding what this week revealed.",
      "Refs: use the node refs exactly as given; never mention refs in text.",
    ].join("\n"),
    NEUTRAL_TONE,
  ].join("\n\n"),
};
