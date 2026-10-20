import {
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
import { suggestAttributesPrompt, suggestWeightsPrompt } from "../llm/prompts/onboarding";
import * as onboardingRepo from "../repos/onboarding-repo";
import type { OnboardingSessionRow } from "../repos/onboarding-repo";
import * as nodeRepo from "../repos/rating-node-repo";
import * as seasonRepo from "../repos/season-repo";
import * as userRepo from "../repos/user-repo";

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
  };
}

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

  // Short refs instead of UUIDs: fewer tokens and fewer copying mistakes by the model.
  const refById = new Map(nodes.map((n, i) => [n.id, `n${i + 1}`]));
  const idByRef = new Map([...refById].map(([id, ref]) => [ref, id]));
  const output = await llm.generateStructured({
    purpose: "onboarding.weights",
    userId,
    schema: weightSuggestionOutputSchema,
    system: suggestWeightsPrompt.system,
    prompt: suggestWeightsPrompt.user({
      priorities,
      nodes: nodes.map((n) => ({
        ref: refById.get(n.id)!,
        parentRef: refById.get(n.parentId!) ?? null,
        name: n.name,
        description: n.description,
      })),
    }),
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
