import {
  followupOutputSchema,
  leafIds,
  MAX_FOLLOWUP_TURNS,
  unansweredRequired,
  validateAnswer,
  type Answers,
  type ChatMessageDto,
  type QuestionDto,
  type RatingNodeDto,
  attributeSuggestionOutputSchema,
  DEFAULT_IMPORTANCE,
  DRAFT_ROOT_KEY,
  draftToRatingNodes,
  IMPORTANCE_MAX,
  IMPORTANCE_MIN,
  localDateIn,
  MAX_NODE_NAME_LENGTH,
  seasonForDate,
  weightSuggestionOutputSchema,
  type AttributeSuggestionDto,
  type OnboardingStateDto,
  type TreeDraft,
  type WeightSuggestionDto,
} from "@rlo/shared";
import type { Database } from "../db/client";
import { badRequest, conflict, notFound } from "../errors";
import type { LlmClient } from "../llm/client";
import type { ModelMessage } from "ai";
import { renderAnswers } from "../llm/prompts/answers";
import {
  followupPrompt,
  initialRatingsPrompt,
  questionnairePrompt,
  suggestAttributesPrompt,
  suggestWeightsPrompt,
} from "../llm/prompts/onboarding";
import { refsFor, renderTree, toPromptNodes } from "../llm/prompts/tree";
import * as onboardingRepo from "../repos/onboarding-repo";
import type { OnboardingSessionRow } from "../repos/onboarding-repo";
import * as nodeRepo from "../repos/rating-node-repo";
import * as seasonRepo from "../repos/season-repo";
import * as userRepo from "../repos/user-repo";
import * as decayRuleRepo from "../repos/decay-rule-repo";
import * as eventRepo from "../repos/rating-event-repo";
import { initialRatingsSchemaFor, normalizeInitialRatings } from "./initial-ratings";
import { normalizeQuestions, questionnaireSchemaFor, targetQuestionCount } from "./questionnaire";

/** The tree and weights stay editable until the questionnaire is generated (structure locks). */
function isStructureEditable(session: OnboardingSessionRow): boolean {
  return (
    session.stage === "tree" ||
    session.stage === "weights" ||
    (session.stage === "questionnaire" && session.questionnaire === null)
  );
}

async function loadSession(db: Database, userId: string) {
  const user = await userRepo.findById(db, userId);
  if (!user) throw notFound("User not found");
  const period = seasonForDate(localDateIn(user.timezone));
  const season = await seasonRepo.findOrCreate(db, userId, period);
  const session = await onboardingRepo.findOrCreate(db, userId, season.id);
  return { season, session };
}

export async function getState(db: Database, userId: string): Promise<OnboardingStateDto> {
  const { season, session } = await loadSession(db, userId);
  return {
    stage: session.stage,
    season,
    priorities: session.priorities,
    weightRationale: session.weightRationale,
    nodes: await nodeRepo.findActiveBySeason(db, season.id),
    questionnaire: questionsOf(session),
    answers: answersOf(session),
    chat: chatOf(session),
  };
}

// jsonb columns are written only by this service, so their shapes are trusted on read.
const questionsOf = (s: OnboardingSessionRow) => s.questionnaire as QuestionDto[] | null;
const answersOf = (s: OnboardingSessionRow) => (s.answers ?? {}) as Answers;
const chatOf = (s: OnboardingSessionRow) => (s.chat ?? []) as ChatMessageDto[];

