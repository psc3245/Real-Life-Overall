import {
  addDays,
  coachReplyOutputSchema,
  COACH_HISTORY_MESSAGES,
  COACH_PAGE_MESSAGES,
  computeNodeValues,
  dayOfWeek,
  HABIT_TYPE_LABELS,
  isHabitDone,
  leafValuesFromEvents,
  localDateIn,
  MAX_ASPIRATIONS,
  MAX_COACH_MESSAGES_PER_DAY,
  MAX_COACH_SUGGESTIONS,
  MAX_CONSTRAINTS,
  MAX_HABIT_LINKS,
  MAX_NODE_NAME_LENGTH,
  MAX_OBJECTIVE_DAYS,
  MAX_OBJECTIVE_TARGET,
  MAX_PRIORITIES,
  MAX_REPORT_FOCUSES,
  MAX_REPORT_LINE,
  normalizeHabitConfig,
  WEEKDAY_NAMES,
  WEEKDAY_SHORT,
  type CoachMessageDto,
  type CoachStateDto,
  type CoachSuggestionDto,
  type HabitConfig,
  type HabitDto,
  type ObjectiveDto,
  type ScoutingReport,
} from "@rlo/shared";
import type { ModelMessage } from "ai";
import { HTTPException } from "hono/http-exception";
import type { z } from "zod";
import type { Database } from "../db/client";
import { badRequest, conflict, notFound } from "../errors";
import type { LlmClient } from "../llm/client";
import { coachPrompt } from "../llm/prompts/coach";
import { refsFor, renderTree, toPromptNodes } from "../llm/prompts/tree";
import * as coachRepo from "../repos/coach-repo";
import type { CoachMessageRow } from "../repos/coach-repo";
import * as eventRepo from "../repos/rating-event-repo";
import * as habitRepo from "../repos/habit-repo";
import * as recapRepo from "../repos/recap-repo";
import * as userRepo from "../repos/user-repo";
import { renderScoutingReport } from "./evolution-service";
import { createHabit, loadLeafContext, type LeafContext } from "./habit-service";
import { createObjective, listObjectives } from "./objective-service";
import { currentFocus } from "./weekly-service";

type Output = z.infer<typeof coachReplyOutputSchema>;

const DAY_MS = 86_400_000;
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

function toDto(row: CoachMessageRow): CoachMessageDto {
  return {
    id: row.id,
    role: row.role,
    content: row.content,
    suggestions: row.suggestions as CoachSuggestionDto[],
    createdAt: row.createdAt.toISOString(),
  };
}

export async function getCoach(db: Database, userId: string): Promise<CoachStateDto> {
  const [rows, used] = await Promise.all([
    coachRepo.findRecent(db, userId, COACH_PAGE_MESSAGES),
    coachRepo.countUserMessagesSince(db, userId, new Date(Date.now() - DAY_MS)),
  ]);
  return {
    messages: rows.map(toDto),
    remaining: Math.max(0, MAX_COACH_MESSAGES_PER_DAY - used),
  };
}

export async function clearCoach(db: Database, userId: string): Promise<CoachStateDto> {
  await coachRepo.deleteAll(db, userId);
  return getCoach(db, userId);
}

/** Habits with how often they were done over the last two weeks. */
async function renderHabits(db: Database, userId: string, today: string, ctx: LeafContext | null) {
  const habits = (await habitRepo.findAllByUser(db, userId)).filter(
    (h) => !h.archivedAt && h.type !== "group",
  );
  const from = addDays(today, -13);
  const entries = await habitRepo.findEntriesBetween(
    db,
    habits.map((h) => h.id),
    from,
    today,
  );
  const links = await habitRepo.findLinks(
    db,
    habits.map((h) => h.id),
  );
  const names = new Map(ctx?.nodes.map((n) => [n.id, n.name]));
  return habits
    .map((h) => {
      let scheduled = 0;
      for (let d = from; d <= today; d = addDays(d, 1)) {
        if (d >= h.startsOn && h.days.includes(dayOfWeek(d))) scheduled += 1;
      }
      const done = entries.filter(
        (e) =>
          e.habitId === h.id &&
          isHabitDone(h.type, h.config as HabitConfig, { num: e.valueNum, text: e.valueText }),
      ).length;
      const builds = links
        .filter((l) => l.habitId === h.id)
        .map((l) => names.get(ctx?.nodeByLineage.get(l.nodeLineageId) ?? ""))
        .filter(Boolean);
      const schedule =
        h.days.length === 7 ? "daily" : h.days.map((d) => WEEKDAY_SHORT[d]).join("/");
      return (
        `- ${h.name} (${HABIT_TYPE_LABELS[h.type].toLowerCase()}, ${schedule}): ` +
        `done ${done} of ${scheduled} scheduled days in the last 2 weeks` +
        (builds.length ? `. Builds: ${builds.join(", ")}` : "")
      );
    })
    .join("\n");
}

