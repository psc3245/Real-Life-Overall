import {
  addDays,
  computeNodeValues,
  DECAY_LIMITS,
  draftToRatingNodes,
  DRAFT_ROOT_KEY,
  leafGrowthFromEvents,
  leafIds,
  leafValuesFromEvents,
  localDateIn,
  newLeafRatingsOutputSchema,
  SEASON_SETUP_DAYS,
  seasonForDate,
  type SeasonCardDto,
  type SeasonDto,
  type SeasonMode,
  type SeasonSetupDto,
  type TreeDraft,
} from "@rlo/shared";
import type { Database } from "../db/client";
import { conflict, notFound } from "../errors";
import type { LlmClient } from "../llm/client";
import { newLeafRatingsPrompt } from "../llm/prompts/seasons";
import { refsFor, renderTree, toPromptNodes } from "../llm/prompts/tree";
import * as decayRuleRepo from "../repos/decay-rule-repo";
import * as goalRepo from "../repos/goal-repo";
import * as onboardingRepo from "../repos/onboarding-repo";
import * as eventRepo from "../repos/rating-event-repo";
import * as nodeRepo from "../repos/rating-node-repo";
import * as seasonRepo from "../repos/season-repo";
import * as userRepo from "../repos/user-repo";

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const round = (n: number, places: number) => Math.round(n * 10 ** places) / 10 ** places;

function toCard(row: Awaited<ReturnType<typeof seasonRepo.findArchived>>[number]): SeasonCardDto {
  const snap = (row.finalSnapshot ?? {}) as Partial<SeasonCardDto>;
  return {
    id: row.id,
    label: row.label,
    startsOn: row.startsOn,
    endsOn: row.endsOn,
    mode: row.mode,
    overall: snap.overall ?? null,
    growth: snap.growth ?? null,
    archetype: snap.archetype ?? row.archetype,
    nodes: snap.nodes ?? [],
  };
}

/**
 * Rolls the user into the current calendar quarter if their active season has ended
 * (DESIGN.md §7.1): the old season is frozen into a season card, and the new one starts with
 * the same tree (same lineages), weights, decay rules, goals and mode, and ratings carried over
 * as recalibration events (growth starts again from 0). Safe to call on every request; returns
 * the active season.
 */
export async function ensureCurrentSeason(db: Database, userId: string): Promise<SeasonDto | null> {
  const active = await seasonRepo.findLatestActive(db, userId);
  if (!active) return null;
  const user = await userRepo.findById(db, userId);
  if (!user) return active;
  const today = localDateIn(user.timezone);
  const period = seasonForDate(today);
  if (active.label === period.label || active.endsOn >= today) return active;

  const old = await seasonRepo.findById(db, active.id);
  const nodes = await nodeRepo.findActiveWithLineage(db, active.id);
  const events = await eventRepo.findActiveBySeason(db, active.id);
  const leafValues = leafValuesFromEvents(events);
  const values = computeNodeValues(nodes, leafValues);
  const growth = computeNodeValues(nodes, leafGrowthFromEvents(events));
  const root = nodes.find((n) => n.parentId === null);
  const snapshot: Omit<SeasonCardDto, "id" | "label" | "startsOn" | "endsOn"> = {
    mode: active.mode,
    overall: root ? (values.get(root.id) ?? null) : null,
    growth: root ? (growth.get(root.id) ?? null) : null,
    archetype: old?.archetype ?? null,
    nodes: nodes.map((n) => ({
      id: n.id,
      lineageId: n.lineageId,
      parentId: n.parentId,
      name: n.name,
      depth: n.depth,
      value: values.get(n.id) ?? null,
      growth: growth.get(n.id) ?? null,
    })),
  };
  const leaves = new Set(leafIds(nodes));
  const [rules, goals] = await Promise.all([
    decayRuleRepo.findActiveByNodes(db, [...leaves]),
    goalRepo.findByNodes(
      db,
      nodes.map((n) => n.id),
    ),
  ]);

  await db.transaction(async (tx) => {
    if (!(await seasonRepo.archiveIfActive(tx, active.id, snapshot))) return; // already rolled
    const next = await seasonRepo.findOrCreate(tx, userId, period);
    // An onboarding visit may have pre-created this quarter in "setup"; start it clean.
    await nodeRepo.deleteBySeason(tx, next.id);
    await seasonRepo.update(tx, next.id, {
      status: "active",
      mode: active.mode,
      archetype: old?.archetype ?? null,
      archetypeDescription: old?.archetypeDescription ?? null,
      setupEndsOn: addDays(today, SEASON_SETUP_DAYS),
    });

    const ids = new Map(nodes.map((n) => [n.id, crypto.randomUUID()]));
    await nodeRepo.insertMany(
      tx,
      nodes.map((n) => ({
        id: ids.get(n.id)!,
        seasonId: next.id,
        userId,
        parentId: n.parentId ? ids.get(n.parentId)! : null,
        lineageId: n.lineageId,
        name: n.name,
        description: n.description,
        depth: n.depth,
        weight: n.weight,
        sortOrder: n.sortOrder,
        templateKey: n.templateKey,
      })),
    );
    await decayRuleRepo.insertMany(
      tx,
      rules.map((r) => ({
        nodeId: ids.get(r.nodeId)!,
        graceDays: r.graceDays,
        perDay: r.perDay,
        floor: r.floor,
        notes: r.notes,
        authoredBy: r.authoredBy,
      })),
    );
    for (const g of goals) await goalRepo.upsert(tx, ids.get(g.nodeId)!, g.targetValue);
    await eventRepo.insertMany(
      tx,
      [...leaves]
        .filter((id) => leafValues.has(id))
        .map((id) => ({
          nodeId: ids.get(id)!,
          seasonId: next.id,
          delta: leafValues.get(id)!,
          source: "recalibration" as const,
          reason: `Carried over from ${active.label}.`,
        })),
    );
    const session = await onboardingRepo.findOrCreate(tx, userId, next.id);
    await onboardingRepo.update(tx, session.id, { stage: "complete" });
  });
  return seasonRepo.findLatestActive(db, userId);
}

