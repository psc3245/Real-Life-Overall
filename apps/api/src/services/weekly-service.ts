import {
  WEEKDAY_SHORT,
  addDays,
  computeNodeValues,
  dayOfWeek,
  DECAY_LIMITS,
  HABIT_TYPE_LABELS,
  isHabitDone,
  lastCompletedWeek,
  growthDelta,
  leafGrowthFromEvents,
  leafScoresFromEvents,
  leafValuesFromEvents,
  localDateIn,
  MAX_DECAY_REVISIONS,
  MAX_FOCUS_GOALS,
  MAX_HABIT_LINKS,
  MAX_HABIT_PROPOSALS,
  MAX_PERSONAL_BADGES_PER_SEASON,
  MAX_PROFILE_SUMMARY,
  normalizeHabitConfig,
  WEEKLY_DELTA_CAP,
  weeklyReviewOutputSchema,
  type DecayRevisionDto,
  type EarnedBadgeDto,
  type FocusGoalDto,
  type HabitConfig,
  type HabitDto,
  type HabitProposalDto,
  type RatingNodeDto,
  type SeasonMode,
  type TreeProposalDto,
  type WeightChangeDto,
  type WeeklyReviewDto,
  type WeeklyStateDto,
  type WeekRange,
} from "@rlo/shared";
import type { z } from "zod";
import type { Database } from "../db/client";
import { badRequest, conflict, isUniqueViolation, notFound } from "../errors";
import type { LlmClient } from "../llm/client";
import { refsFor, renderTree, toPromptNodes } from "../llm/prompts/tree";
import { GROWTH_PROJECTIONS_NOTE } from "../llm/prompts/shared";
import { weeklyReviewPrompt } from "../llm/prompts/weekly";
import * as decayRepo from "../repos/decay-repo";
import * as evolutionRepo from "../repos/evolution-repo";
import * as dayRepo from "../repos/day-repo";
import * as decayRuleRepo from "../repos/decay-rule-repo";
import * as habitRepo from "../repos/habit-repo";
import * as badgeRepo from "../repos/badge-repo";
import * as goalRepo from "../repos/goal-repo";
import * as eventRepo from "../repos/rating-event-repo";
import * as nodeRepo from "../repos/rating-node-repo";
import * as seasonRepo from "../repos/season-repo";
import * as recapRepo from "../repos/recap-repo";
import type { RecapRow } from "../repos/recap-repo";
import * as userRepo from "../repos/user-repo";
import { createHabit, loadLeafContext } from "./habit-service";
import { awardBadges, badgesByRecap } from "./badge-service";
import { datedEvents, type DatedEvent } from "./event-dates";
import { ensureCurrentSeason } from "./season-service";
import { renderMemories, searchMemories } from "./memory-service";
import { normalizeRecapChanges } from "./recap-changes";
import {
  applyWeightShifts,
  canProposeTreeChange,
  normalizeTreeChange,
  planWeightShifts,
  renderScoutingReport,
  renderWeights,
  reportFromOutput,
  startWeights,
  toProposalDto,
  toWeightChangeDto,
} from "./evolution-service";

type Output = z.infer<typeof weeklyReviewOutputSchema>;
type LeafContext = NonNullable<Awaited<ReturnType<typeof loadLeafContext>>>;

/** What a weekly recap row keeps in `output`. */
interface WeeklyOutput {
  focusGoals: FocusGoalDto[];
  habitProposals: HabitProposalDto[];
  decayRevisions: Omit<DecayRevisionDto, "nodeName">[];
  /** Season-end projections for Overall and categories (absent on older reviews). */
  projections?: { nodeId: string; value: number }[];
  /** The mode the projections are in (absent: ratings, from before growth mode). */
  mode?: SeasonMode;
  archetypeChange?: WeeklyReviewDto["archetypeChange"];
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const round = (n: number, places: number) => Math.round(n * 10 ** places) / 10 ** places;
const daysBetween = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);

