import {
  addDays,
  DEFAULT_IMPORTANCE,
  MAX_ASPIRATIONS,
  MAX_CONSTRAINTS,
  MAX_NEW_CATEGORY_ATTRIBUTES,
  MAX_NODE_DESCRIPTION_LENGTH,
  MAX_NODE_NAME_LENGTH,
  MAX_PRIORITIES,
  MAX_REPORT_FOCUSES,
  MAX_REPORT_LINE,
  MAX_TREE_CHANGES,
  MAX_TREE_NODES,
  MAX_WEIGHT_SHIFTS,
  parseScoutingReport,
  TREE_PROPOSAL_COOLDOWN_DAYS,
  TREE_PROPOSAL_SEASON_END_DAYS,
  WEIGHT_DRIFT,
  WEIGHT_SHIFT_CAP,
  type RatingNodeDto,
  type ScoutingReport,
  type ScoutingReportBody,
  type ScoutingReportDto,
  type TreeChangeDto,
  type TreeProposalDto,
  type WeightChangeDto,
  type WeightsDto,
  type scoutingReportOutputSchema,
  type treeChangeOutputSchema,
  type weightShiftsOutputSchema,
} from "@rlo/shared";
import type { z } from "zod";
import type { Database, Executor } from "../db/client";
import { conflict, notFound } from "../errors";
import type { LlmClient } from "../llm/client";
import * as evolutionRepo from "../repos/evolution-repo";
import type { TreeProposalRow, WeightChangeRow } from "../repos/evolution-repo";
import * as nodeRepo from "../repos/rating-node-repo";
import * as userRepo from "../repos/user-repo";
import { loadLeafContext, type LeafContext } from "./habit-service";
import { rateUnratedLeaves } from "./season-service";

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const round = (n: number, places: number) => Math.round(n * 10 ** places) / 10 ** places;
const daysBetween = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);

type Node = Pick<RatingNodeDto, "id" | "parentId" | "weight">;

/** Each node's share of its parent (0-100), from the given weights. */
export function sharesOf(nodes: Node[], weights = new Map(nodes.map((n) => [n.id, n.weight]))) {
  const totals = new Map<string | null, number>();
  for (const n of nodes) {
    totals.set(n.parentId, (totals.get(n.parentId) ?? 0) + (weights.get(n.id) ?? n.weight));
  }
  return new Map(
    nodes.map((n) => [
      n.id,
      round((100 * (weights.get(n.id) ?? n.weight)) / (totals.get(n.parentId) || 1), 1),
    ]),
  );
}

/** Weights at season start: each node's earliest recorded `fromWeight`, else its weight now. */
export function startWeights(nodes: Node[], changes: WeightChangeRow[]) {
  const start = new Map(nodes.map((n) => [n.id, n.weight]));
  // Newest first, so the last write per node is its earliest change.
  for (const c of changes) if (start.has(c.nodeId)) start.set(c.nodeId, c.fromWeight);
  return start;
}

// Scouting Report

function toReportDto(report: ScoutingReport, ctx: LeafContext | null): ScoutingReportDto {
  const names = new Map(ctx?.nodes.map((n) => [n.id, n.name]));
  return {
    ...report,
    priorities: report.priorities.map(({ lineageId, ...p }) => {
      const nodeId = (lineageId && ctx?.nodeByLineage.get(lineageId)) || null;
      return { ...p, nodeId, nodeName: nodeId ? (names.get(nodeId) ?? null) : null };
    }),
  };
}

export async function getScoutingReport(db: Database, userId: string) {
  const [report, ctx] = await Promise.all([
    userRepo.findScoutingReport(db, userId),
    loadLeafContext(db, userId),
  ]);
  return toReportDto(report, ctx);
}

/** The player's own edit replaces the report; the scout keeps their entries in later updates. */
export async function saveScoutingReport(
  db: Database,
  userId: string,
  body: ScoutingReportBody,
): Promise<ScoutingReportDto> {
  const ctx = await loadLeafContext(db, userId);
  const report: ScoutingReport = {
    aspirations: body.aspirations,
    priorities: body.priorities.map((p) => ({
      area: p.area,
      importance: p.importance,
      lineageId: (p.nodeId && ctx?.lineageByNode.get(p.nodeId)) || null,
      note: p.note,
    })),
    focuses: body.focuses,
    constraints: body.constraints,
    updatedAt: new Date().toISOString(),
    updatedBy: "user",
  };
  await userRepo.setScoutingReport(db, userId, report);
  return toReportDto(report, ctx);
}

