import {
  leafIds,
  linkSuggestionOutputSchema,
  localDateIn,
  normalizeHabitConfig,
  type HabitConfig,
  type HabitDto,
  type HabitType,
  type LinkSuggestionDto,
} from "@rlo/shared";
import type { z } from "zod";
import type { Database } from "../db/client";
import { badRequest, conflict, notFound } from "../errors";
import type { LlmClient } from "../llm/client";
import { suggestLinksPrompt } from "../llm/prompts/habits";
import { refsFor, toPromptNodes } from "../llm/prompts/tree";
import * as habitRepo from "../repos/habit-repo";
import type { HabitRow } from "../repos/habit-repo";
import * as nodeRepo from "../repos/rating-node-repo";
import * as seasonRepo from "../repos/season-repo";
import * as userRepo from "../repos/user-repo";
import type { createHabitBodySchema, updateHabitBodySchema } from "@rlo/shared";

/** The current season's rated attributes, with node ↔ lineage lookups for habit links. */
export async function loadLeafContext(db: Database, userId: string) {
  const season = await seasonRepo.findLatestActive(db, userId);
  if (!season) return null;
  const [nodes, lineages] = await Promise.all([
    nodeRepo.findActiveBySeason(db, season.id),
    nodeRepo.findLineages(db, season.id),
  ]);
  const leaves = new Set(leafIds(nodes));
  return {
    season,
    nodes,
    leaves,
    lineageByNode: new Map(lineages.map((l) => [l.id, l.lineageId])),
    nodeByLineage: new Map(lineages.map((l) => [l.lineageId, l.id])),
  };
}
type LeafContext = NonNullable<Awaited<ReturnType<typeof loadLeafContext>>>;

async function timezoneOf(db: Database, userId: string) {
  const user = await userRepo.findById(db, userId);
  if (!user) throw notFound("User not found");
  return user.timezone;
}

export function toHabitDto(row: HabitRow, lineageIds: string[], ctx: LeafContext | null): HabitDto {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    config: row.config as HabitConfig,
    days: [...row.days].sort(),
    links: lineageIds.map((l) => ctx?.nodeByLineage.get(l)).filter((id): id is string => !!id),
    sortOrder: row.sortOrder,
    startsOn: row.startsOn,
  };
}

/** Builds DTOs for many habits with one links query. */
export async function toHabitDtos(
  db: Database,
  rows: HabitRow[],
  ctx: LeafContext | null,
): Promise<HabitDto[]> {
  const links = await habitRepo.findLinks(
    db,
    rows.map((r) => r.id),
  );
  return rows.map((r) =>
    toHabitDto(
      r,
      links.filter((l) => l.habitId === r.id).map((l) => l.nodeLineageId),
      ctx,
    ),
  );
}

function linksToLineages(nodeIds: string[], ctx: LeafContext | null): string[] {
  const unique = [...new Set(nodeIds)];
  if (unique.length && !ctx) throw badRequest("Finish onboarding before linking habits");
  return unique.map((id) => {
    if (!ctx!.leaves.has(id)) throw badRequest(`Not a rated attribute: ${id}`);
    return ctx!.lineageByNode.get(id)!;
  });
}

export async function listHabits(db: Database, userId: string): Promise<HabitDto[]> {
  const [rows, ctx] = await Promise.all([
    habitRepo.findAllByUser(db, userId),
    loadLeafContext(db, userId),
  ]);
  return toHabitDtos(
    db,
    rows.filter((r) => !r.archivedAt),
    ctx,
  );
}

export async function createHabit(
  db: Database,
  userId: string,
  input: z.infer<typeof createHabitBodySchema>,
): Promise<HabitDto> {
  const [ctx, tz, existing] = await Promise.all([
    loadLeafContext(db, userId),
    timezoneOf(db, userId),
    habitRepo.findAllByUser(db, userId),
  ]);
  const lineages = linksToLineages(input.links, ctx);
  const row = await db.transaction(async (tx) => {
    const created = await habitRepo.insert(tx, {
      userId,
      name: input.name,
      type: input.type,
      config: normalizeHabitConfig(input.type, input.config),
      days: input.days,
      startsOn: input.startsOn ?? localDateIn(tz, new Date()),
      sortOrder: existing.length,
    });
    await habitRepo.replaceLinks(tx, created.id, lineages);
    return created;
  });
  return toHabitDto(row, lineages, ctx);
}

export async function updateHabit(
  db: Database,
  userId: string,
  habitId: string,
  input: z.infer<typeof updateHabitBodySchema>,
): Promise<HabitDto> {
  const habit = await habitRepo.findById(db, userId, habitId);
  if (!habit || habit.archivedAt) throw notFound("Habit not found");
  const ctx = await loadLeafContext(db, userId);
  const lineages = input.links ? linksToLineages(input.links, ctx) : null;

  const row = await db.transaction(async (tx) => {
    const updated = await habitRepo.update(tx, habit.id, {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.days !== undefined && { days: input.days }),
      ...(input.startsOn !== undefined && { startsOn: input.startsOn }),
      ...(input.config !== undefined && {
        config: normalizeHabitConfig(habit.type, {
          ...(habit.config as HabitConfig),
          ...input.config,
        }),
      }),
    });
    if (lineages) await habitRepo.replaceLinks(tx, habit.id, lineages);
    return updated;
  });
  const [dto] = await toHabitDtos(db, [row], ctx);
  return dto!;
}

/** Archived habits keep their history; they just stop appearing on new days. */
export async function archiveHabit(db: Database, userId: string, habitId: string) {
  const habit = await habitRepo.findById(db, userId, habitId);
  if (!habit) throw notFound("Habit not found");
  if (habit.archivedAt) throw conflict("Habit is already archived");
  await habitRepo.update(db, habit.id, { archivedAt: new Date() });
}

export async function suggestLinks(
  db: Database,
  llm: LlmClient,
  userId: string,
  input: { name: string; type: HabitType },
): Promise<LinkSuggestionDto> {
  const ctx = await loadLeafContext(db, userId);
  if (!ctx) throw conflict("Finish onboarding before linking habits");
  const { refById, idByRef } = refsFor(ctx.nodes);
  const output = await llm.generateStructured({
    purpose: "habits.suggestLinks",
    userId,
    schema: linkSuggestionOutputSchema,
    system: suggestLinksPrompt.system,
    prompt: suggestLinksPrompt.user({ ...input, nodes: toPromptNodes(ctx.nodes, refById) }),
    promptVersion: suggestLinksPrompt.version,
  });
  const nodeIds = [
    ...new Set(
      output.refs.map((r) => idByRef.get(r.trim())).filter((id) => id && ctx.leaves.has(id)),
    ),
  ].slice(0, 3) as string[];
  return { nodeIds, reason: output.reason.trim() };
}