/** The last finished week, if the user had been onboarded by its end. */
async function reviewableWeek(db: Database, userId: string, ctx: LeafContext) {
  const user = await userRepo.findById(db, userId);
  if (!user) throw notFound("User not found");
  const onboarded = await decayRepo.onboardedAt(db, ctx.season.id);
  if (!onboarded) return { user, week: null };
  const week = lastCompletedWeek(localDateIn(user.timezone), user.weekStart);
  return { user, week: localDateIn(user.timezone, onboarded) <= week.end ? week : null };
}

function overallOf(nodes: RatingNodeDto[], events: DatedEvent[], mode: SeasonMode) {
  const root = nodes.find((n) => n.parentId === null);
  if (!root) return null;
  return computeNodeValues(nodes, leafScoresFromEvents(mode, events)).get(root.id) ?? null;
}

export function toWeeklyDto(
  recap: RecapRow,
  nodes: RatingNodeDto[],
  events: DatedEvent[],
  mode: SeasonMode,
  badges: EarnedBadgeDto[] = [],
  evolution: Evolution = NO_EVOLUTION,
): WeeklyReviewDto {
  const output = recap.output as WeeklyOutput;
  const names = new Map(nodes.map((n) => [n.id, n.name]));
  const asOf = (date: string, exclusive: boolean) =>
    events.filter((e) => e.date === null || (exclusive ? e.date < date : e.date <= date));
  const after = leafScoresFromEvents(mode, asOf(recap.periodEnd, false));
  return {
    id: recap.id,
    weekStart: recap.periodStart,
    weekEnd: recap.periodEnd,
    narrative: recap.narrative,
    mode,
    overallStart: overallOf(nodes, asOf(recap.periodStart, true), mode),
    overallEnd: overallOf(nodes, asOf(recap.periodEnd, false), mode),
    corrections: events
      .filter((e) => e.recapId === recap.id)
      .map((e) => ({
        nodeId: e.nodeId,
        nodeName: names.get(e.nodeId) ?? "Unknown",
        delta: e.delta,
        growth: growthDelta(e),
        reason: e.reason,
        evidence: null,
        valueAfter: after.get(e.nodeId) ?? 0,
      })),
    decayRevisions: output.decayRevisions.map((d) => ({
      ...d,
      nodeName: names.get(d.nodeId) ?? "Unknown",
    })),
    focusGoals: output.focusGoals,
    habitProposals: output.habitProposals,
    archetypeChange: output.archetypeChange ?? null,
    badges,
    ...evolution,
    createdAt: recap.createdAt.toISOString(),
  };
}

interface Evolution {
  weightShifts: WeightChangeDto[];
  treeProposal: TreeProposalDto | null;
}
const NO_EVOLUTION: Evolution = { weightShifts: [], treeProposal: null };

/** Weight shifts and tree proposals made by one review. */
async function evolutionOf(
  db: Database,
  recapId: string,
  nodes: RatingNodeDto[],
  currentSeasonId: string | null,
): Promise<Evolution> {
  const [shifts, proposals] = await Promise.all([
    evolutionRepo.findWeightChangesByRecaps(db, [recapId]),
    evolutionRepo.findProposalsByRecaps(db, [recapId]),
  ]);
  const names = new Map(nodes.map((n) => [n.id, n.name]));
  return {
    weightShifts: shifts.map((s) => toWeightChangeDto(s, names)),
    treeProposal: proposals[0] ? toProposalDto(proposals[0], currentSeasonId) : null,
  };
}

/** Per rated attribute, days with gains from daily recaps over the 4 weeks to `end`. */
function renderEngagement(
  ctx: LeafContext,
  events: DatedEvent[],
  end: string,
  refById: Map<string, string>,
) {
  const from = addDays(end, -27);
  const days = new Map<string, Set<string>>();
  for (const e of events) {
    if (e.source !== "daily_recap" || e.delta <= 0 || !e.date || e.date < from || e.date > end) {
      continue;
    }
    if (!days.has(e.nodeId)) days.set(e.nodeId, new Set());
    days.get(e.nodeId)!.add(e.date);
  }
  return ctx.nodes
    .filter((n) => ctx.leaves.has(n.id))
    .map((n) => `- [${refById.get(n.id)}] ${n.name}: ${days.get(n.id)?.size ?? 0} days`)
    .join("\n");
}