/** The report as the model reads it, with node refs. */
export function renderScoutingReport(
  report: ScoutingReport,
  ctx: LeafContext,
  refById: Map<string, string>,
): string {
  const names = new Map(ctx.nodes.map((n) => [n.id, n.name]));
  const list = (items: string[]) => items.map((i) => `- ${i}`).join("\n") || "(none)";
  const priorities = report.priorities.map((p) => {
    const nodeId = p.lineageId ? ctx.nodeByLineage.get(p.lineageId) : undefined;
    const where = nodeId ? `[${refById.get(nodeId)}] ${names.get(nodeId)}` : "not in the tree";
    return `- ${p.area} (importance ${p.importance}/5, ${where})${p.note ? `: ${p.note}` : ""}`;
  });
  return [
    report.updatedBy === "user"
      ? `Last edited by the user on ${report.updatedAt?.slice(0, 10)}; keep their entries.`
      : report.updatedAt
        ? `Last updated by you on ${report.updatedAt.slice(0, 10)}.`
        : "Empty so far: build it from everything you know.",
    `Aspirations:\n${list(report.aspirations)}`,
    `Priorities:\n${priorities.join("\n") || "(none)"}`,
    `Current focuses:\n${list(report.focuses)}`,
    `Constraints:\n${list(report.constraints)}`,
  ].join("\n");
}

export function reportFromOutput(
  output: z.infer<typeof scoutingReportOutputSchema>,
  ctx: LeafContext,
  idByRef: Map<string, string>,
): ScoutingReport {
  const clean = (items: string[], max: number) =>
    [...new Set(items.map((s) => s.trim().slice(0, MAX_REPORT_LINE)).filter(Boolean))].slice(
      0,
      max,
    );
  const seen = new Set<string>();
  const priorities = output.priorities.flatMap((p) => {
    const area = p.area.trim().slice(0, MAX_NODE_NAME_LENGTH * 2);
    if (!area || seen.has(area.toLowerCase())) return [];
    seen.add(area.toLowerCase());
    const nodeId = p.ref ? idByRef.get(p.ref.trim()) : undefined;
    return [
      {
        area,
        importance: Math.round(clamp(Number.isFinite(p.importance) ? p.importance : 3, 1, 5)),
        lineageId: (nodeId && ctx.lineageByNode.get(nodeId)) || null,
        note: p.note.trim().slice(0, MAX_REPORT_LINE),
      },
    ];
  });
  return parseScoutingReport({
    aspirations: clean(output.aspirations, MAX_ASPIRATIONS),
    priorities: priorities.sort((a, b) => b.importance - a.importance).slice(0, MAX_PRIORITIES),
    focuses: clean(output.focuses, MAX_REPORT_FOCUSES),
    constraints: clean(output.constraints, MAX_CONSTRAINTS),
    updatedAt: new Date().toISOString(),
    updatedBy: "scout",
  });
}

// Weights

/** Current and season-start shares for the prompt, so the model sees how far weights moved. */
export function renderWeights(
  nodes: RatingNodeDto[],
  start: Map<string, number>,
  refById: Map<string, string>,
): string {
  const now = sharesOf(nodes);
  const then = sharesOf(nodes, start);
  const parentName = new Map(nodes.map((n) => [n.id, n.parentId === null ? "Overall" : n.name]));
  return nodes
    .filter((n) => n.parentId !== null)
    .map(
      (n) =>
        `- [${refById.get(n.id)}] ${n.name}: ${now.get(n.id)}% of ${parentName.get(n.parentId!)}` +
        (now.get(n.id) !== then.get(n.id) ? ` (season start ${then.get(n.id)}%)` : ""),
    )
    .join("\n");
}

export interface PlannedShift {
  nodeId: string;
  fromWeight: number;
  toWeight: number;
  fromShare: number;
  toShare: number;
  reason: string;
}