/** Replaces the season's whole tree. Safe because nothing is rated during onboarding. */
export async function saveTree(
  db: Database,
  userId: string,
  draft: TreeDraft,
): Promise<OnboardingStateDto> {
  const { season, session } = await loadSession(db, userId);
  if (!isStructureEditable(session)) throw conflict("The rating tree is locked for this season");

  const ids = new Map<string, string>([[DRAFT_ROOT_KEY, crypto.randomUUID()]]);
  for (const node of draft.nodes) ids.set(node.key, crypto.randomUUID());
  const depths = new Map(draftToRatingNodes(draft.nodes).map((n) => [n.id, n.depth]));

  const rows = [
    {
      id: ids.get(DRAFT_ROOT_KEY)!,
      seasonId: season.id,
      userId,
      parentId: null,
      name: "Overall",
      depth: 0,
    },
    ...draft.nodes.map((n, i) => ({
      id: ids.get(n.key)!,
      seasonId: season.id,
      userId,
      parentId: ids.get(n.parentKey ?? DRAFT_ROOT_KEY)!,
      name: n.name,
      description: n.description,
      depth: depths.get(n.key)!,
      weight: n.weight,
      sortOrder: i,
      templateKey: n.templateKey,
    })),
  ].sort((a, b) => a.depth - b.depth);

  await db.transaction(async (tx) => {
    await nodeRepo.deleteBySeason(tx, season.id);
    await nodeRepo.insertMany(tx, rows);
    await onboardingRepo.update(tx, session.id, { stage: "weights", weightRationale: null });
  });
  return getState(db, userId);
}

export async function suggestAttributes(
  llm: LlmClient,
  userId: string,
  input: { name: string; description: string; existing: string[] },
): Promise<AttributeSuggestionDto[]> {
  const output = await llm.generateStructured({
    purpose: "onboarding.suggestAttributes",
    userId,
    schema: attributeSuggestionOutputSchema,
    system: suggestAttributesPrompt.system,
    prompt: suggestAttributesPrompt.user(input),
    promptVersion: suggestAttributesPrompt.version,
  });
  const existing = new Set(input.existing.map((n) => n.toLowerCase()));
  return output.attributes
    .map((a) => ({
      name: a.name.trim().slice(0, MAX_NODE_NAME_LENGTH),
      description: a.description.trim(),
    }))
    .filter((a) => a.name && !existing.has(a.name.toLowerCase()))
    .slice(0, 5);
}

export async function suggestWeights(
  db: Database,
  llm: LlmClient,
  userId: string,
  priorities: string,
): Promise<WeightSuggestionDto> {
  const { season, session } = await loadSession(db, userId);
  if (!isStructureEditable(session)) throw conflict("Weights are locked for this season");
  const nodes = (await nodeRepo.findActiveBySeason(db, season.id)).filter((n) => n.parentId);
  if (!nodes.length) throw badRequest("Save a rating tree first");

  const { refById, idByRef } = refsFor(nodes);
  const output = await llm.generateStructured({
    purpose: "onboarding.weights",
    userId,
    schema: weightSuggestionOutputSchema,
    system: suggestWeightsPrompt.system,
    prompt: suggestWeightsPrompt.user({ priorities, nodes: toPromptNodes(nodes, refById) }),
    promptVersion: suggestWeightsPrompt.version,
  });

  const proposed = new Map<string, number>();
  for (const w of output.weights) {
    const id = idByRef.get(w.ref.trim());
    if (!id || !Number.isFinite(w.importance)) continue;
    proposed.set(id, Math.min(IMPORTANCE_MAX, Math.max(IMPORTANCE_MIN, Math.round(w.importance))));
  }
  const rationale = output.rationale.trim();
  await onboardingRepo.update(db, session.id, {
    priorities: priorities || null,
    weightRationale: rationale,
  });
  return {
    weights: nodes.map((n) => ({ nodeId: n.id, weight: proposed.get(n.id) ?? DEFAULT_IMPORTANCE })),
    rationale,
  };
}

export async function saveWeights(
  db: Database,
  userId: string,
  weights: { nodeId: string; weight: number }[],
): Promise<OnboardingStateDto> {
  const { season, session } = await loadSession(db, userId);
  if (!isStructureEditable(session)) throw conflict("Weights are locked for this season");

  await db.transaction(async (tx) => {
    for (const { nodeId, weight } of weights) {
      const updated = await nodeRepo.updateWeight(tx, season.id, nodeId, weight);
      if (!updated) throw badRequest(`Unknown node ${nodeId}`);
    }
    await onboardingRepo.update(tx, session.id, { stage: "questionnaire" });
  });
  return getState(db, userId);
}