export async function getWeeklyState(db: Database, userId: string): Promise<WeeklyStateDto> {
  await ensureCurrentSeason(db, userId);
  const ctx = await loadLeafContext(db, userId);
  if (!ctx) return { week: null, review: null, ready: false, history: [] };
  const { week } = await reviewableWeek(db, userId, ctx);
  const [current, history, rows] = await Promise.all([
    week ? recapRepo.findActiveWeekly(db, userId, week.start) : null,
    recapRepo.findWeeklyHistory(db, userId, 8),
    eventRepo.findActiveWithDates(db, ctx.season.id),
  ]);
  return {
    week,
    review: current
      ? toWeeklyDto(
          current,
          ctx.nodes,
          datedEvents(rows),
          ctx.season.mode,
          (await badgesByRecap(db, [current.id])).get(current.id),
          await evolutionOf(db, current.id, ctx.nodes, ctx.season.id),
        )
      : null,
    ready: Boolean(week && !current),
    history: history
      .filter((h) => h.id !== current?.id)
      .map((h) => ({
        id: h.id,
        weekStart: h.periodStart,
        weekEnd: h.periodEnd,
        narrative: h.narrative,
      })),
  };
}

/** One weekly review in full (earlier weeks on the Week page), from whichever season it's in. */
export async function getWeeklyReview(
  db: Database,
  userId: string,
  id: string,
): Promise<WeeklyReviewDto> {
  const recap = await recapRepo.findById(db, userId, id);
  if (!recap || recap.kind !== "weekly") throw notFound("Weekly review not found");
  const [nodes, rows, badges, current, season] = await Promise.all([
    nodeRepo.findActiveBySeason(db, recap.seasonId),
    eventRepo.findActiveWithDates(db, recap.seasonId),
    badgesByRecap(db, [recap.id]),
    seasonRepo.findLatestActive(db, userId),
    seasonRepo.findById(db, recap.seasonId),
  ]);
  return toWeeklyDto(
    recap,
    nodes,
    datedEvents(rows),
    season?.mode ?? "rating",
    badges.get(recap.id),
    await evolutionOf(db, recap.id, nodes, current?.id ?? null),
  );
}

/** Focus goals from the latest weekly review, for Today and the daily recap prompt. */
export async function currentFocus(db: Database, userId: string): Promise<FocusGoalDto[]> {
  const [latest] = await recapRepo.findWeeklyHistory(db, userId, 1);
  return latest ? (latest.output as WeeklyOutput).focusGoals : [];
}