const renderGoals = (goals: ObjectiveDto[]) =>
  goals
    .filter((g) => g.progress.status === "active" || g.progress.status === "upcoming")
    .map(
      (g) =>
        `- ${g.name}: ${g.progress.current} of ${g.target} ${g.unit}, due ${g.endsOn} ` +
        `(${g.progress.daysLeft} days left, ${g.progress.onPace ? "on pace" : "behind pace"})`,
    )
    .join("\n");

/** Everything the coach knows, as the system prompt's second half. */
async function buildContext(db: Database, userId: string) {
  const user = await userRepo.findById(db, userId);
  if (!user) throw notFound("User not found");
  const today = localDateIn(user.timezone);
  const ctx = await loadLeafContext(db, userId);
  const { features } = user.preferences;
  const refs = ctx ? refsFor(ctx.nodes) : { refById: new Map(), idByRef: new Map() };

  const [profile, report, focus, goals, recaps, habits, events] = await Promise.all([
    userRepo.findProfileSummary(db, userId),
    userRepo.findScoutingReport(db, userId),
    currentFocus(db, userId),
    features.goals ? listObjectives(db, userId) : [],
    recapRepo.findRecentDaily(db, userId, addDays(today, -7), addDays(today, 1)),
    features.habits ? renderHabits(db, userId, today, ctx) : "",
    ctx ? eventRepo.findActiveBySeason(db, ctx.season.id) : [],
  ]);
  const values = ctx ? computeNodeValues(ctx.nodes, leafValuesFromEvents(events)) : new Map();
  const off = [!features.habits && "habits", !features.goals && "goals"].filter(Boolean);

  const context = [
    `Today is ${WEEKDAY_NAMES[dayOfWeek(today)]}, ${today}. The user's name is ${user.displayName}.`,
    `What you know about the user:\n${profile || "(nothing yet)"}`,
    ctx
      ? `Scouting Report:\n${renderScoutingReport(report, ctx, refs.refById)}`
      : "The user hasn't finished onboarding, so there is no rating yet.",
    ctx &&
      `Ratings this season (${ctx.season.label}, ends ${ctx.season.endsOn}):\n` +
        renderTree(toPromptNodes(ctx.nodes, refs.refById, values), true),
    features.habits && `Habits:\n${habits || "(none)"}`,
    features.goals && `Goals:\n${renderGoals(goals as ObjectiveDto[]) || "(none running)"}`,
    `This week's focus from the weekly review:\n${focus.map((f) => `- ${f.title}: ${f.detail}`).join("\n") || "(none)"}`,
    `Recent days:\n${recaps.map((r) => `- ${r.periodStart}: ${r.narrative}`).join("\n") || "(no recaps this week)"}`,
    off.length ? `Switched off by the user: ${off.join(", ")}. Don't suggest those.` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
  return { context, ctx, idByRef: refs.idByRef as Map<string, string>, features, today };
}

/** Keeps suggestions that make sense: real refs, no duplicate habits, sane numbers. */
function normalizeSuggestions(
  output: Output,
  ctx: LeafContext | null,
  idByRef: Map<string, string>,
  existingHabits: string[],
  features: { habits: boolean; goals: boolean },
): CoachSuggestionDto[] {
  const leaves = ctx?.leaves ?? new Set<string>();
  const nonRoot = new Set(ctx?.nodes.filter((n) => n.parentId).map((n) => n.id));
  const toIds = (refs: string[]) =>
    [...new Set(refs.map((r) => idByRef.get(r.trim())).filter((id) => id && leaves.has(id)))].slice(
      0,
      MAX_HABIT_LINKS,
    ) as string[];
  const taken = new Set(existingHabits.map((n) => n.toLowerCase()));
  const out: CoachSuggestionDto[] = [];

  for (const s of output.suggestions) {
    if (out.length >= MAX_COACH_SUGGESTIONS) break;
    const name = s.name.trim();
    const base = { index: out.length, reason: s.reason.trim(), status: "pending" as const };
    if (!name) continue;
    if (s.kind === "habit") {
      if (!features.habits || !s.habitType || s.habitType === "group") continue;
      if (taken.has(name.toLowerCase())) continue;
      taken.add(name.toLowerCase());
      const days = [...new Set(s.days.map(Math.round).filter((d) => d >= 0 && d <= 6))].sort();
      const counts = s.habitType === "counter" || s.habitType === "duration";
      out.push({
        ...base,
        kind: "habit",
        name: name.slice(0, 60),
        habitType: s.habitType,
        days: days.length ? days : [0, 1, 2, 3, 4, 5, 6],
        target: counts && s.target && s.target > 0 ? s.target : null,
        unit: counts ? s.unit?.trim() || null : null,
        nodeIds: toIds(s.refs),
      });
    } else if (s.kind === "goal") {
      if (!features.goals || !s.target || !Number.isFinite(s.target) || s.target <= 0) continue;
      out.push({
        ...base,
        kind: "goal",
        name: name.slice(0, 80),
        target: Math.min(MAX_OBJECTIVE_TARGET, s.target),
        unit: (s.unit?.trim() || "times").slice(0, 20),
        durationDays: Math.round(clamp(s.durationDays ?? 30, 1, MAX_OBJECTIVE_DAYS)),
        nodeIds: toIds(s.refs),
      });
    } else {
      if (!s.section) continue;
      const nodeId = s.section === "priority" && s.refs[0] ? idByRef.get(s.refs[0].trim()) : null;
      out.push({
        ...base,
        kind: "report",
        section: s.section,
        text: name.slice(0, s.section === "priority" ? MAX_NODE_NAME_LENGTH * 2 : MAX_REPORT_LINE),
        importance: s.section === "priority" ? Math.round(clamp(s.importance ?? 3, 1, 5)) : null,
        nodeId: nodeId && nonRoot.has(nodeId) ? nodeId : null,
      });
    }
  }
  return out;
}

/** Sends one message and stores it with the coach's reply. Nothing is stored if the call fails. */
export async function sendMessage(
  db: Database,
  llm: LlmClient,
  userId: string,
  content: string,
): Promise<CoachStateDto> {
  const used = await coachRepo.countUserMessagesSince(db, userId, new Date(Date.now() - DAY_MS));
  if (used >= MAX_COACH_MESSAGES_PER_DAY) {
    throw new HTTPException(429, {
      message: `You've sent ${MAX_COACH_MESSAGES_PER_DAY} messages to the coach in the last day. Try again later.`,
    });
  }
  const [{ context, ctx, idByRef, features }, history, habits] = await Promise.all([
    buildContext(db, userId),
    coachRepo.findRecent(db, userId, COACH_HISTORY_MESSAGES),
    habitRepo.findAllByUser(db, userId),
  ]);
  const messages: ModelMessage[] = [
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content },
  ];
  const output = await llm.generateStructured({
    purpose: "coach.chat",
    userId,
    schema: coachReplyOutputSchema,
    system: `${coachPrompt.system}\n\n---\n\n${context}`,
    prompt: messages,
    promptVersion: coachPrompt.version,
    maxOutputTokens: 2048,
  });
  const suggestions = normalizeSuggestions(
    output,
    ctx,
    idByRef,
    habits.filter((h) => !h.archivedAt).map((h) => h.name),
    features,
  );
  const now = Date.now();
  await coachRepo.insertMany(db, [
    { userId, role: "user", content, createdAt: new Date(now) },
    {
      userId,
      role: "assistant",
      content: output.reply.trim() || "Sorry, I don't have an answer for that.",
      suggestions,
      // A millisecond later, so the pair always reads in order.
      createdAt: new Date(now + 1),
    },
  ]);
  return getCoach(db, userId);
}

