import {
  addDays,
  coachReplyOutputSchema,
  createHabitBodySchema,
  createObjectiveBodySchema,
  logWorkoutBodySchema,
  templateBodySchema,
  COACH_HISTORY_MESSAGES,
  COACH_PAGE_MESSAGES,
  COACH_THREAD_LIST,
  computeNodeValues,
  dayOfWeek,
  HABIT_TYPE_LABELS,
  isHabitDone,
  leafGrowthFromEvents,
  leafValuesFromEvents,
  localDateIn,
  MAX_ASPIRATIONS,
  MAX_COACH_MESSAGES_PER_DAY,
  MAX_COACH_STEPS,
  MAX_COACH_THREAD_TITLE,
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
  type CoachActionDto,
  type CoachMessageDto,
  type CoachStateDto,
  type CoachThreadDto,
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
import { LlmError, type LlmClient } from "../llm/client";
import { coachPrompt, postgamePrompt } from "../llm/prompts/coach";
import { refsFor, renderTree, toPromptNodes } from "../llm/prompts/tree";
import * as coachRepo from "../repos/coach-repo";
import type { CoachMessageRow, CoachThreadRow } from "../repos/coach-repo";
import * as eventRepo from "../repos/rating-event-repo";
import * as habitRepo from "../repos/habit-repo";
import * as recapRepo from "../repos/recap-repo";
import * as userRepo from "../repos/user-repo";
import {
  coachTools,
  refsForDay,
  renderDayLog,
  renderExercises,
  TRACKING_NOTE,
} from "./coach-tools";
import { getDay, saveEntry, saveObjective } from "./day-service";
import { renderScoutingReport } from "./evolution-service";
import { archiveHabit, createHabit, loadLeafContext, type LeafContext } from "./habit-service";
import { archiveObjective, createObjective, listObjectives } from "./objective-service";
import { currentFocus } from "./weekly-service";
import {
  createTemplate,
  deleteTemplate,
  deleteWorkout,
  loadLookup,
  logWorkout,
} from "./workout-service";

type Output = z.infer<typeof coachReplyOutputSchema>;

const DAY_MS = 86_400_000;
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

function toDto(row: CoachMessageRow): CoachMessageDto {
  return {
    id: row.id,
    role: row.role,
    content: row.content,
    suggestions: row.suggestions as CoachSuggestionDto[],
    actions: row.actions as CoachActionDto[],
    createdAt: row.createdAt.toISOString(),
  };
}

const toThreadDto = (row: CoachThreadRow): CoachThreadDto => ({
  id: row.id,
  title: row.title,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

/**
 * Which thread a request means: an id, null for a new chat, or (left out, as older clients
 * do) the latest one.
 */
async function resolveThread(db: Database, userId: string, threadId: string | null | undefined) {
  if (threadId === null) return null;
  if (threadId === undefined) return (await coachRepo.findThreads(db, userId, 1))[0] ?? null;
  const thread = await coachRepo.findThread(db, userId, threadId);
  if (!thread) throw notFound("Conversation not found");
  return thread;
}

async function stateOf(
  db: Database,
  userId: string,
  thread: CoachThreadRow | null,
): Promise<CoachStateDto> {
  const [rows, used] = await Promise.all([
    thread ? coachRepo.findRecent(db, thread.id, COACH_PAGE_MESSAGES) : [],
    coachRepo.countUserMessagesSince(db, userId, new Date(Date.now() - DAY_MS)),
  ]);
  return {
    thread: thread && toThreadDto(thread),
    messages: rows.map(toDto),
    remaining: Math.max(0, MAX_COACH_MESSAGES_PER_DAY - used),
  };
}

export async function getCoach(
  db: Database,
  userId: string,
  threadId?: string | null,
): Promise<CoachStateDto> {
  return stateOf(db, userId, await resolveThread(db, userId, threadId));
}

export async function listThreads(db: Database, userId: string): Promise<CoachThreadDto[]> {
  return (await coachRepo.findThreads(db, userId, COACH_THREAD_LIST)).map(toThreadDto);
}

export async function deleteThread(db: Database, userId: string, threadId: string) {
  const thread = await coachRepo.findThread(db, userId, threadId);
  if (!thread) throw notFound("Conversation not found");
  await coachRepo.deleteThread(db, thread.id);
}

export async function clearCoach(db: Database, userId: string): Promise<CoachStateDto> {
  await coachRepo.deleteAll(db, userId);
  return getCoach(db, userId, null);
}

/** A thread's title from its first message: the first line, cut at a word. */
export function threadTitle(text: string) {
  const line = text.trim().split("\n")[0]!.replace(/\s+/g, " ");
  if (line.length <= MAX_COACH_THREAD_TITLE) return line;
  const cut = line.slice(0, MAX_COACH_THREAD_TITLE - 1);
  return `${cut.slice(0, cut.lastIndexOf(" ") > 20 ? cut.lastIndexOf(" ") : cut.length)}…`;
}

/**
 * Whether a reply says it already did something (logged, saved, drafted...), as opposed to
 * offering to ("I'll draft it once you tell me the sets").
 */
export function claimsWork(reply: string) {
  const done = "logged|saved|created|added|recorded|marked|set up|made|drafted";
  return [
    // "I've logged…", "I created…"
    new RegExp(`\\bI(?:'ve| have)?\\s+(?:just\\s+|also\\s+)?(?:${done})\\b`, "i"),
    // A sentence that opens with it: "Logged Wednesday as Chest Day."
    new RegExp(`(?:^|[.!?:]\\s+)(?:${done})\\b`, "i"),
    // Passive: "It's written down as a card", "has been logged"
    new RegExp(
      `\\b(?:is|are|was|were|it's|has been|have been)\\s+(?:now\\s+)?(?:${done}|written down)\\b`,
      "i",
    ),
    // "Here's the draft", "check the card"
    /\bhere(?:'s| is) (?:the|a|your) draft\b|\b(?:on|in|from) the card\b/i,
  ].some((re) => re.test(reply));
}

/**
 * Looser: any talk of a card or draft. Without a draft that's worth a second look by the model,
 * though only `claimsWork` is sure enough to overrule its reply.
 */
const mentionsDraft = (reply: string) => /\b(?:card|draft)s?\b/i.test(reply);

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
        (g.kind === "reach"
          ? `- ${g.name}: at ${g.progress.current} ${g.unit}, from ${g.startValue} to ${g.target}, due ${g.endsOn} `
          : `- ${g.name}: ${g.progress.current} of ${g.target} ${g.unit}, due ${g.endsOn} `) +
        `(${g.progress.daysLeft} days left, ${g.progress.onPace ? "on pace" : "behind pace"})`,
    )
    .join("\n");

/**
 * Everything the coach knows, as the system prompt's second half. `date` is the day in focus
 * (today, or the day a postgame is about): its log is shown in full for the tools.
 */
async function buildContext(db: Database, userId: string, date?: string) {
  const user = await userRepo.findById(db, userId);
  if (!user) throw notFound("User not found");
  const today = localDateIn(user.timezone);
  const focusDate = date ?? today;
  const ctx = await loadLeafContext(db, userId);
  const { features } = user.preferences;
  const refs = ctx ? refsFor(ctx.nodes) : { refById: new Map(), idByRef: new Map() };

  const [profile, report, focus, goals, recaps, habits, events, day, lookup] = await Promise.all([
    userRepo.findProfileSummary(db, userId),
    userRepo.findScoutingReport(db, userId),
    currentFocus(db, userId),
    features.goals ? listObjectives(db, userId) : [],
    recapRepo.findRecentDaily(db, userId, addDays(today, -7), addDays(today, 1)),
    features.habits ? renderHabits(db, userId, today, ctx) : "",
    ctx ? eventRepo.findActiveBySeason(db, ctx.season.id) : [],
    getDay(db, userId, focusDate),
    features.workouts ? loadLookup(db, userId) : null,
  ]);
  const dayRefs = refsForDay(day);
  const values = ctx ? computeNodeValues(ctx.nodes, leafValuesFromEvents(events)) : new Map();
  const growth =
    ctx?.season.mode === "growth"
      ? computeNodeValues(ctx.nodes, leafGrowthFromEvents(events))
      : null;
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
    ctx &&
      growth &&
      `Points gained this season (what the user sees in Growth mode):\n` +
        renderTree(toPromptNodes(ctx.nodes, refs.refById, growth), true),
    features.habits && `Habits:\n${habits || "(none)"}`,
    features.goals && `Goals:\n${renderGoals(goals as ObjectiveDto[]) || "(none running)"}`,
    `This week's focus from the weekly review:\n${focus.map((f) => `- ${f.title}: ${f.detail}`).join("\n") || "(none)"}`,
    `Recent days:\n${recaps.map((r) => `- ${r.periodStart}: ${r.narrative}`).join("\n") || "(no recaps this week)"}`,
    off.length ? `Switched off by the user: ${off.join(", ")}. Don't suggest those.` : "",
    renderDayLog(day, dayRefs, features),
    lookup &&
      `Exercise library (id: name [tracking]; sets record ${TRACKING_NOTE}):\n${renderExercises(lookup)}`,
  ]
    .filter(Boolean)
    .join("\n\n");
  return {
    context,
    ctx,
    idByRef: refs.idByRef as Map<string, string>,
    features,
    today,
    day,
    dayRefs,
    units: user.unitSystem,
  };
}

const DONE: Record<CoachActionDto["kind"], string> = {
  workout: "Logged workout",
  habit: "Logged habit",
  goal: "Logged goal progress",
  newHabit: "Created habit",
  newGoal: "Created goal",
  template: "Saved template",
};

/** Past turns for the model, with what the coach did, so it never does a thing twice. */
function toModelMessage(m: CoachMessageRow): ModelMessage {
  const actions = (m.actions as CoachActionDto[]).map(
    (a) =>
      `[${DONE[a.kind]}${a.undone ? ", since undone by the user" : ""}: ${a.title} (${a.date}): ${a.detail}]`,
  );
  // Drafts and ideas: what the player did with each, so the coach doesn't redo or re-offer them.
  const proposals = (m.suggestions as CoachSuggestionDto[]).map(
    (x) =>
      `[${x.kind === "report" ? "Scouting Report line" : `Draft ${x.kind}`} "${x.kind === "report" ? x.text : x.name}": ${STATUS[x.status]}]`,
  );
  return { role: m.role, content: [m.content, ...actions, ...proposals].join("\n") };
}

const STATUS: Record<CoachSuggestionDto["status"], string> = {
  pending: "waiting for the user to review it, not saved",
  accepted: "saved by the user (maybe with their own tweaks)",
  dismissed: "turned down by the user",
};

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

/**
 * Sends one message in a thread (a new one for null) and stores it with the coach's reply.
 * Nothing is stored if the call fails.
 */
export async function sendMessage(
  db: Database,
  llm: LlmClient,
  userId: string,
  content: string,
  threadId?: string | null,
): Promise<CoachStateDto> {
  const used = await coachRepo.countUserMessagesSince(db, userId, new Date(Date.now() - DAY_MS));
  if (used >= MAX_COACH_MESSAGES_PER_DAY) {
    throw new HTTPException(429, {
      message: `You've sent ${MAX_COACH_MESSAGES_PER_DAY} messages to the coach in the last day. Try again later.`,
    });
  }
  const thread = await resolveThread(db, userId, threadId);
  const [built, history, habits] = await Promise.all([
    buildContext(db, userId, thread?.focusDate ?? undefined),
    thread ? coachRepo.findRecent(db, thread.id, COACH_HISTORY_MESSAGES) : [],
    habitRepo.findAllByUser(db, userId),
  ]);
  const { context, ctx, idByRef, features, today, day, dayRefs, units } = built;
  const messages: ModelMessage[] = [
    ...threadOpening(thread, history),
    ...history.map(toModelMessage),
    { role: "user", content },
  ];
  const actions: CoachActionDto[] = [];
  const drafts: CoachSuggestionDto[] = [];
  const habitNames = habits.filter((h) => !h.archivedAt).map((h) => h.name);
  const tools = coachTools(
    {
      db,
      userId,
      today,
      units,
      refs: dayRefs,
      features,
      editable: day.editable,
      idByRef,
      leaves: new Map(ctx?.nodes.filter((n) => ctx.leaves.has(n.id)).map((n) => [n.id, n.name])),
      actions,
      drafts,
      habitNames,
    },
    day.date,
  );
  const ask = (prompt: ModelMessage[]) =>
    llm.generateStructured({
      purpose: "coach.chat",
      userId,
      schema: coachReplyOutputSchema,
      system: `${coachPrompt.system}\n\n---\n\n${context}`,
      prompt,
      promptVersion: coachPrompt.version,
      maxOutputTokens: 2048,
      tools,
      maxSteps: MAX_COACH_STEPS,
    });
  let output: Output;
  try {
    output = await ask(messages);
    // Models sometimes say they logged something without calling the tool. Nothing logged
    // plus a reply that claims otherwise gets one correction; then it's said plainly.
    const nothingDone = () => !actions.length && !drafts.length;
    if (
      nothingDone() &&
      Object.keys(tools).length &&
      (claimsWork(output.reply) || mentionsDraft(output.reply))
    ) {
      output = await ask([
        ...messages,
        { role: "assistant", content: output.reply },
        {
          role: "user",
          content:
            "[From the app, not the user: no tool ran, so nothing was logged, drafted or " +
            "saved, and the user never saw that reply. If they asked for something, call " +
            "the tool now. Then write the reply they'll see, as if for the first time, " +
            "claiming only what the tools confirmed.]",
        },
      ]);
      if (nothingDone() && claimsWork(output.reply)) {
        output = {
          reply:
            "I didn't manage to log, draft or save anything that time. Tell me again and I'll " +
            "add it, or add it from the day log.",
          suggestions: [],
        };
      }
    }
  } catch (error) {
    // Things already logged stay logged, so their receipts (and undo) have to be kept; drafts
    // are worth keeping too.
    if (!(error instanceof LlmError) || (!actions.length && !drafts.length)) throw error;
    output = {
      reply: "I got that started, but couldn't finish my reply. Check it below.",
      suggestions: [],
    };
  }
  // Drafts from the tools first, then ideas from the reply; the coach can't draft a habit twice.
  const drafted = new Set(drafts.flatMap((d) => (d.kind === "habit" ? [d.name] : [])));
  const suggestions = [
    ...drafts,
    ...normalizeSuggestions(output, ctx, idByRef, [...habitNames, ...drafted], features),
  ].map((x, i) => ({ ...x, index: i }));
  const now = Date.now();
  const saved = await db.transaction(async (tx) => {
    const t = thread ?? (await coachRepo.insertThread(tx, { userId, title: threadTitle(content) }));
    await coachRepo.insertMany(tx, [
      { userId, threadId: t.id, role: "user", content, createdAt: new Date(now) },
      {
        userId,
        threadId: t.id,
        role: "assistant",
        content: output.reply.trim() || "Sorry, I don't have an answer for that.",
        suggestions,
        actions,
        // A millisecond later, so the pair always reads in order.
        createdAt: new Date(now + 1),
      },
    ]);
    await coachRepo.touchThread(tx, t.id, new Date(now + 1));
    return t;
  });
  return getCoach(db, userId, saved.id);
}

/**
 * The model needs a conversation to start with the player; a postgame thread starts with the
 * coach, so it gets the line that opened it (never stored).
 */
function threadOpening(thread: CoachThreadRow | null, history: CoachMessageRow[]): ModelMessage[] {
  if (!thread?.focusDate || history[0]?.role !== "assistant") return [];
  return [{ role: "user", content: `I just ended ${thread.focusDate}.` }];
}

/**
 * The postgame interview: right after a day's recap the coach opens with a line on the day and
 * questions about what the log is missing. The player answers in the chat as usual.
 */
export async function startPostgame(
  db: Database,
  llm: LlmClient,
  userId: string,
  date: string,
): Promise<CoachStateDto> {
  const { context, day } = await buildContext(db, userId, date);
  if (!day.recap) throw conflict("End the day first");
  const output = await llm.generateStructured({
    purpose: "coach.chat",
    userId,
    schema: coachReplyOutputSchema,
    system: `${coachPrompt.system}\n\n---\n\n${context}\n\n---\n\n${postgamePrompt.instruction}`,
    // The model needs a user turn to answer; this one isn't stored.
    prompt: [{ role: "user", content: `I just ended ${date}.` }],
    promptVersion: `${coachPrompt.version}+${postgamePrompt.version}`,
    maxOutputTokens: 1024,
  });
  // Each postgame is its own thread, about its day.
  const thread = await db.transaction(async (tx) => {
    const t = await coachRepo.insertThread(tx, {
      userId,
      title: `Postgame: ${WEEKDAY_SHORT[dayOfWeek(date)]} ${date}`,
      focusDate: date,
    });
    await coachRepo.insertMany(tx, [
      {
        userId,
        threadId: t.id,
        role: "assistant",
        content: output.reply.trim() || "How did the day go?",
        suggestions: [],
      },
    ]);
    return t;
  });
  return getCoach(db, userId, thread.id);
}

/** Takes back one thing the coach logged: deletes the workout, or restores the old entry. */
export async function undoAction(
  db: Database,
  userId: string,
  messageId: string,
  index: number,
): Promise<CoachStateDto> {
  const row = await coachRepo.findById(db, userId, messageId);
  if (!row || row.role !== "assistant") throw notFound("Message not found");
  const actions = row.actions as CoachActionDto[];
  const a = actions.find((x) => x.index === index);
  if (!a) throw notFound("Nothing to undo there");
  if (a.undone) throw conflict("Already undone");
  if (a.kind === "workout") {
    // Deleted by hand already: nothing left to undo.
    await deleteWorkout(db, userId, a.workoutId).catch((error: unknown) => {
      if (!(error instanceof HTTPException && error.status === 404)) throw error;
    });
  } else if (a.kind === "habit") {
    await saveEntry(db, userId, a.date, a.habitId, a.previous ?? { num: null, text: null });
  } else if (a.kind === "goal") {
    await saveObjective(db, userId, a.date, a.objectiveId, a.previous);
  } else {
    // Already archived or deleted by hand: nothing left to undo.
    const gone = (error: unknown) => {
      if (!(error instanceof HTTPException && (error.status === 404 || error.status === 409))) {
        throw error;
      }
    };
    if (a.kind === "newHabit") await archiveHabit(db, userId, a.habitId).catch(gone);
    else if (a.kind === "newGoal") await archiveObjective(db, userId, a.objectiveId).catch(gone);
    else await deleteTemplate(db, userId, a.templateId).catch(gone);
  }
  await coachRepo.updateActions(
    db,
    row.id,
    actions.map((x) => (x.index === index ? { ...x, undone: true } : x)),
  );
  return getCoach(db, userId, row.threadId);
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

/** The coach's proposal as a create body, with links to attributes removed since dropped. */
function proposedBody(
  s: Exclude<CoachSuggestionDto, { kind: "report" }>,
  today: string,
  live: (nodeId: string) => boolean,
) {
  switch (s.kind) {
    case "habit":
      return {
        name: s.name,
        type: s.habitType,
        config: normalizeHabitConfig(s.habitType, {
          target: s.target,
          unit: s.unit,
          direction: s.avoid ? "avoid" : "build",
        }),
        days: s.days,
        links: s.nodeIds.filter(live),
      };
    case "goal":
      return {
        name: s.name,
        kind: s.goalKind ?? "total",
        target: s.target,
        ...(s.goalKind === "reach" && s.startValue != null && { startValue: s.startValue }),
        unit: s.unit,
        startsOn: today,
        endsOn: s.endsOn && s.endsOn >= today ? s.endsOn : addDays(today, s.durationDays - 1),
        source: "manual",
        links: s.nodeIds.filter(live),
      };
    case "workout":
      return {
        name: s.name,
        notes: s.notes,
        localDate: s.date,
        durationS: s.durationS,
        exercises: s.exercises,
      };
    case "template":
      return { name: s.name, notes: s.notes, exercises: s.exercises };
  }
}

/**
 * Accepting creates the habit, goal, workout or template (the player's `edits` if they changed
 * it, as the matching create body) or updates the Scouting Report.
 */
export async function resolveSuggestion(
  db: Database,
  userId: string,
  messageId: string,
  index: number,
  action: "accept" | "dismiss",
  edits?: unknown,
): Promise<{
  state: CoachStateDto;
  habit: HabitDto | null;
  goal: ObjectiveDto | null;
  createdId: string | null;
}> {
  const row = await coachRepo.findById(db, userId, messageId);
  if (!row || row.role !== "assistant") throw notFound("Message not found");
  const suggestions = row.suggestions as CoachSuggestionDto[];
  const s = suggestions.find((x) => x.index === index);
  if (!s) throw notFound("Suggestion not found");
  if (s.status !== "pending") throw conflict(`Already ${s.status}`);

  let habit: HabitDto | null = null;
  let goal: ObjectiveDto | null = null;
  let createdId: string | null = null;
  if (action === "accept") {
    const ctx = await loadLeafContext(db, userId);
    const wrap = (error: unknown) => {
      throw error instanceof HTTPException
        ? error
        : error instanceof Error
          ? badRequest(`Couldn't add it: ${error.message}`)
          : error;
    };
    if (s.kind === "report") {
      const report = await userRepo.findScoutingReport(db, userId);
      await userRepo.setScoutingReport(db, userId, addToReport(report, s, ctx));
    } else {
      const user = await userRepo.findById(db, userId);
      const body =
        edits ??
        proposedBody(s, localDateIn(user?.timezone ?? "UTC"), (id) => !!ctx?.leaves.has(id));
      if (s.kind === "habit") {
        habit = await createHabit(db, userId, createHabitBodySchema.parse(body)).catch(wrap);
        createdId = habit.id;
      } else if (s.kind === "goal") {
        goal = await createObjective(db, userId, createObjectiveBodySchema.parse(body)).catch(wrap);
        createdId = goal.id;
      } else if (s.kind === "workout") {
        const w = await logWorkout(db, userId, logWorkoutBodySchema.parse(body)).catch(wrap);
        createdId = w.id;
      } else {
        const t = await createTemplate(db, userId, templateBodySchema.parse(body)).catch(wrap);
        createdId = t.id;
      }
    }
  }
  await coachRepo.updateSuggestions(
    db,
    row.id,
    suggestions.map((x) =>
      x.index === index
        ? { ...x, status: action === "accept" ? "accepted" : "dismissed", createdId }
        : x,
    ),
  );
  return { state: await getCoach(db, userId, row.threadId), habit, goal, createdId };
}