/** Week facts for the prompt: days, habit adherence, decay totals, rules, existing habits. */
async function renderWeek(
  db: Database,
  userId: string,
  ctx: LeafContext,
  week: WeekRange,
  refById: Map<string, string>,
  events: DatedEvent[],
) {
  const names = new Map(ctx.nodes.map((n) => [n.id, n.name]));
  const ref = (id: string) => refById.get(id) ?? "?";
  const [days, logs, habits, rules] = await Promise.all([
    recapRepo.findDailyBetween(db, userId, week.start, week.end),
    dayRepo.findBetween(db, userId, week.start, week.end),
    habitRepo.findAllByUser(db, userId),
    decayRuleRepo.findActiveByNodes(db, [...ctx.leaves]),
  ]);
  const recapByDate = new Map(days.map((d) => [d.periodStart, d]));
  const journalByDate = new Map(logs.map((l) => [l.localDate, l.journal.trim()]));
  const lines: string[] = [];
  for (let d = week.start; d <= week.end; d = addDays(d, 1)) {
    const recap = recapByDate.get(d);
    const changes = events
      .filter((e) => recap && e.recapId === recap.id)
      .map((e) => `${names.get(e.nodeId)} ${e.delta > 0 ? "+" : ""}${e.delta}`);
    const journal = journalByDate.get(d);
    lines.push(
      `- ${d} (${WEEKDAY_SHORT[dayOfWeek(d)]}): ` +
        (recap
          ? `${recap.narrative} [${changes.join(", ") || "no changes"}]`
          : journal
            ? `not recapped. Journal: ${journal.replace(/\s+/g, " ").slice(0, 400)}`
            : "not logged"),
    );
  }

  const active = habits.filter((h) => !h.archivedAt && h.startsOn <= week.end);
  const links = await habitRepo.findLinks(
    db,
    active.map((h) => h.id),
  );
  const entries = await habitRepo.findEntriesBetween(
    db,
    active.map((h) => h.id),
    week.start,
    week.end,
  );
  // Groups have no entries of their own; their sub-habits are listed under the group's name.
  const groupName = new Map(habits.filter((h) => h.type === "group").map((h) => [h.id, h.name]));
  const habitLines = active
    .filter((h) => h.type !== "group")
    .map((h) => {
      let scheduled = 0;
      for (let d = week.start; d <= week.end; d = addDays(d, 1)) {
        if (d >= h.startsOn && h.days.includes(dayOfWeek(d))) scheduled += 1;
      }
      const done = entries.filter(
        (e) =>
          e.habitId === h.id &&
          isHabitDone(h.type, h.config as HabitConfig, { num: e.valueNum, text: e.valueText }),
      ).length;
      const builds = links
        .filter((l) => l.habitId === h.id)
        .map((l) => ctx.nodeByLineage.get(l.nodeLineageId))
        .filter((id): id is string => !!id)
        .map(ref);
      const name = h.parentId ? `${groupName.get(h.parentId) ?? "Group"} › ${h.name}` : h.name;
      return `- ${name} (${HABIT_TYPE_LABELS[h.type].toLowerCase()}): done ${done} of ${scheduled} scheduled days${builds.length ? `. Builds: ${builds.join(", ")}` : ""}`;
    });

  const decay = new Map<string, number>();
  for (const e of events) {
    if (e.source === "decay" && e.date && e.date >= week.start && e.date <= week.end) {
      decay.set(e.nodeId, round((decay.get(e.nodeId) ?? 0) + e.delta, 2));
    }
  }

  return [
    `Week: ${week.start} to ${week.end}`,
    `Days:\n${lines.join("\n")}`,
    `Habits:\n${habitLines.join("\n") || "(none)"}`,
    `Decay this week:\n${[...decay].map(([id, d]) => `- [${ref(id)}] ${names.get(id)}: ${d}`).join("\n") || "(none)"}`,
    `Current decay rules:\n${rules.map((r) => `- [${ref(r.nodeId)}] ${names.get(r.nodeId)}: grace ${r.graceDays} days, ${r.perDay}/day, floor ${r.floor}`).join("\n")}`,
    `Existing habit names: ${
      habits
        .filter((h) => !h.archivedAt)
        .map((h) => h.name)
        .join(", ") || "(none)"
    }`,
  ].join("\n\n");
}

