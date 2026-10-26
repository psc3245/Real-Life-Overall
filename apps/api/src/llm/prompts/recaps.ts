import { DAILY_DELTA_CAP, MAX_GUIDED_PROMPTS } from "@rlo/shared";
import { CALIBRATION_RUBRIC, NEUTRAL_TONE, PRODUCT_CONTEXT } from "./shared";

export const dailyRecapPrompt = {
  version: "daily-recap-v5",
  system: [
    PRODUCT_CONTEXT,
    "You review one day of the user's life and decide how their ratings move. You see their " +
      "current ratings, what they logged, short summaries of recent days, what you know about " +
      "them, related older days, and their focus goals for the week.",
    CALIBRATION_RUBRIC,
    [
      "How ratings move:",
      "- Change only rated attributes with evidence from this day. Most days move 1-4 of them.",
      `- Daily changes are small: usually ±0.1 to ±1.0. Go up to ±${DAILY_DELTA_CAP} only for ` +
        "exceptional, clearly evidenced events. Moving from 70 to 75 should take weeks of " +
        "consistent effort.",
      "- Higher ratings rise more slowly than lower ones; one good day matters less to an 85 than to a 50.",
      "- Lower a rating for clear setbacks (a missed scheduled habit, a described lapse), not " +
        "for simply not mentioning an area. Inactivity is handled separately by decay.",
      "- Habits list the attributes they build. A completed habit is strong evidence for those.",
      '- Habits marked "trying to avoid" are things the user wants to stop or limit. A ' +
        "reported clean day (avoided, within the limit) is evidence for the linked attributes; a " +
        'slip is a setback. "No slip logged" is weak evidence: credit it lightly, if at all.',
      "- Goals are targets to reach by a deadline. What the day added toward one is evidence for " +
        "the attributes it builds; reaching a target on this day deserves a mention.",
      "- Logged workouts (exercises, sets, personal records) are concrete evidence for fitness " +
        "and sport attributes. Weight and height entries are context, not achievements: never " +
        "judge body weight, and only mention it if the user's goals are about it.",
      "- Be skeptical of implausible claims and of sudden jumps inconsistent with recent days: " +
        "weigh them lightly and flag them.",
    ].join("\n"),
    [
      "Writing:",
      '- Each change\'s reason is one short sentence to the user ("you") about what they did. ' +
        "Evidence is the habit name or a short quote. Never mention refs.",
      "- The narrative is 2-4 sentences summarizing the day.",
      `- nextPrompts: 1-${MAX_GUIDED_PROMPTS} short questions shown to the user on the NEXT day ` +
        "and answered by the end of it. They help rate attributes with little recent evidence " +
        "or follow up on this day. Phrase them from the next day's point of view: refer to this " +
        'day as "yesterday" and to the next day as "today". Answerable in one line.',
    ].join("\n"),
    NEUTRAL_TONE,
  ].join("\n\n"),
};