export async function generateQuestionnaire(
  db: Database,
  llm: LlmClient,
  userId: string,
): Promise<OnboardingStateDto> {
  const { season, session } = await loadSession(db, userId);
  if (session.questionnaire !== null) return getState(db, userId); // idempotent
  if (session.stage !== "questionnaire") throw conflict("Set your weights first");

  const nodes = await nodeRepo.findActiveBySeason(db, season.id);
  const leaves = leafIds(nodes);
  const { refById, idByRef } = refsFor(nodes);
  const output = await llm.generateStructured({
    purpose: "onboarding.questionnaire",
    userId,
    schema: questionnaireSchemaFor(leaves.map((id) => refById.get(id)!)),
    system: questionnairePrompt.system,
    prompt: questionnairePrompt.user({
      priorities: session.priorities,
      nodes: toPromptNodes(nodes, refById),
      targetCount: targetQuestionCount(leaves.length),
    }),
    promptVersion: questionnairePrompt.version,
    maxOutputTokens: 16_000,
  });

  const questions = normalizeQuestions(output.questions, idByRef, new Set(leaves));
  // If a concurrent request already stored one, theirs wins and this result is discarded.
  await onboardingRepo.setQuestionnaireIfAbsent(db, session.id, questions);
  return getState(db, userId);
}

export async function saveAnswers(
  db: Database,
  userId: string,
  changes: Record<string, string | string[] | number | null>,
): Promise<OnboardingStateDto> {
  const { session } = await loadSession(db, userId);
  const questions = questionsOf(session);
  if (session.stage !== "questionnaire" || !questions) {
    throw conflict("The questionnaire is not open");
  }
  const byId = new Map(questions.map((q) => [q.id, q]));
  const answers = { ...answersOf(session) };
  for (const [questionId, value] of Object.entries(changes)) {
    const question = byId.get(questionId);
    if (!question) throw badRequest(`Unknown question ${questionId}`);
    if (value === null) {
      delete answers[questionId];
      continue;
    }
    const problem = validateAnswer(question, value);
    if (problem) throw badRequest(`${questionId}: ${problem}`);
    answers[questionId] = typeof value === "string" ? value.trim() : value;
  }
  await onboardingRepo.update(db, session.id, { answers });
  return getState(db, userId);
}

export async function submitQuestionnaire(
  db: Database,
  userId: string,
): Promise<OnboardingStateDto> {
  const { session } = await loadSession(db, userId);
  const questions = questionsOf(session);
  if (session.stage !== "questionnaire" || !questions) {
    throw conflict("The questionnaire is not open");
  }
  const missing = unansweredRequired(questions, answersOf(session));
  if (missing.length) throw badRequest(`${missing.length} question(s) still need an answer`);
  await onboardingRepo.update(db, session.id, { stage: "followup", chat: [] });
  return getState(db, userId);
}

/**
 * Advances the follow-up chat. With an empty chat this opens the conversation (no message);
 * afterwards each call carries the user's reply. Nothing is saved if the LLM call fails.
 */
export async function continueFollowup(
  db: Database,
  llm: LlmClient,
  userId: string,
  message: string | undefined,
): Promise<OnboardingStateDto> {
  const { season, session } = await loadSession(db, userId);
  if (session.stage !== "followup") throw conflict("The follow-up chat is not open");
  const chat = chatOf(session);
  if (chat.length === 0 && message) throw badRequest("The conversation has not started yet");
  if (chat.length > 0 && !message) throw badRequest("A message is required");

  const nodes = await nodeRepo.findActiveBySeason(db, season.id);
  const { refById } = refsFor(nodes);
  const context = scoutingContext(session, nodes, refById);

  const updated: ChatMessageDto[] = message ? [...chat, { role: "user", content: message }] : chat;
  const messages: ModelMessage[] = [
    { role: "user", content: context },
    ...updated.map((m): ModelMessage => ({ role: m.role, content: m.content })),
  ];
  const output = await llm.generateStructured({
    purpose: "onboarding.followup",
    userId,
    schema: followupOutputSchema,
    system: followupPrompt.system,
    prompt: messages,
    promptVersion: followupPrompt.version,
  });

  const final = [...updated, { role: "assistant" as const, content: output.reply.trim() }];
  const assistantTurns = final.filter((m) => m.role === "assistant").length;
  const done = output.done || assistantTurns >= MAX_FOLLOWUP_TURNS;
  await onboardingRepo.update(db, session.id, {
    chat: final,
    ...(done ? { stage: "rating" as const } : {}),
  });
  return getState(db, userId);
}