function normalizeOutput(
  output: Output,
  ctx: LeafContext,
  idByRef: Map<string, string>,
  values: Map<string, number>,
  existingHabits: string[],
) {
  const nonRoot = new Set(ctx.nodes.filter((n) => n.parentId).map((n) => n.id));
  const toIds = (refs: string[], allowed: Set<string>, max: number) =>
    [
      ...new Set(refs.map((r) => idByRef.get(r.trim())).filter((id) => id && allowed.has(id))),
    ].slice(0, max) as string[];

  const corrections = normalizeRecapChanges(
    output.corrections.map((c) => ({ ...c, evidence: "" })),
    idByRef,
    ctx.leaves,
    WEEKLY_DELTA_CAP,
  );

  const seen = new Set<string>();
  const decayRevisions = output.decayRevisions
    .map((d) => {
      const nodeId = idByRef.get(d.ref.trim());
      if (!nodeId || !ctx.leaves.has(nodeId) || seen.has(nodeId)) return null;
      seen.add(nodeId);
      const { graceDays, perDay } = DECAY_LIMITS;
      return {
        nodeId,
        graceDays: Math.round(clamp(d.graceDays, graceDays.min, graceDays.max)),
        perDay: round(clamp(d.perDay, perDay.min, perDay.max), 2),
        floor: round(clamp(d.floor, 0, values.get(nodeId) ?? 0), 1),
        reason: d.reason.trim(),
      };
    })
    .filter((d): d is NonNullable<typeof d> => d !== null)
    .slice(0, MAX_DECAY_REVISIONS);

  const focusGoals: FocusGoalDto[] = output.focusGoals
    .filter((g) => g.title.trim())
    .slice(0, MAX_FOCUS_GOALS)
    .map((g) => ({
      title: g.title.trim(),
      detail: g.detail.trim(),
      nodeIds: toIds(g.refs, nonRoot, 4),
    }));

  const taken = new Set(existingHabits.map((n) => n.toLowerCase()));
  const habitProposals: HabitProposalDto[] = output.habitProposals
    .filter((h) => h.name.trim() && !taken.has(h.name.trim().toLowerCase()))
    .slice(0, MAX_HABIT_PROPOSALS)
    .map((h, index) => {
      const days = [...new Set(h.days.map(Math.round).filter((d) => d >= 0 && d <= 6))].sort();
      return {
        index,
        name: h.name.trim().slice(0, 60),
        type: h.type,
        days: days.length ? days : [0, 1, 2, 3, 4, 5, 6],
        target: h.target,
        unit: h.unit?.trim() || null,
        nodeIds: toIds(h.refs, ctx.leaves, MAX_HABIT_LINKS),
        reason: h.reason.trim(),
        status: "pending" as const,
      };
    });

  // Projections cover Overall ("overall") and categories; leaves are too fine-grained.
  const root = ctx.nodes.find((n) => n.parentId === null);
  const categories = new Set(ctx.nodes.filter((n) => n.parentId === root?.id).map((n) => n.id));
  const projected = new Map<string, number>();
  for (const p of output.projections) {
    const ref = p.ref.trim().toLowerCase();
    const nodeId = ref === "overall" ? root?.id : idByRef.get(p.ref.trim());
    if (!nodeId || (nodeId !== root?.id && !categories.has(nodeId)) || !Number.isFinite(p.value)) {
      continue;
    }
    projected.set(nodeId, round(clamp(p.value, 0, 100), 1));
  }

  const archetype =
    output.archetype && output.archetype.name.trim()
      ? {
          name: output.archetype.name.trim().slice(0, 60),
          description: output.archetype.description.trim(),
        }
      : null;

  return {
    corrections,
    decayRevisions,
    focusGoals,
    habitProposals,
    projections: [...projected].map(([nodeId, value]) => ({ nodeId, value })),
    archetype,
    profileSummary: output.profileSummary.trim().slice(0, MAX_PROFILE_SUMMARY),
  };
}

/**
 * Reviews the last completed week once: narrative, corrections, decay rule revisions, focus
 * goals, habit proposals and an updated user profile. Running it again returns the existing one.
 */