export async function listSeasonCards(db: Database, userId: string): Promise<SeasonCardDto[]> {
  await ensureCurrentSeason(db, userId);
  return (await seasonRepo.findArchived(db, userId)).map(toCard);
}

export async function getSeasonSetup(db: Database, userId: string): Promise<SeasonSetupDto> {
  const season = await ensureCurrentSeason(db, userId);
  if (!season) throw notFound("No active season");
  const [row, user, archived] = await Promise.all([
    seasonRepo.findById(db, season.id),
    userRepo.findById(db, userId),
    seasonRepo.findArchived(db, userId),
  ]);
  const today = localDateIn(user?.timezone ?? "UTC");
  const setupEndsOn = row?.setupEndsOn ?? null;
  const editable = setupEndsOn !== null && today <= setupEndsOn;
  return {
    label: season.label,
    mode: season.mode,
    modeEditable: editable,
    setupEndsOn,
    editable,
    previous: archived[0] ? toCard(archived[0]) : null,
  };
}

/**
 * Picks how a season is scored (DESIGN.md §4.6). Only while it's being set up, so nobody
 * switches to whichever mode looks better mid-season. Goals are in the old mode's units, so
 * switching clears them.
 */
export async function setSeasonMode(
  db: Database,
  seasonId: string,
  mode: SeasonMode,
): Promise<void> {
  const season = await seasonRepo.findById(db, seasonId);
  if (!season || season.mode === mode) return;
  const nodes = await nodeRepo.findActiveBySeason(db, seasonId);
  await db.transaction(async (tx) => {
    await seasonRepo.update(tx, seasonId, { mode });
    await goalRepo.deleteByNodes(
      tx,
      nodes.map((n) => n.id),
    );
  });
}

/** Changes the new season's mode during its setup window. */
export async function editSeasonMode(db: Database, userId: string, mode: SeasonMode) {
  const setup = await getSeasonSetup(db, userId);
  if (!setup.modeEditable) throw conflict("The mode is locked once the season is set up");
  const season = (await seasonRepo.findLatestActive(db, userId))!;
  await setSeasonMode(db, season.id, mode);
}

/**
 * Edits the new season's tree during its setup window. Draft keys that are existing node ids
 * update those nodes (keeping lineage and history); new keys create nodes; missing nodes are
 * archived. Rated attributes without a rating (new ones, or parents that became leaves) are then
 * rated by the model.
 */
