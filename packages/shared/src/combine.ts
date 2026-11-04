import type { Answers, QuestionDto } from "./schemas/questionnaire";

/**
 * The Combine (DESIGN.md §5.1): starting ratings without the AI scout. Standard, behavior-anchored
 * questions with fixed scores, written for every template attribute, plus a generic set for custom
 * attributes. Scores follow the calibration rubric: 50 is a typical adult, 70 clearly above
 * average, 85 the top ~5% and 95 elite.
 */

/** [option label, score], ordered from least to most. */
type Option = readonly [string, number];

interface CombineQuestion {
  prompt: string;
  options: readonly Option[];
  /** Share of the attribute's rating relative to its other questions (default 1). */
  weight?: number;
}

const DAYS_A_WEEK = ["0", "1", "2-3", "4-5", "6-7"] as const;
const OFTEN = ["Rarely", "Monthly", "Weekly", "Several times a week", "Every day"] as const;
const COMPARED = ["Well below", "Below average", "About average", "Above average", "Far above"];

const scored = (labels: readonly string[], scores: readonly number[]): Option[] =>
  labels.map((label, i) => [label, scores[i]!] as const);

/** Template attribute key → its questions. */
export const COMBINE_QUESTIONS: Record<string, readonly CombineQuestion[]> = {
  "fitness.cardio": [
    {
      prompt: "In a typical week, how many days do you do 20+ minutes of cardio?",
      options: scored(DAYS_A_WEEK, [30, 45, 60, 75, 88]),
    },
    {
      prompt: "How far could you run or jog without stopping right now?",
      options: scored(
        ["I couldn't run a mile", "About a mile", "About 5k", "About 10k", "A half marathon+"],
        [30, 45, 62, 78, 92],
      ),
    },
  ],
  "fitness.strength": [
    {
      prompt: "How many days a week do you strength train?",
      options: scored(["0", "1", "2", "3-4", "5+"], [30, 48, 62, 76, 86]),
    },
    {
      prompt: "How many push-ups can you do in a row with good form?",
      options: scored(["0-5", "6-15", "16-30", "31-50", "50+"], [32, 48, 64, 80, 92]),
    },
  ],
  "fitness.mobility": [
    {
      prompt: "Standing with straight legs, how far down can you reach?",
      options: scored(
        ["Above my knees", "My shins", "My toes", "Fingertips on the floor", "Palms flat"],
        [30, 45, 58, 70, 85],
      ),
    },
    {
      prompt: "How often do you stretch or do yoga or mobility work?",
      options: scored(
        ["Never", "A few times a month", "Once a week", "2-3 times a week", "Most days"],
        [30, 45, 58, 72, 85],
      ),
    },
  ],
  "fitness.athleticism": [
    {
      prompt: "How often do you play a sport or do something that needs speed and agility?",
      options: scored(
        ["Never", "A few times a year", "Monthly", "Weekly", "Several times a week"],
        [30, 42, 55, 70, 84],
      ),
    },
    {
      prompt: "Against people your age in a pickup game or a sprint, you'd be…",
      options: scored(
        ["Well below most", "Below average", "About average", "Better than most", "The best"],
        [30, 42, 52, 70, 88],
      ),
    },
  ],
  "health.sleep": [
    {
      prompt: "On a typical night, how much sleep do you get?",
      options: scored(["Under 5 hours", "5-6 hours", "6-7 hours", "7-9 hours"], [25, 40, 55, 80]),
    },
    {
      prompt: "How many nights a week do you sleep and wake within an hour of your usual times?",
      options: scored(["0-1", "2-3", "4-5", "6", "Every night"], [30, 45, 62, 75, 88]),
    },
  ],
  "health.nutrition": [
    {
      prompt: "How many servings of fruit and vegetables do you eat on a typical day?",
      options: scored(["0", "1-2", "3-4", "5-6", "7+"], [25, 42, 60, 76, 88]),
    },
    {
      prompt: "How many meals a week are fast food, takeout or heavily processed?",
      options: scored(["10+", "6-9", "3-5", "1-2", "Almost none"], [25, 40, 55, 72, 86]),
    },
  ],
  "health.recovery": [
    {
      prompt: "How often do you feel stressed or run down?",
      options: scored(
        ["Almost always", "Most days", "A few days a week", "Now and then", "Rarely"],
        [25, 40, 55, 72, 85],
      ),
    },
    {
      prompt: "How many days a week do you take real downtime (no work, no chores) for an hour+?",
      options: scored(["0", "1-2", "3-4", "5-6", "Every day"], [30, 45, 60, 74, 84]),
    },
  ],
  "career.skills": [
    {
      prompt: "How would people in your field rate your skills?",
      options: scored(
        ["Still learning", "Competent", "Strong", "Among the best on my team", "Recognized expert"],
        [35, 52, 68, 82, 94],
      ),
    },
    {
      prompt:
        "Hours a week you spend deliberately getting better at your craft, beyond routine work?",
      options: scored(["0", "1-2", "3-5", "6-10", "10+"], [35, 50, 64, 78, 88]),
    },
  ],
  "career.output": [
    {
      prompt: "In a typical week, how often do you finish what you planned to get done?",
      options: scored(
        ["Rarely", "Sometimes", "About half the time", "Most weeks", "Almost always"],
        [30, 45, 55, 72, 86],
      ),
    },
    {
      prompt: "How does your output compare with your peers'?",
      options: scored(COMPARED, [30, 42, 52, 70, 86]),
    },
  ],
  "career.leadership": [
    {
      prompt: "How often do you lead projects, mentor or make calls others follow?",
      options: scored(
        ["Never", "Rarely", "Sometimes", "Often", "It's a core part of my role"],
        [30, 42, 55, 70, 84],
      ),
    },
    {
      prompt: "How many people regularly come to you for advice or direction at work?",
      options: scored(["None", "1-2", "3-5", "6-10", "More than 10"], [30, 48, 62, 76, 88]),
    },
  ],
  "career.growth": [
    {
      prompt: "In the last year, your career has…",
      options: scored(
        ["Gone backward", "Stalled", "Held steady", "Taken a clear step up", "Made a big leap"],
        [30, 42, 55, 72, 86],
      ),
    },
    {
      prompt: "Do you have a clear next step and a plan to get there?",
      options: scored(
        ["No idea yet", "A vague idea", "A clear goal, no plan", "A goal and a plan", "Working it"],
        [35, 48, 58, 72, 84],
      ),
    },
  ],
  "mind.learning": [
    {
      prompt: "How many books or courses have you finished in the last 3 months?",
      options: scored(["0", "1", "2-3", "4-6", "7+"], [32, 48, 62, 76, 88]),
    },
    {
      prompt: "How often do you learn something on purpose (reading, courses, practice)?",
      options: scored(OFTEN, [30, 45, 60, 75, 86]),
    },
  ],
  "mind.focus": [
    {
      prompt: "How long can you work on one hard task without checking your phone?",
      options: scored(
        ["Under 10 min", "10-20 min", "20-45 min", "45-90 min", "90+ min"],
        [28, 42, 56, 72, 86],
      ),
    },
    {
      prompt: "How much distraction-free deep work do you get on a typical day?",
      options: scored(
        ["Under 30 min", "30-60 min", "1-2 hours", "2-4 hours", "4+ hours"],
        [30, 45, 60, 76, 88],
      ),
    },
  ],
  "mind.discipline": [
    {
      prompt: "When you commit to something, how often do you follow through?",
      options: scored(
        ["Rarely", "Sometimes", "About half the time", "Usually", "Almost always"],
        [25, 42, 52, 72, 88],
      ),
    },
    {
      prompt: "How long have you kept up your most consistent habit?",
      options: scored(
        ["I don't have one", "A few weeks", "A few months", "About a year", "Several years"],
        [28, 42, 58, 72, 86],
      ),
    },
  ],
  "mind.composure": [
    {
      prompt: "When something goes wrong under pressure, you usually…",
      options: scored(
        [
          "Spiral or shut down",
          "Get thrown off for a while",
          "Get rattled, then recover",
          "Stay mostly calm",
          "Play your best",
        ],
        [28, 42, 56, 72, 86],
      ),
    },
    {
      prompt: "How often do your emotions get the better of you in ways you regret?",
      options: scored(
        ["Most days", "Weekly", "A few times a month", "Rarely", "Almost never"],
        [25, 42, 55, 74, 86],
      ),
    },
  ],
  "social.friendships": [
    {
      prompt: "How many close friends could you call in a crisis?",
      options: scored(["0", "1", "2-3", "4-5", "6+"], [25, 42, 60, 75, 86]),
    },
    {
      prompt: "How often do you spend real time with friends (in person or a long call)?",
      options: scored(
        ["Rarely", "Monthly", "Every couple of weeks", "Weekly", "Several times a week"],
        [30, 45, 58, 74, 86],
      ),
    },
  ],
  "social.family": [
    {
      prompt: "How often are you in touch with the family you care about?",
      options: scored(
        ["Rarely", "A few times a year", "Monthly", "Weekly", "Most days"],
        [30, 40, 55, 72, 84],
      ),
    },
    {
      prompt: "How would you describe those relationships?",
      options: scored(
        ["Strained", "Distant", "Fine", "Close", "Very close and supportive"],
        [30, 42, 55, 74, 88],
      ),
    },
  ],
  "social.romance": [
    {
      prompt: "How satisfied are you with your love life right now?",
      options: scored(
        ["Very unsatisfied", "Somewhat unsatisfied", "Neutral", "Satisfied", "Very satisfied"],
        [30, 42, 52, 70, 86],
      ),
    },
    {
      prompt: "Quality time with your partner, or if you're single, dates and meeting people:",
      options: scored(
        ["Rarely", "Monthly", "Every couple of weeks", "Weekly", "Several times a week"],
        [32, 45, 58, 72, 84],
      ),
    },
  ],
  "social.network": [
    {
      prompt: "How many new people did you meet in the last month?",
      options: scored(["0", "1-2", "3-5", "6-10", "More than 10"], [30, 45, 60, 74, 86]),
    },
    {
      prompt: "How involved are you in a community (a team, club, church or group)?",
      options: scored(
        ["Not at all", "I show up now and then", "I'm a regular", "I help run it", "I'm a pillar"],
        [30, 45, 60, 76, 88],
      ),
    },
  ],
  "finance.income": [
    {
      prompt: "How does your income compare with others your age where you live?",
      options: scored(COMPARED, [32, 44, 52, 68, 85]),
    },
    {
      prompt: "Over the last 2 years, your income has…",
      options: scored(
        ["Dropped", "Stayed flat", "Grown a little", "Grown a lot", "More than doubled"],
        [35, 48, 58, 72, 86],
      ),
    },
  ],
  "finance.saving": [
    {
      prompt: "How many months of expenses could your savings cover?",
      options: scored(
        ["Less than 1", "1-2", "3-5", "6-11", "A year or more"],
        [28, 45, 62, 76, 88],
      ),
    },
    {
      prompt: "What share of your income do you save each month?",
      options: scored(["Nothing", "Under 5%", "5-10%", "10-20%", "Over 20%"], [28, 42, 56, 72, 86]),
    },
  ],
  "finance.budgeting": [
    {
      prompt: "How well do you know where your money went last month?",
      options: scored(
        ["No idea", "Roughly", "Most of it", "To the dollar", "Every category, against a plan"],
        [28, 45, 58, 76, 86],
      ),
    },
    {
      prompt: "How often do you carry credit card debt from month to month?",
      options: scored(
        ["Always, and it's growing", "Always", "Sometimes", "Rarely", "Never"],
        [25, 38, 52, 70, 84],
      ),
    },
  ],
  "finance.investing": [
    {
      prompt: "How much are you investing for the long term (retirement, index funds)?",
      options: scored(
        [
          "Nothing",
          "I've just started",
          "A little now and then",
          "A set amount monthly",
          "The max",
        ],
        [30, 45, 58, 72, 88],
      ),
    },
    {
      prompt: "How well do you understand how your investments work?",
      options: scored(
        ["I don't have any", "Not at all", "Somewhat", "Pretty well", "I manage them myself"],
        [30, 40, 54, 70, 84],
      ),
    },
  ],
  "creativity.output": [
    {
      prompt: "How often do you make something (writing, art, music, code, crafts)?",
      options: scored(OFTEN, [30, 45, 60, 75, 88]),
    },
    {
      prompt: "How many things have you finished and shared in the last 3 months?",
      options: scored(["0", "1", "2-3", "4-9", "10+"], [32, 48, 62, 76, 88]),
    },
  ],
  "creativity.craft": [
    {
      prompt: "How would you describe your skill in your main medium?",
      options: scored(
        ["Beginner", "Hobbyist", "Skilled amateur", "Semi-pro", "Professional"],
        [35, 50, 64, 78, 92],
      ),
    },
    {
      prompt: "How far has your work reached?",
      options: scored(
        [
          "Nobody's seen it",
          "Friends and family",
          "Shared publicly, good feedback",
          "Paid or published now and then",
          "Paid or published regularly",
        ],
        [40, 50, 62, 76, 90],
      ),
    },
  ],
  "creativity.exploration": [
    {
      prompt: "How often do you try a new technique, style or medium?",
      options: scored(
        ["Never", "Once a year", "A few times a year", "Monthly", "All the time"],
        [30, 42, 55, 70, 84],
      ),
    },
    {
      prompt: "Compared with a year ago, your work is…",
      options: scored(
        [
          "Not much to compare",
          "Pretty much the same",
          "A bit different",
          "Clearly evolved",
          "New directions",
        ],
        [32, 45, 56, 72, 84],
      ),
    },
  ],
};