export async function runWeeklyReview(
  db: Database,
  llm: LlmClient,
  userId: string,
): Promise<WeeklyStateDto> {
  const ctx = await loadLeafContext(db, userId);
  if (!ctx) throw conflict("Finish onboarding first");
  const { user, week } = await reviewableWeek(db, userId, ctx);
  if (!week) throw conflict("No finished week to review yet");
  if (await recapRepo.findActiveWeekly(db, userId, week.start)) return getWeeklyState(db, userId);
  // The tree evolves only when the player leaves adaptive rating on (DESIGN.md §4.5).
  const adaptive = user.preferences.features.adaptiveRating;

  const events = datedEvents(await eventRepo.findActiveWithDates(db, ctx.season.id));
  const values = leafValuesFromEvents(events);
  const nodeValues = computeNodeValues(ctx.nodes, values);
  const { refById, idByRef } = refsFor(ctx.nodes);
  const [
    profile,
    lastFocus,
    habits,
    weekRecaps,
    weekLogs,
    goals,
    archetype,
    report,
    weightHistory,
    treeOpen,
  ] = await Promise.all([
    userRepo.findProfileSummary(db, userId),
    currentFocus(db, userId),
    habitRepo.findAllByUser(db, userId),
    recapRepo.findDailyBetween(db, userId, week.start, week.end),
    dayRepo.findBetween(db, userId, week.start, week.end),
    goalRepo.findByNodes(
      db,
      ctx.nodes.map((n) => n.id),
    ),
    seasonRepo.findArchetype(db, ctx.season.id),
    userRepo.findScoutingReport(db, userId),
    evolutionRepo.findWeightChangesBySeason(db, ctx.season.id),
    adaptive ? canProposeTreeChange(db, userId, ctx, localDateIn(user.timezone)) : false,
  ]);
  const seasonStart = startWeights(ctx.nodes, weightHistory);
  const names = new Map(ctx.nodes.map((n) => [n.id, n.name]));
  const goalLines = goals.map((g) => `- ${names.get(g.nodeId)}: ${g.targetValue}`);
  const growthMode = ctx.season.mode === "growth";
  // Older days related to this week, matched on both journals and recap narratives.
  const memories = await searchMemories(
    db,
    userId,
    [...weekLogs.map((l) => l.journal), ...weekRecaps.map((r) => r.narrative)].join(" "),
    { before: week.start },
  );

  const output = await llm.generateStructured({
    purpose: "recap.weekly",
    userId,
    schema: weeklyReviewOutputSchema,
    system: weeklyReviewPrompt.system,
    prompt: [
      `What you know about the user:\n${profile || "(nothing yet)"}`,
      "Current ratings (Overall is the implicit root):",
      renderTree(toPromptNodes(ctx.nodes, refById, nodeValues), true),
      ...(growthMode
        ? [
            GROWTH_PROJECTIONS_NOTE,
            "Points gained this season:",
            renderTree(
              toPromptNodes(
                ctx.nodes,
                refById,
                computeNodeValues(ctx.nodes, leafGrowthFromEvents(events)),
              ),
              true,
            ),
          ]
        : []),
      await renderWeek(db, userId, ctx, week, refById, events),
      `Last week's focus goals:\n${lastFocus.map((g) => `- ${g.title}: ${g.detail}`).join("\n") || "(none)"}`,
      `The user's ${growthMode ? "growth targets (points to gain by season end)" : "goal ratings"}:\n${goalLines.join("\n") || "(none set)"}`,
      `Season: ${ctx.season.label}, ends ${ctx.season.endsOn} (${daysBetween(week.end, ctx.season.endsOn)} days after this week).`,
      `Current archetype: ${archetype ? `${archetype.name}: ${archetype.description}` : "(none)"}`,
      `Related older days:\n${renderMemories(memories) || "(none)"}`,
      `Scouting Report:\n${renderScoutingReport(report, ctx, refById)}`,
      `Importance weights (share of parent):\n${renderWeights(ctx.nodes, seasonStart, refById)}`,
      `Days with gains in the last 4 weeks:\n${renderEngagement(ctx, events, week.end, refById)}`,
      adaptive
        ? "Weight shifts: allowed."
        : "Weight shifts: switched off by the user. Return weightShifts: [].",
      treeOpen
        ? "Tree change: allowed this week, if clearly warranted."
        : "Tree change: not allowed this week. Return treeChange: null.",
    ].join("\n\n"),
    promptVersion: weeklyReviewPrompt.version,
    maxOutputTokens: 16_000,
  });
  const normalized = normalizeOutput(
    output,
    ctx,
    idByRef,
    values,
    habits.filter((h) => !h.archivedAt).map((h) => h.name),
  );
  const shifts = adaptive
    ? planWeightShifts(output.weightShifts, ctx.nodes, seasonStart, idByRef)
    : [];
  const treeChanges =
    treeOpen && output.treeChange ? normalizeTreeChange(output.treeChange, ctx.nodes, idByRef) : [];
  const scoutingReport = reportFromOutput(output.scoutingReport, ctx, idByRef);

  let recapId: string | null = null;
  try {
    await db.transaction(async (tx) => {
      const recap = await recapRepo.insert(tx, {
        userId,
        seasonId: ctx.season.id,
        kind: "weekly",
        periodStart: week.start,
        periodEnd: week.end,
        narrative: output.narrative.trim(),
        output: {
          focusGoals: normalized.focusGoals,
          habitProposals: normalized.habitProposals,
          decayRevisions: normalized.decayRevisions,
          projections: normalized.projections,
          mode: ctx.season.mode,
          archetypeChange:
            normalized.archetype && normalized.archetype.name !== archetype?.name
              ? {
                  from: archetype?.name ?? null,
                  to: normalized.archetype.name,
                  description: normalized.archetype.description,
                }
              : null,
        } satisfies WeeklyOutput,
        promptVersion: weeklyReviewPrompt.version,
      });
      await eventRepo.insertMany(
        tx,
        normalized.corrections.map((c) => ({
          nodeId: c.nodeId,
          seasonId: ctx.season.id,
          delta: c.delta,
          source: "weekly_review" as const,
          reason: c.reason,
          recapId: recap.id,
        })),
      );
      for (const d of normalized.decayRevisions) {
        await decayRuleRepo.revise(tx, d.nodeId, {
          graceDays: d.graceDays,
          perDay: d.perDay,
          floor: d.floor,
          notes: d.reason,
        });
      }
      if (normalized.archetype && normalized.archetype.name !== archetype?.name) {
        await seasonRepo.update(tx, ctx.season.id, {
          archetype: normalized.archetype.name,
          archetypeDescription: normalized.archetype.description,
        });
      }
      recapId = recap.id;
      const personal = output.personalBadge;
      if (
        personal?.name.trim() &&
        (await badgeRepo.countPersonal(tx, userId, ctx.season.id)) < MAX_PERSONAL_BADGES_PER_SEASON
      ) {
        await badgeRepo.insertNew(tx, [
          {
            userId,
            seasonId: ctx.season.id,
            kind: "personal",
            badgeKey: `personal-${recap.id}`,
            name: personal.name.trim().slice(0, 40),
            description: personal.description.trim(),
            recapId: recap.id,
          },
        ]);
      }
      if (normalized.profileSummary) {
        await userRepo.setProfileSummary(tx, userId, normalized.profileSummary);
      }
      await userRepo.setScoutingReport(tx, userId, scoutingReport);
      await applyWeightShifts(tx, userId, ctx.season.id, recap.id, shifts);
      if (treeChanges.length) {
        await evolutionRepo.insertProposal(tx, {
          userId,
          seasonId: ctx.season.id,
          recapId: recap.id,
          reason: output.treeChange!.reason.trim(),
          changes: treeChanges,
        });
      }
    });
  } catch (error) {
    // A concurrent run already wrote this week's review; theirs stands.
    if (!isUniqueViolation(error)) throw error;
  }
  await awardBadges(db, userId, recapId);
  return getWeeklyState(db, userId);
}

