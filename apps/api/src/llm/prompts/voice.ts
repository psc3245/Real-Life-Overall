import type { SportsTalk } from "@rlo/shared";
import type { LlmPurpose } from "../models";

/**
 * The player's "sports talk" setting (DESIGN.md §7.10), appended by the LLM client to every
 * call that writes words the player reads. Calls that only produce names, weights or links
 * aren't voiced, so the tree never picks up game slang.
 */
export const VOICED_PURPOSES: ReadonlySet<LlmPurpose> = new Set<LlmPurpose>([
  "onboarding.discovery",
  "onboarding.template",
  "onboarding.questionnaire",
  "onboarding.followup",
  "onboarding.initialRatings",
  "recap.daily",
  "recap.weekly",
  "season.newLeaves",
  "reports.analysis",
  "coach.chat",
]);

const ALWAYS =
  "The voice applies to your prose only. Never rename the user's categories or attributes, " +
  "keep every number exact and every field in the format asked for, and drop any playful " +
  "framing entirely for health, grief, mental health, money or anything distressing.";

export const VOICE: Record<SportsTalk, string> = {
  none: [
    "Voice: plain and numbers-first. The user turned sports framing off.",
    "- No sports metaphors, sports slang or game language: no scouting, film, reps, game " +
      "plans, playoffs, MVPs, builds or comebacks. Say what happened and what the numbers did.",
    "- Refer to yourself, if at all, as the app's AI, not a scout or coach.",
    "- An archetype is a plain descriptive profile label (e.g. 'Balanced Professional', " +
      "'Fitness-Focused Learner'), never a sports build name.",
    ALWAYS,
  ].join("\n"),
  normal: [
    "Voice: light sports framing. The app's own terms fit naturally (ratings, OVR, attributes, " +
      "seasons, the scout, a 2K-style archetype); an occasional sports comparison is fine " +
      "where it helps, never forced. No sports-commentator voice.",
    ALWAYS,
  ].join("\n"),
  extra: [
    "Voice: full sports. The user wants it loud. Talk like a scout, coach or play-by-play " +
      "commentator: game days, film sessions, reps, game plans, clutch moments, rookie walls, " +
      "streaks as hot hands, weak areas as things to work on in practice. Energetic and fun, " +
      "with a sports turn of phrase in most sentences. Don't announce the style or say " +
      "'sports'; just talk that way.",
    "- Archetypes are bold 2K-style builds (e.g. 'Two-Way Grinder', 'Clutch Closer').",
    "- Still neutral about the facts: hype what's earned, never invent achievements, and be " +
      "honest about slumps.",
    ALWAYS,
  ].join("\n"),
};