/** For attributes without their own questions; `{name}` is the attribute's name. */
const GENERIC_QUESTIONS: readonly CombineQuestion[] = [
  {
    prompt: "In the last two weeks, how many days did you actively work on {name}?",
    options: scored(["0", "1-3", "4-7", "8-11", "12-14"], [30, 45, 58, 72, 85]),
  },
  {
    prompt: "Compared with a typical adult, where are you at {name}?",
    options: scored(
      ["Well below", "Below average", "About average", "Clearly above", "Top 5% or better"],
      [30, 42, 50, 70, 86],
    ),
  },
  {
    prompt: "Over the past 3 months, {name} has…",
    options: scored(
      ["Gotten worse", "Stayed the same", "Improved a little", "Improved a lot"],
      [40, 50, 56, 64],
    ),
    weight: 0.5,
  },
];

interface CombineLeaf {
  id: string;
  name: string;
  templateKey: string | null;
}

const questionsFor = (leaf: CombineLeaf) =>
  (leaf.templateKey && COMBINE_QUESTIONS[leaf.templateKey]) || GENERIC_QUESTIONS;

/** The Combine questionnaire for a tree's leaves, in tree order; ids are c1, c2, … */
export function buildCombineQuestionnaire(leaves: CombineLeaf[]): QuestionDto[] {
  return leaves
    .flatMap((leaf) => questionsFor(leaf).map((q) => ({ leaf, q })))
    .map(({ leaf, q }, i) => ({
      id: `c${i + 1}`,
      nodeIds: [leaf.id],
      type: "single_choice" as const,
      prompt: q.prompt.replaceAll("{name}", leaf.name),
      options: q.options.map(([label]) => label),
      min: null,
      max: null,
      minLabel: null,
      maxLabel: null,
      unit: null,
    }));
}