/** Accepting a proposal creates the habit (starting today); dismissing just records it. */
export async function resolveProposal(
  db: Database,
  userId: string,
  reviewId: string,
  index: number,
  action: "accept" | "dismiss",
): Promise<{ state: WeeklyStateDto; habit: HabitDto | null }> {
  const recap = await recapRepo.findById(db, userId, reviewId);
  if (!recap || recap.kind !== "weekly") throw notFound("Review not found");
  const output = recap.output as WeeklyOutput;
  const proposal = output.habitProposals.find((p) => p.index === index);
  if (!proposal) throw notFound("Proposal not found");
  if (proposal.status !== "pending") throw conflict(`Already ${proposal.status}`);

  let habit: HabitDto | null = null;
  if (action === "accept") {
    const ctx = await loadLeafContext(db, userId);
    const config = normalizeHabitConfig(proposal.type, {
      target: proposal.target,
      unit: proposal.unit,
    });
    habit = await createHabit(db, userId, {
      name: proposal.name,
      type: proposal.type,
      config,
      days: proposal.days,
      links: proposal.nodeIds.filter((id) => ctx?.leaves.has(id)),
    }).catch((error: unknown) => {
      throw error instanceof Error ? badRequest(`Couldn't create habit: ${error.message}`) : error;
    });
  }
  await recapRepo.updateOutput(db, recap.id, {
    ...output,
    habitProposals: output.habitProposals.map((p) =>
      p.index === index ? { ...p, status: action === "accept" ? "accepted" : "dismissed" } : p,
    ),
  } satisfies WeeklyOutput);
  return { state: await getWeeklyState(db, userId), habit };
}