/** Everything the scout knows: priorities, the tree, and the questionnaire answers. */
function scoutingContext(
  session: OnboardingSessionRow,
  nodes: RatingNodeDto[],
  refById: Map<string, string>,
): string {
  return [
    `What matters to the user: ${session.priorities || "(not stated)"}`,
    "Rating tree (Overall is the implicit root):",
    renderTree(toPromptNodes(nodes, refById), true),
    "Questionnaire answers:",
    renderAnswers(questionsOf(session) ?? [], answersOf(session), refById),
  ].join("\n\n");
}

export async function finishFollowup(db: Database, userId: string): Promise<OnboardingStateDto> {
  const { session } = await loadSession(db, userId);
  if (session.stage !== "followup") throw conflict("The follow-up chat is not open");
  await onboardingRepo.update(db, session.id, { stage: "rating" });
  return getState(db, userId);
}

export interface OnboardingResult {
  summary: string;
  archetypeDescription: string;
}

/**
 * Sets starting ratings from the scouting report: one onboarding event per rated attribute
 * (the ledger starts at the rated value), LLM-authored decay rules, and the archetype.
 * Completing onboarding activates the season.
 */
export async function rateInitial(
  db: Database,
  llm: LlmClient,
  userId: string,
): Promise<OnboardingStateDto> {
  const { season, session } = await loadSession(db, userId);
  if (session.stage === "complete") return getState(db, userId);
  if (session.stage !== "rating") throw conflict("Finish scouting first");

  const nodes = await nodeRepo.findActiveBySeason(db, season.id);
  const leaves = leafIds(nodes);
  const { refById, idByRef } = refsFor(nodes);
  const transcript = chatOf(session)
    .map((m) => `${m.role === "user" ? "User" : "Scout"}: ${m.content}`)
    .join("\n");
  const output = await llm.generateStructured({
    purpose: "onboarding.initialRatings",
    userId,
    schema: initialRatingsSchemaFor(leaves.map((id) => refById.get(id)!)),
    system: initialRatingsPrompt.system,
    prompt: [
      scoutingContext(session, nodes, refById),
      `Follow-up conversation:\n${transcript || "(skipped)"}`,
    ].join("\n\n"),
    promptVersion: initialRatingsPrompt.version,
    maxOutputTokens: 16_000,
  });

  const ratings = normalizeInitialRatings(output, idByRef, new Set(leaves));
  const result: OnboardingResult = {
    summary: output.summary.trim(),
    archetypeDescription: output.archetype.description.trim(),
  };
  await db.transaction(async (tx) => {
    const won = await onboardingRepo.transitionStage(tx, session.id, "rating", "complete", {
      result,
    });
    if (!won) return; // A concurrent request already rated this season.
    await eventRepo.insertMany(
      tx,
      ratings.map((r) => ({
        nodeId: r.nodeId,
        seasonId: season.id,
        delta: r.value,
        source: "onboarding" as const,
        reason: r.rationale,
        evidence: { confidence: r.confidence },
      })),
    );
    await decayRuleRepo.insertMany(
      tx,
      ratings.map((r) => ({ nodeId: r.nodeId, ...r.decay, authoredBy: "llm" as const })),
    );
    await seasonRepo.update(tx, season.id, {
      status: "active",
      archetype: output.archetype.name.trim(),
    });
  });
  return getState(db, userId);
}