/** Adds a suggested line to the Scouting Report (the player's own edit). */
function addToReport(
  report: ScoutingReport,
  s: Extract<CoachSuggestionDto, { kind: "report" }>,
  ctx: LeafContext | null,
): ScoutingReport {
  const add = (list: string[], max: number) => {
    if (list.some((l) => l.toLowerCase() === s.text.toLowerCase())) return list;
    if (list.length >= max) throw conflict("That part of your Scouting Report is full");
    return [...list, s.text];
  };
  const next = { ...report, updatedAt: new Date().toISOString(), updatedBy: "user" as const };
  if (s.section === "aspiration") next.aspirations = add(report.aspirations, MAX_ASPIRATIONS);
  if (s.section === "focus") next.focuses = add(report.focuses, MAX_REPORT_FOCUSES);
  if (s.section === "constraint") next.constraints = add(report.constraints, MAX_CONSTRAINTS);
  if (s.section === "priority") {
    const others = report.priorities.filter((p) => p.area.toLowerCase() !== s.text.toLowerCase());
    if (others.length >= MAX_PRIORITIES) throw conflict("Your priorities list is full");
    next.priorities = [
      ...others,
      {
        area: s.text,
        importance: s.importance ?? 3,
        lineageId: (s.nodeId && ctx?.lineageByNode.get(s.nodeId)) || null,
        note: s.reason.slice(0, MAX_REPORT_LINE),
      },
    ].sort((a, b) => b.importance - a.importance);
  }
  return next;
}

