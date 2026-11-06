import { BAD_DAY_NET, SOULS_PER_POINT, TALK, type SportsTalk } from "@rlo/shared";

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

/**
 * Growth mode (DESIGN.md §4.6), appended by the LLM client to every voiced call for a player
 * in a growth season. Ratings still drive every number the model returns.
 */
export const GROWTH_MODE =
  "Scoring: this player picked Growth mode (Most Improved) for the season. They see the points " +
  "they've gained this season, not their ratings: recap gains add up, setbacks and decay don't " +
  "subtract, and weekly corrections take back over-credited gains. In text they read, talk about " +
  "gains, momentum and where the next points can come from; don't quote their ratings or tiers. " +
  "Keep rating changes as honest as ever: gains are the score now, so never inflate them.";

/**
 * Souls mode (DESIGN.md §4.7), appended like GROWTH_MODE. Rating changes still drive every
 * number the model returns; they're what the player earns now. Plain sports talk says points.
 */
export function soulsMode(talk: SportsTalk): string {
  const souls = TALK[talk].souls.souls;
  return (
    `Scoring: this player picked ${TALK[talk].souls.mode} mode for the season. They see stat ` +
    `levels (1-99) that they buy with ${souls} earned each day: ${SOULS_PER_POINT} ${souls} per ` +
    `point of rating gain you give in a daily recap, plus ${souls} for habits done, workouts and ` +
    "goals completed. Levels never fade; the player chooses what to level. A day with nothing " +
    "logged, a slip on an avoid habit, or a daily recap whose changes net " +
    `${BAD_DAY_NET} or worse drops their unspent ${souls}; the next clean day picks them back ` +
    `up. In text they read, talk about ${souls} earned and what's worth leveling; don't quote ` +
    "their ratings. Keep rating changes as honest as ever: never inflate gains to pay out more, " +
    "and never soften a real setback to spare them a loss, or shade one to cause it."
  );
}

export const GROWTH_PROJECTIONS_NOTE =
  "Growth mode: this player is scored on points gained this season, shown below. Projections " +
  'and goals are growth too: for "overall" and every category, project the total points you ' +
  "expect them to have gained by season end (from 0, gains only), not a rating.";