export interface CombineRating {
  nodeId: string;
  value: number;
  /** Never "high": standard questions know less than the scout's conversation. */
  confidence: "low" | "medium";
  rationale: string;
}

/**
 * Scores each leaf as the weighted mean of its answered questions; unanswered leaves get 50.
 * A leaf's questions in the stored questionnaire line up with its bank entries by order.
 */
export function scoreCombine(
  leaves: CombineLeaf[],
  questionnaire: QuestionDto[],
  answers: Answers,
): CombineRating[] {
  return leaves.map((leaf) => {
    const bank = questionsFor(leaf);
    const asked = questionnaire.filter((q) => q.nodeIds[0] === leaf.id);
    let total = 0;
    let weights = 0;
    const picked: string[] = [];
    asked.forEach((question, i) => {
      const q = bank[i];
      const option = q?.options.find(([label]) => label === answers[question.id]);
      if (!q || !option) return;
      const weight = q.weight ?? 1;
      total += option[1] * weight;
      weights += weight;
      picked.push(option[0]);
    });
    if (!weights) {
      return {
        nodeId: leaf.id,
        value: 50,
        confidence: "low",
        rationale: "No Combine answers, so it starts at a typical 50. Recaps move it from here.",
      };
    }
    return {
      nodeId: leaf.id,
      value: Math.round((total / weights) * 10) / 10,
      confidence: bank === GENERIC_QUESTIONS ? "low" : "medium",
      rationale: `From your Combine answers: ${picked.join(" · ")}.`,
    };
  });
}