/** Accepting creates the habit or goal, or updates the Scouting Report. */
export async function resolveSuggestion(
  db: Database,
  userId: string,
  messageId: string,
  index: number,
  action: "accept" | "dismiss",
): Promise<{ state: CoachStateDto; habit: HabitDto | null; goal: ObjectiveDto | null }> {
  const row = await coachRepo.findById(db, userId, messageId);
  if (!row || row.role !== "assistant") throw notFound("Message not found");
  const suggestions = row.suggestions as CoachSuggestionDto[];
  const s = suggestions.find((x) => x.index === index);
  if (!s) throw notFound("Suggestion not found");
  if (s.status !== "pending") throw conflict(`Already ${s.status}`);

  let habit: HabitDto | null = null;
  let goal: ObjectiveDto | null = null;
  if (action === "accept") {
    const ctx = await loadLeafContext(db, userId);
    // Links to attributes removed since the suggestion are dropped.
    const links = s.kind === "report" ? [] : s.nodeIds.filter((id) => ctx?.leaves.has(id));
    const wrap = (error: unknown) => {
      throw error instanceof HTTPException
        ? error
        : error instanceof Error
          ? badRequest(`Couldn't add it: ${error.message}`)
          : error;
    };
    if (s.kind === "habit") {
      habit = await createHabit(db, userId, {
        name: s.name,
        type: s.habitType,
        config: normalizeHabitConfig(s.habitType, { target: s.target, unit: s.unit }),
        days: s.days,
        links,
      }).catch(wrap);
    } else if (s.kind === "goal") {
      const user = await userRepo.findById(db, userId);
      const today = localDateIn(user?.timezone ?? "UTC");
      goal = await createObjective(db, userId, {
        name: s.name,
        target: s.target,
        unit: s.unit,
        startsOn: today,
        endsOn: addDays(today, s.durationDays - 1),
        source: "manual",
        links,
      }).catch(wrap);
    } else {
      const report = await userRepo.findScoutingReport(db, userId);
      await userRepo.setScoutingReport(db, userId, addToReport(report, s, ctx));
    }
  }
  await coachRepo.updateSuggestions(
    db,
    row.id,
    suggestions.map((x) =>
      x.index === index ? { ...x, status: action === "accept" ? "accepted" : "dismissed" } : x,
    ),
  );
  return { state: await getCoach(db, userId), habit, goal };
}
