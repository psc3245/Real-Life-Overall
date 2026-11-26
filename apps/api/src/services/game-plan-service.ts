import {
  addDays,
  gamePlanStatus,
  MAX_GAME_PLAN_DAYS,
  localDateIn,
  MAX_GAME_PLANS,
  type createGamePlanBodySchema,
  type GamePlanDto,
  type updateGamePlanBodySchema,
} from "@rlo/shared";
import type { z } from "zod";
import type { Database } from "../db/client";
import { badRequest, conflict, notFound } from "../errors";
import * as gamePlanRepo from "../repos/game-plan-repo";
import type { GamePlanRow } from "../repos/game-plan-repo";
import * as userRepo from "../repos/user-repo";
import { loadLeafContext, type LeafContext } from "./habit-service";

/** Game Plans (DESIGN.md §7.16): emphases for a stretch of time, with no numbers. */
function toDto(row: GamePlanRow, ctx: LeafContext | null, today: string): GamePlanDto {
  return {
    id: row.id,
    name: row.name,
    note: row.note,
    startsOn: row.startsOn,
    endsOn: row.endsOn,
    links: row.nodeLineageIds
      .map((l) => ctx?.nodeByLineage.get(l))
      .filter((id): id is string => !!id),
    status: gamePlanStatus(row, today),
  };
}

/** Any rated node, category or attribute, by lineage so the link survives seasons. */
function linksToLineages(nodeIds: string[], ctx: LeafContext | null): string[] {
  const unique = [...new Set(nodeIds)];
  if (unique.length && !ctx) throw badRequest("Finish onboarding before linking attributes");
  return unique.map((id) => {
    const lineage = ctx!.lineageByNode.get(id);
    if (!lineage) throw badRequest(`Not one of your attributes: ${id}`);
    return lineage;
  });
}

/** The window again, now that a missing start has become today. */
function checkWindow(startsOn: string, endsOn: string) {
  if (endsOn < startsOn) throw badRequest("The end must be on or after the start");
  if (endsOn > addDays(startsOn, MAX_GAME_PLAN_DAYS - 1)) {
    throw badRequest("A Game Plan can run for up to a year");
  }
}

async function today(db: Database, userId: string) {
  const user = await userRepo.findById(db, userId);
  if (!user) throw notFound("User not found");
  return localDateIn(user.timezone);
}

/** Every Game Plan not deleted: running and upcoming first, then ended, newest first. */
export async function listGamePlans(db: Database, userId: string): Promise<GamePlanDto[]> {
  const [rows, ctx, date] = await Promise.all([
    gamePlanRepo.findActiveByUser(db, userId),
    loadLeafContext(db, userId),
    today(db, userId),
  ]);
  const dtos = rows.map((r) => toDto(r, ctx, date));
  return [
    ...dtos.filter((p) => p.status !== "ended"),
    ...dtos.filter((p) => p.status === "ended").reverse(),
  ];
}

/** The Game Plans running on `date`, for the coach and the model's recaps and reviews. */
export async function gamePlansOn(db: Database, userId: string, date: string) {
  const [rows, ctx] = await Promise.all([
    gamePlanRepo.findActiveByUser(db, userId),
    loadLeafContext(db, userId),
  ]);
  return rows
    .map((r) => toDto(r, ctx, date))
    .filter((p) => p.status === "active")
    .map((p) => ({
      ...p,
      nodeNames: p.links.map((id) => ctx?.nodes.find((n) => n.id === id)?.name ?? ""),
    }));
}

/** How prompts introduce Game Plans, so every model call reads them the same way. */
export const GAME_PLANS_HEADING =
  "Game Plans (what the user chose to lean into for now; no numbers, so nothing to score, " +
  "but notice work that fits and point advice at them)";

/** One line per Game Plan for a prompt; empty when none are running. */
export function renderGamePlans(plans: Awaited<ReturnType<typeof gamePlansOn>>): string {
  return plans
    .map(
      (p) =>
        `- ${p.name} (through ${p.endsOn})` +
        (p.nodeNames.filter(Boolean).length
          ? `, leaning into ${p.nodeNames.filter(Boolean).join(", ")}`
          : "") +
        (p.note ? `: ${p.note}` : ""),
    )
    .join("\n");
}

export async function createGamePlan(
  db: Database,
  userId: string,
  input: z.infer<typeof createGamePlanBodySchema>,
): Promise<GamePlanDto> {
  const [ctx, date, rows] = await Promise.all([
    loadLeafContext(db, userId),
    today(db, userId),
    gamePlanRepo.findActiveByUser(db, userId),
  ]);
  if (rows.filter((r) => gamePlanStatus(r, date) !== "ended").length >= MAX_GAME_PLANS) {
    throw conflict(`Up to ${MAX_GAME_PLANS} Game Plans at a time; end or delete one first`);
  }
  const startsOn = input.startsOn ?? date;
  checkWindow(startsOn, input.endsOn);
  const row = await gamePlanRepo.insert(db, {
    userId,
    name: input.name,
    note: input.note,
    startsOn,
    endsOn: input.endsOn,
    nodeLineageIds: linksToLineages(input.links, ctx),
  });
  return toDto(row, ctx, date);
}

export async function updateGamePlan(
  db: Database,
  userId: string,
  id: string,
  input: z.infer<typeof updateGamePlanBodySchema>,
): Promise<GamePlanDto> {
  const existing = await gamePlanRepo.findById(db, userId, id);
  if (!existing || existing.archivedAt) throw notFound("Game Plan not found");
  const startsOn = input.startsOn ?? existing.startsOn;
  const endsOn = input.endsOn ?? existing.endsOn;
  checkWindow(startsOn, endsOn);
  const [ctx, date] = await Promise.all([loadLeafContext(db, userId), today(db, userId)]);
  const row = await gamePlanRepo.update(db, existing.id, {
    ...(input.name !== undefined && { name: input.name }),
    ...(input.note !== undefined && { note: input.note }),
    ...(input.links !== undefined && { nodeLineageIds: linksToLineages(input.links, ctx) }),
    startsOn,
    endsOn,
  });
  return toDto(row, ctx, date);
}

export async function deleteGamePlan(db: Database, userId: string, id: string) {
  const existing = await gamePlanRepo.findById(db, userId, id);
  if (!existing || existing.archivedAt) throw notFound("Game Plan not found");
  await gamePlanRepo.update(db, existing.id, { archivedAt: new Date() });
}