/** Caps each shift and keeps weights within their drift range of the season start. */
export function planWeightShifts(
  output: z.infer<typeof weightShiftsOutputSchema>,
  nodes: RatingNodeDto[],
  start: Map<string, number>,
  idByRef: Map<string, string>,
): PlannedShift[] {
  const weights = new Map(nodes.map((n) => [n.id, n.weight]));
  const nonRoot = new Set(nodes.filter((n) => n.parentId !== null).map((n) => n.id));
  const picked: { nodeId: string; reason: string }[] = [];
  for (const s of output) {
    const nodeId = idByRef.get(s.ref.trim());
    if (!nodeId || !nonRoot.has(nodeId) || picked.some((p) => p.nodeId === nodeId)) continue;
    if (!Number.isFinite(s.change) || picked.length >= MAX_WEIGHT_SHIFTS) continue;
    const current = weights.get(nodeId)!;
    const base = start.get(nodeId) ?? current;
    const next = round(
      clamp(
        current * (1 + clamp(s.change, -WEIGHT_SHIFT_CAP, WEIGHT_SHIFT_CAP)),
        base * WEIGHT_DRIFT.min,
        base * WEIGHT_DRIFT.max,
      ),
      4,
    );
    if (Math.abs(next - current) < 0.001) continue;
    weights.set(nodeId, next);
    picked.push({ nodeId, reason: s.reason.trim() });
  }
  const before = sharesOf(nodes);
  const after = sharesOf(nodes, weights);
  const original = new Map(nodes.map((n) => [n.id, n.weight]));
  return picked.map(({ nodeId, reason }) => ({
    nodeId,
    fromWeight: original.get(nodeId)!,
    toWeight: weights.get(nodeId)!,
    fromShare: before.get(nodeId)!,
    toShare: after.get(nodeId)!,
    reason,
  }));
}

export async function applyWeightShifts(
  tx: Executor,
  userId: string,
  seasonId: string,
  recapId: string,
  shifts: PlannedShift[],
) {
  for (const s of shifts) await nodeRepo.updateWeight(tx, seasonId, s.nodeId, s.toWeight);
  await evolutionRepo.insertWeightChanges(
    tx,
    shifts.map((s) => ({ ...s, userId, seasonId, recapId })),
  );
}

export function toWeightChangeDto(
  row: WeightChangeRow,
  names: Map<string, string>,
): WeightChangeDto {
  return {
    id: row.id,
    nodeId: row.nodeId,
    nodeName: names.get(row.nodeId) ?? "Removed",
    fromShare: row.fromShare,
    toShare: row.toShare,
    reason: row.reason,
    recapId: row.recapId,
    createdAt: row.createdAt.toISOString(),
    revertedAt: row.revertedAt?.toISOString() ?? null,
  };
}

export async function getWeights(db: Database, userId: string): Promise<WeightsDto> {
  const [ctx, user] = await Promise.all([
    loadLeafContext(db, userId),
    userRepo.findById(db, userId),
  ]);
  const adaptive = user?.preferences.features.adaptiveRating ?? true;
  if (!ctx) return { adaptive, nodes: [], changes: [] };
  const changes = await evolutionRepo.findWeightChangesBySeason(db, ctx.season.id);
  const start = startWeights(ctx.nodes, changes);
  const now = sharesOf(ctx.nodes);
  const then = sharesOf(ctx.nodes, start);
  const names = new Map(ctx.nodes.map((n) => [n.id, n.name]));
  return {
    adaptive,
    nodes: ctx.nodes
      .filter((n) => n.parentId !== null)
      .map((n) => ({
        nodeId: n.id,
        parentId: n.parentId,
        name: n.name,
        depth: n.depth,
        share: now.get(n.id)!,
        startShare: then.get(n.id)!,
      })),
    changes: changes.map((c) => toWeightChangeDto(c, names)),
  };
}

/** Undoes one shift by scaling the weight back by the same factor, so later shifts still hold. */
export async function undoWeightChange(
  db: Database,
  userId: string,
  id: string,
): Promise<WeightsDto> {
  const row = await evolutionRepo.findWeightChange(db, userId, id);
  if (!row) throw notFound("Weight change not found");
  if (row.revertedAt) throw conflict("Already undone");
  const ctx = await loadLeafContext(db, userId);
  const node = ctx?.nodes.find((n) => n.id === row.nodeId);
  if (!ctx || row.seasonId !== ctx.season.id || !node) {
    throw conflict("That change belongs to an earlier season or a removed attribute");
  }
  const changes = await evolutionRepo.findWeightChangesBySeason(db, ctx.season.id);
  const base = startWeights(ctx.nodes, changes).get(node.id) ?? node.weight;
  const weight = round(
    clamp(
      (node.weight * row.fromWeight) / row.toWeight,
      base * WEIGHT_DRIFT.min,
      base * WEIGHT_DRIFT.max,
    ),
    4,
  );
  await db.transaction(async (tx) => {
    if (!(await evolutionRepo.markReverted(tx, row.id))) throw conflict("Already undone");
    await nodeRepo.updateWeight(tx, ctx.season.id, node.id, weight);
  });
  return getWeights(db, userId);
}

