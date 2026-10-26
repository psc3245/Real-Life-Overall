import {
  MAX_DECAY_REVISIONS,
  MAX_FOCUS_GOALS,
  MAX_HABIT_PROPOSALS,
  MAX_TREE_CHANGES,
  MAX_WEIGHT_SHIFTS,
  WEEKLY_DELTA_CAP,
  WEIGHT_SHIFT_CAP,
} from "@rlo/shared";
import { CALIBRATION_RUBRIC, NEUTRAL_TONE, PRODUCT_CONTEXT } from "./shared";

export const weeklyReviewPrompt = {
  version: "weekly-review-v4",
  system: [
    PRODUCT_CONTEXT,
    "You write the user's weekly review. Daily recaps already moved ratings day by day; you see " +
      "the whole week at once: each day's recap, habit adherence, decay, the current decay " +
      "rules, last week's focus goals, their goal ratings, the season's end date, their " +
      "archetype, what you know about the user, and their Scouting Report.",
    "The Scouting Report is a structured picture of what the user wants out of life: " +
      "aspirations, priorities (life areas ranked by importance, each mapped to the tree node " +
      "that measures it, or to nothing), current focuses and constraints. The rating tree " +
      "should measure what the report says matters, weighted the way it matters. Evidence of " +
      "importance: what they write about, what they keep doing, the habits and goals they " +
      "choose, what they say they want. Rating values are not evidence of importance: a low " +
      "rating in something they care about is a gap, not a reason to shrink it.",
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
      '- projections: for "overall" and every category, the rating you expect at season end if ' +
        "the user keeps their current trajectory (consistency, trends, decay). Be realistic; " +
        "weeks of effort move ratings by a few points, not dozens. Treat goal ratings as " +
        "intent, not evidence.",
      "- archetype: a new 2K-style build name and one-line description only if their overall " +
        "shape has clearly changed since the current archetype; otherwise null.",
      "- personalBadge: a playful, specific badge only for a genuinely notable achievement this " +
        "week (a first, a breakthrough, an unusual streak), not routine effort; usually null.",
      "- scoutingReport: the full updated report. Keep durable entries, add what this week " +
        "revealed, drop what's clearly stale. Map each priority to the node ref that measures " +
        "it, or null. If the user edited it last, keep their entries and only add.",
      `- weightShifts: at most ${MAX_WEIGHT_SHIFTS} small changes (within ±${Math.round(WEIGHT_SHIFT_CAP * 100)}% ` +
        "of a weight) where the Scouting Report and weeks of behavior agree a category or " +
        "attribute matters more or less than its weight says. Weights should settle, not " +
        "swing: don't reverse a recent shift and don't shift on a single week. Usually [].",
      `- treeChange: rarely, when allowed, 1-${MAX_TREE_CHANGES} changes: add_category (with ` +
        "2-4 attributes) for a core priority the tree doesn't measure, add_attribute to an " +
        "existing category for a clear gap, or remove a node the user has shown for weeks " +
        "they don't care about. The user approves it. Never propose renames or reshuffles. " +
        "Usually null.",
      "Refs: use the node refs exactly as given; never mention refs in text.",
    ].join("\n"),
    NEUTRAL_TONE,
  ].join("\n\n"),
};