/** Default decay by template category: [grace days, points per day]. */
const CATEGORY_DECAY: Record<string, readonly [number, number]> = {
  fitness: [3, 0.25],
  health: [2, 0.2],
  career: [7, 0.1],
  mind: [4, 0.15],
  social: [5, 0.15],
  finance: [14, 0.05],
  creativity: [5, 0.15],
};

/** Decay for a Combine-rated leaf: by its template category, never below 15 under its start. */
export function combineDecay(templateKey: string | null, value: number) {
  const [graceDays, perDay] = CATEGORY_DECAY[templateKey?.split(".")[0] ?? ""] ?? [5, 0.15];
  return { graceDays, perDay, floor: Math.max(0, Math.round((value - 15) * 10) / 10) };
}

/** [modifier, noun] per template category, for archetype names like "Cerebral Athlete". */
const ARCHETYPE_WORDS: Record<string, readonly [string, string]> = {
  fitness: ["Athletic", "Athlete"],
  health: ["Durable", "Iron Man"],
  career: ["Driven", "Pro"],
  mind: ["Cerebral", "Scholar"],
  social: ["Connected", "Floor General"],
  finance: ["Savvy", "Dealmaker"],
  creativity: ["Creative", "Playmaker"],
};

/**
 * A rule-based archetype from category ratings, best first: the top category's noun with the
 * runner-up's modifier, "Two-Way" when they're neck and neck, "Balanced" when three or more are.
 */
export function combineArchetype(
  categories: { name: string; templateKey: string | null; value: number }[],
): { name: string; description: string } {
  const ranked = [...categories].sort((a, b) => b.value - a.value);
  const [top, next] = ranked;
  const last = ranked.at(-1);
  if (!top) return { name: "All-Rounder", description: "A fresh build. Recaps fill it in." };
  const words = (c: { templateKey: string | null }) =>
    ARCHETYPE_WORDS[c.templateKey ?? ""] ?? (["Balanced", "All-Rounder"] as const);
  const spread = last ? top.value - last.value : 0;
  const name =
    ranked.length > 2 && spread < 4
      ? "Balanced All-Rounder"
      : !next
        ? words(top)[1]
        : top.value - next.value < 2
          ? `Two-Way ${words(top)[1]}`
          : `${words(next)[0]} ${words(top)[1]}`;
  const parts = [`Best area: ${top.name} (${top.value.toFixed(0)}).`];
  if (next) parts.push(`Next: ${next.name} (${next.value.toFixed(0)}).`);
  if (last && ranked.length > 2) {
    parts.push(`Most room to grow: ${last.name} (${last.value.toFixed(0)}).`);
  }
  return { name, description: parts.join(" ") };
}