// Tree proposals

/** Whether a weekly review may propose a tree change now (it should happen rarely). */
export async function canProposeTreeChange(
  db: Database,
  userId: string,
  ctx: LeafContext,
  today: string,
): Promise<boolean> {
  if (today > addDays(ctx.season.endsOn, -TREE_PROPOSAL_SEASON_END_DAYS)) return false;
  const latest = await evolutionRepo.findLatestProposal(db, userId);
  if (!latest) return true;
  if (latest.status === "pending" && latest.seasonId === ctx.season.id) return false;
  const madeOn = latest.createdAt.toISOString().slice(0, 10);
  return daysBetween(madeOn, today) >= TREE_PROPOSAL_COOLDOWN_DAYS;
}

const nameKey = (s: string) => s.trim().toLowerCase();

/**
 * Validates a proposed change set against the tree: additions go under Overall or an existing
 * category with attributes, nothing duplicates a sibling's name, and every category keeps at
 * least one attribute (remove the category instead).
 */
export function normalizeTreeChange(
  output: NonNullable<z.infer<typeof treeChangeOutputSchema>>,
  nodes: RatingNodeDto[],
  idByRef: Map<string, string>,
): TreeChangeDto[] {
  const root = nodes.find((n) => n.parentId === null);
  if (!root) return [];
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const childrenOf = (id: string) => nodes.filter((n) => n.parentId === id);
  const taken = new Map<string, Set<string>>(); // parent id -> sibling names in use
  const namesUnder = (id: string) => {
    if (!taken.has(id)) taken.set(id, new Set(childrenOf(id).map((n) => nameKey(n.name))));
    return taken.get(id)!;
  };
  const removed = new Set<string>();
  let added = 0;
  const out: TreeChangeDto[] = [];
  const text = (s: string | null, max: number) => (s ?? "").trim().slice(0, max);

  for (const c of output.changes) {
    if (out.length >= MAX_TREE_CHANGES) break;
    if (c.kind === "add_category") {
      const name = text(c.name, MAX_NODE_NAME_LENGTH);
      const attributes = c.attributes
        .map((a) => ({
          name: text(a.name, MAX_NODE_NAME_LENGTH),
          description: text(a.description, MAX_NODE_DESCRIPTION_LENGTH),
        }))
        .filter(
          (a, i, all) => a.name && all.findIndex((b) => nameKey(b.name) === nameKey(a.name)) === i,
        )
        .slice(0, MAX_NEW_CATEGORY_ATTRIBUTES);
      if (!name || !attributes.length || namesUnder(root.id).has(nameKey(name))) continue;
      if (nodes.length + added + 1 + attributes.length > MAX_TREE_NODES) continue;
      namesUnder(root.id).add(nameKey(name));
      added += 1 + attributes.length;
      out.push({
        kind: "add_category",
        name,
        description: text(c.description, MAX_NODE_DESCRIPTION_LENGTH),
        attributes,
      });
    } else if (c.kind === "add_attribute") {
      const parentId = c.ref ? idByRef.get(c.ref.trim()) : undefined;
      const parent = parentId ? byId.get(parentId) : undefined;
      const name = text(c.name, MAX_NODE_NAME_LENGTH);
      // Only under a category that already has attributes: a rated leaf can't become a parent.
      if (
        !parent ||
        parent.depth !== 1 ||
        !childrenOf(parent.id).length ||
        removed.has(parent.id)
      ) {
        continue;
      }
      if (!name || namesUnder(parent.id).has(nameKey(name))) continue;
      if (nodes.length + added + 1 > MAX_TREE_NODES) continue;
      namesUnder(parent.id).add(nameKey(name));
      added += 1;
      out.push({
        kind: "add_attribute",
        parentId: parent.id,
        parentName: parent.name,
        name,
        description: text(c.description, MAX_NODE_DESCRIPTION_LENGTH),
      });
    } else {
      const nodeId = c.ref ? idByRef.get(c.ref.trim()) : undefined;
      const node = nodeId ? byId.get(nodeId) : undefined;
      if (!node || node.parentId === null || removed.has(node.id) || removed.has(node.parentId)) {
        continue;
      }
      const remaining = childrenOf(node.parentId).filter(
        (n) => n.id !== node.id && !removed.has(n.id),
      );
      // Overall keeps a category; a category keeps an attribute.
      if (!remaining.length) continue;
      removed.add(node.id);
      out.push({ kind: "remove", nodeId: node.id, nodeName: node.name });
    }
  }
  return out;
}