export async function editSeasonTree(
  db: Database,
  llm: LlmClient,
  userId: string,
  draft: TreeDraft,
): Promise<void> {
  const setup = await getSeasonSetup(db, userId);
  if (!setup.editable) throw conflict("The season setup window has closed");
  const season = (await seasonRepo.findLatestActive(db, userId))!;
  const existing = await nodeRepo.findActiveWithLineage(db, season.id);
  const root = existing.find((n) => n.parentId === null)!;
  const byId = new Map(existing.map((n) => [n.id, n]));
  const ids = new Map<string, string>([[DRAFT_ROOT_KEY, root.id]]);
  for (const n of draft.nodes) ids.set(n.key, byId.has(n.key) ? n.key : crypto.randomUUID());
  const depths = new Map(draftToRatingNodes(draft.nodes).map((n) => [n.id, n.depth]));

  await db.transaction(async (tx) => {
    const kept = new Set(draft.nodes.map((n) => n.key));
    await nodeRepo.archiveNodes(
      tx,
      existing.filter((n) => n.parentId !== null && !kept.has(n.id)).map((n) => n.id),
    );
    // Parents before children so foreign keys resolve.
    const ordered = [...draft.nodes].sort((a, b) => depths.get(a.key)! - depths.get(b.key)!);
    for (const n of ordered) {
      const fields = {
        name: n.name,
        description: n.description,
        weight: n.weight,
        parentId: ids.get(n.parentKey ?? DRAFT_ROOT_KEY)!,
        depth: depths.get(n.key)!,
        sortOrder: draft.nodes.indexOf(n),
      };
      if (byId.has(n.key)) await nodeRepo.updateNode(tx, n.key, fields);
      else {
        await nodeRepo.insertMany(tx, [
          {
            id: ids.get(n.key)!,
            seasonId: season.id,
            userId,
            templateKey: n.templateKey,
            ...fields,
          },
        ]);
      }
    }
  });
  await rateUnratedLeaves(db, llm, userId, season.id);
}

/** Starting ratings and decay rules for active leaves that have no rating events yet. */
export async function rateUnratedLeaves(
  db: Database,
  llm: LlmClient,
  userId: string,
  seasonId: string,
): Promise<number> {
  const nodes = await nodeRepo.findActiveBySeason(db, seasonId);
  const events = await eventRepo.findActiveBySeason(db, seasonId);
  const rated = new Set(events.map((e) => e.nodeId));
  const unrated = leafIds(nodes).filter((id) => !rated.has(id));
  if (!unrated.length) return 0;

  const values = computeNodeValues(nodes, leafValuesFromEvents(events));
  const { refById, idByRef } = refsFor(nodes);
  const [profile, archived] = await Promise.all([
    userRepo.findProfileSummary(db, userId),
    seasonRepo.findArchived(db, userId),
  ]);
  const last = archived[0] ? toCard(archived[0]) : null;
  const output = await llm.generateStructured({
    purpose: "season.newLeaves",
    userId,
    schema: newLeafRatingsOutputSchema,
    system: newLeafRatingsPrompt.system,
    prompt: [
      `What you know about the user:\n${profile || "(nothing yet)"}`,
      last
        ? `Last season (${last.label}) final ratings:\n${last.nodes
            .filter((n) => n.depth > 0)
            .map((n) => `${"  ".repeat(n.depth - 1)}- ${n.name}: ${n.value?.toFixed(1) ?? "–"}`)
            .join("\n")}`
        : "Last season: (none)",
      "Current tree (Overall is the implicit root):",
      renderTree(toPromptNodes(nodes, refById, values), true),
      `Rate these refs: ${unrated.map((id) => refById.get(id)).join(", ")}`,
    ].join("\n\n"),
    promptVersion: newLeafRatingsPrompt.version,
  });

  const wanted = new Set(unrated);
  const seen = new Set<string>();
  const ratings = output.ratings.flatMap((r) => {
    const nodeId = idByRef.get(r.ref.trim());
    if (!nodeId || !wanted.has(nodeId) || seen.has(nodeId) || !Number.isFinite(r.value)) return [];
    seen.add(nodeId);
    const value = round(clamp(r.value, 0, 100), 1);
    const { graceDays, perDay } = DECAY_LIMITS;
    return [
      {
        nodeId,
        value,
        rationale: r.rationale.trim(),
        confidence: r.confidence,
        decay: {
          graceDays: Math.round(clamp(r.decayGraceDays, graceDays.min, graceDays.max)),
          perDay: round(clamp(r.decayPerDay, perDay.min, perDay.max), 2),
          floor: round(clamp(r.decayFloor, 0, value), 1),
        },
      },
    ];
  });
  await db.transaction(async (tx) => {
    await eventRepo.insertMany(
      tx,
      ratings.map((r) => ({
        nodeId: r.nodeId,
        seasonId,
        delta: r.value,
        source: "recalibration" as const,
        reason: r.rationale,
        evidence: { confidence: r.confidence },
      })),
    );
    await decayRuleRepo.insertMany(
      tx,
      ratings.map((r) => ({ nodeId: r.nodeId, ...r.decay, notes: "", authoredBy: "llm" as const })),
    );
  });
  return ratings.length;
}
