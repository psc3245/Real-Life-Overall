import { MAX_FOLLOWUP_TURNS } from "@rlo/shared";
import { CALIBRATION_RUBRIC, NEUTRAL_TONE, PRODUCT_CONTEXT } from "./shared";
import { renderTree, type PromptNode } from "./tree";

export const suggestAttributesPrompt = {
  version: "suggest-attributes-v1",
  system: [
    PRODUCT_CONTEXT,
    "Given one category a user created, suggest 3 to 5 attributes that together cover it.",
    "Attributes must be distinct, measurable through everyday behavior, and phrased as short " +
      "noun names (1-3 words). Do not repeat attributes the user already has.",
    NEUTRAL_TONE,
  ].join("\n\n"),
  user: (input: { name: string; description: string; existing: string[] }) =>
    [
      `Category: ${input.name}`,
      input.description ? `Description: ${input.description}` : null,
      input.existing.length ? `Already has: ${input.existing.join(", ")}` : null,
    ]
      .filter(Boolean)
      .join("\n"),
};

export const suggestWeightsPrompt = {
  version: "suggest-weights-v2",
  system: [
    PRODUCT_CONTEXT,
    "Each node's weight sets how much it counts toward its parent, relative to its siblings. " +
      "Propose an importance from 1 (minor) to 10 (central) for every node listed, based on " +
      "what the user says matters to them. Without stated priorities, use balanced weights " +
      "with only modest differences.",
    "Importance only matters among siblings (nodes with the same parent). In the rationale, " +
      "explain the top-level categories first and never compare nodes that have different parents.",
    "Return exactly one entry per node ref. Use whole numbers.",
    NEUTRAL_TONE,
  ].join("\n\n"),
  user: (input: { priorities: string; nodes: PromptNode[] }) =>
    [
      `What matters to the user: ${input.priorities || "(not stated)"}`,
      "Rating tree (Overall is the implicit root):",
      renderTree(input.nodes),
    ].join("\n"),
};

export const questionnairePrompt = {
  version: "questionnaire-v2",
  system: [
    PRODUCT_CONTEXT,
    "Write a scouting questionnaire whose answers will be used to set the user's starting " +
      "rating for every rated attribute. Each question lists the refs of the rated attributes " +
      "it informs. Every rated attribute must be informed by at least one question, ideally two.",
    [
      "Good questions:",
      "- Ask about concrete, recent behavior and outcomes (e.g. the last 4 weeks), not self-ratings. " +
        'Prefer "How many days last week did you exercise for 20+ minutes?" over "How fit are you?".',
      "- Mix types: single_choice for frequency or level bands (3-6 options ordered low to high), " +
        "number for counts and amounts (give a unit), slider only when a scale is natural (give " +
        "labeled ends), multi_choice for checklists, short_text sparingly for context.",
      '- Never add a "None of these" option to multi_choice; the app provides one.',
      "- Are answerable in under 15 seconds each and are not repetitive.",
      "- Are respectful and do not demand sensitive specifics (exact salary, medical history); " +
        "use bands instead.",
    ].join("\n"),
    NEUTRAL_TONE,
  ].join("\n\n"),
  user: (input: { priorities: string | null; nodes: PromptNode[]; targetCount: number }) =>
    [
      `What matters to the user: ${input.priorities || "(not stated)"}`,
      "Rating tree (Overall is the implicit root):",
      renderTree(input.nodes, true),
      `Write about ${input.targetCount} questions in total.`,
    ].join("\n"),
};

export const followupPrompt = {
  version: "followup-v1",
  system: [
    PRODUCT_CONTEXT,
    "The user has answered a scouting questionnaire. Before their starting ratings are set, you " +
      "hold a short follow-up conversation. Ask ONE concise clarifying question at a time about " +
      "whatever would most change their ratings: gaps, vague answers, contradictions, or context " +
      "that numbers miss. Do not ask about things already answered clearly. Do not reveal or " +
      "guess ratings.",
    `Ask at most ${MAX_FOLLOWUP_TURNS - 1} questions. When you have enough information, set done ` +
      "to true and make reply a brief closing line thanking them.",
    NEUTRAL_TONE,
  ].join("\n\n"),
};

export const initialRatingsPrompt = {
  version: "initial-ratings-v1",
  system: [
    PRODUCT_CONTEXT,
    "You are setting the user's starting ratings from their scouting questionnaire and follow-up " +
      "conversation. Rate every rated attribute exactly once.",
    CALIBRATION_RUBRIC,
    [
      "How to rate:",
      "- Base each value on concrete evidence in the answers; cite it in the rationale.",
      "- Where corrections were made in the follow-up, use the corrected facts.",
      "- Where evidence is thin, stay near 50 and mark confidence low.",
      "- Be skeptical of implausible claims; weigh them lightly rather than rewarding them.",
      '- Rationales speak to the user ("you"), are specific, and never mention refs or this rubric.',
    ].join("\n"),
    [
      "Decay rules describe how each attribute fades without relevant activity:",
      "- Physical and habit-driven attributes fade faster (short grace, higher per-day loss).",
      "- Durable skills and knowledge fade slowly (long grace, low per-day loss).",
      "- The floor is where the attribute settles after long neglect: below the starting value, " +
        "usually 15-30 points lower.",
    ].join("\n"),
    "Also name the user's archetype, a 2K-style build label that captures their overall shape, " +
      "and write a short summary of strengths and gaps.",
    NEUTRAL_TONE,
  ].join("\n\n"),
};