export function toProposalDto(row: TreeProposalRow, seasonId: string | null): TreeProposalDto {
  return {
    id: row.id,
    reason: row.reason,
    changes: row.changes as TreeChangeDto[],
    // A pending proposal from an earlier season can't apply any more.
    status: row.status === "pending" && row.seasonId !== seasonId ? "expired" : row.status,
    recapId: row.recapId,
    createdAt: row.createdAt.toISOString(),
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
  };
}

export async function listTreeProposals(db: Database, userId: string) {
  const [rows, ctx] = await Promise.all([
    evolutionRepo.findProposalsByUser(db, userId),
    loadLeafContext(db, userId),
  ]);
  return rows.map((r) => toProposalDto(r, ctx?.season.id ?? null));
}

const mean = (values: number[]) =>
  values.length ? values.reduce((a, b) => a + b, 0) / values.length : DEFAULT_IMPORTANCE;

/** Applies an accepted change set: new nodes get their siblings' average weight. */
async function applyTreeChanges(
  tx: Executor,
  userId: string,
  ctx: LeafContext,
  changes: TreeChangeDto[],
) {
  const nodes = ctx.nodes;
  const root = nodes.find((n) => n.parentId === null)!;
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const childrenOf = (id: string) => nodes.filter((n) => n.parentId === id);
  const toArchive = new Set<string>();
  const descend = (id: string) => {
    toArchive.add(id);
    for (const c of childrenOf(id)) descend(c.id);
  };
  let order = nodes.length;
  for (const c of changes) {
    if (c.kind === "remove") {
      if (!byId.has(c.nodeId)) throw conflict(`${c.nodeName} is no longer in your tree`);
      descend(c.nodeId);
      continue;
    }
    const parentId = c.kind === "add_category" ? root.id : c.parentId;
    const parent = byId.get(parentId);
    if (!parent)
      throw conflict(
        `${c.kind === "add_attribute" ? c.parentName : "Overall"} is no longer in your tree`,
      );
    const siblings = childrenOf(parentId);
    if (siblings.some((s) => nameKey(s.name) === nameKey(c.name))) {
      throw conflict(`You already have ${c.name}`);
    }
    const id = crypto.randomUUID();
    await nodeRepo.insertMany(tx, [
      {
        id,
        seasonId: ctx.season.id,
        userId,
        parentId,
        name: c.name,
        description: c.description,
        depth: parent.depth + 1,
        weight: round(mean(siblings.map((s) => s.weight)), 4),
        sortOrder: order++,
      },
    ]);
    if (c.kind === "add_category") {
      await nodeRepo.insertMany(
        tx,
        c.attributes.map((a) => ({
          seasonId: ctx.season.id,
          userId,
          parentId: id,
          name: a.name,
          description: a.description,
          depth: parent.depth + 2,
          weight: DEFAULT_IMPORTANCE,
          sortOrder: order++,
        })),
      );
    }
  }
  await nodeRepo.archiveNodes(tx, [...toArchive]);
}

/**
 * Accepting applies the change set and rates the new attributes. If rating fails, accepting
 * again retries it.
 */
export async function resolveTreeProposal(
  db: Database,
  llm: LlmClient,
  userId: string,
  id: string,
  action: "accept" | "dismiss",
): Promise<TreeProposalDto> {
  const row = await evolutionRepo.findProposal(db, userId, id);
  if (!row) throw notFound("Proposal not found");
  const ctx = await loadLeafContext(db, userId);
  if (!ctx) throw conflict("Finish onboarding first");
  const dto = toProposalDto(row, ctx.season.id);
  if (dto.status === "accepted" && action === "accept" && row.seasonId === ctx.season.id) {
    await rateUnratedLeaves(db, llm, userId, ctx.season.id);
    return dto;
  }
  if (dto.status !== "pending") throw conflict(`This proposal is ${dto.status}`);

  if (action === "dismiss") {
    await evolutionRepo.resolveProposal(db, row.id, "dismissed");
  } else {
    await db.transaction(async (tx) => {
      if (!(await evolutionRepo.resolveProposal(tx, row.id, "accepted"))) {
        throw conflict("This proposal was already resolved");
      }
      await applyTreeChanges(tx, userId, ctx, dto.changes);
    });
    await rateUnratedLeaves(db, llm, userId, ctx.season.id);
  }
  const updated = await evolutionRepo.findProposal(db, userId, id);
  return toProposalDto(updated!, ctx.season.id);
}
