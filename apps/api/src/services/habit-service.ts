import {
  habitStats,
  isGroupDone,
  isHabitDone,
  leafIds,
  linkSuggestionOutputSchema,
  localDateIn,
  normalizeHabitConfig,
  statPeriod,
  type HabitConfig,
  type HabitDto,
  type HabitEntryValue,
  type HabitStatRange,
  type HabitStatsResponseDto,
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
    parentId: row.parentId,
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
  if (input.type === "group" && lineages.length) {
    throw badRequest("Link the group's sub-habits instead of the group");
  }
  // A sub-habit lives in a group and follows its schedule.
  let parent: HabitRow | undefined;
  if (input.parentId) {
    parent = existing.find((h) => h.id === input.parentId && !h.archivedAt);
    if (!parent || parent.type !== "group") throw badRequest("Sub-habits go inside a group");
    if (input.type === "group") throw badRequest("Groups can't contain other groups yet");
  }
  const row = await db.transaction(async (tx) => {
    const created = await habitRepo.insert(tx, {
      userId,
      name: input.name,
      type: input.type,
      config: normalizeHabitConfig(input.type, input.config),
      days: parent ? parent.days : input.days,
      startsOn: parent ? parent.startsOn : (input.startsOn ?? localDateIn(tz, new Date())),
      parentId: parent?.id ?? null,
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
  if (habit.type === "group" && lineages?.length) {
    throw badRequest("Link the group's sub-habits instead of the group");
  }
  // Sub-habits keep their group's schedule; the group's schedule flows down to them.
  const schedule = habit.parentId
    ? {}
    : {
        ...(input.days !== undefined && { days: input.days }),
        ...(input.startsOn !== undefined && { startsOn: input.startsOn }),
      };

  const row = await db.transaction(async (tx) => {
    if (habit.type === "group") await habitRepo.updateChildren(tx, habit.id, schedule);
    const updated = await habitRepo.update(tx, habit.id, {
      ...(input.name !== undefined && { name: input.name }),
      ...schedule,
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
  const archivedAt = new Date();
  await db.transaction(async (tx) => {
    await habitRepo.update(tx, habit.id, { archivedAt });
    if (habit.type === "group") await habitRepo.updateChildren(tx, habit.id, { archivedAt });
  });
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

/**
 * At-a-glance stats per active habit for the week, month or season containing `date` (default
 * today). Streaks look at each habit's whole history.
 */
export async function getHabitStats(
  db: Database,
  userId: string,
  range: HabitStatRange,
  date?: string,
): Promise<HabitStatsResponseDto> {
  const user = await userRepo.findById(db, userId);
  if (!user) throw notFound("User not found");
  const today = localDateIn(user.timezone);
  const period = statPeriod(range, date ?? today, user.weekStart);
  const habits = await listHabits(db, userId);
  const earliest = habits.reduce((min, h) => (h.startsOn < min ? h.startsOn : min), period.start);
  const rows = await habitRepo.findEntriesBetween(
    db,
    habits.map((h) => h.id),
    earliest,
    today > period.end ? today : period.end,
  );
  const byHabit = new Map<string, Map<string, HabitEntryValue>>();
  for (const r of rows) {
    if (!byHabit.has(r.habitId)) byHabit.set(r.habitId, new Map());
    byHabit.get(r.habitId)!.set(r.localDate, { num: r.valueNum, text: r.valueText });
  }
  // A group's "entry" each day is derived from its sub-habits: done by its rule, "2/3" to show.
  for (const group of habits.filter((h) => h.type === "group")) {
    const children = habits.filter((h) => h.parentId === group.id);
    const dates = new Set(children.flatMap((c) => [...(byHabit.get(c.id)?.keys() ?? [])]));
    const derived = new Map<string, HabitEntryValue>();
    for (const date of dates) {
      const done = children.map((c) => {
        const entry = byHabit.get(c.id)?.get(date);
        return entry ? isHabitDone(c.type, c.config, entry) : false;
      });
      derived.set(date, {
        num: isGroupDone(group.config, done) ? 1 : 0,
        text: `${done.filter(Boolean).length}/${children.length}`,
      });
    }
    byHabit.set(group.id, derived);
  }
  return {
    range,
    ...period,
    today,
    habits: habits.map((h) => habitStats(h, byHabit.get(h.id) ?? new Map(), period, today)),
  };
}
