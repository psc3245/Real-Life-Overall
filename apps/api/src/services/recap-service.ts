import {
  addDays,
  computeNodeValues,
  dailyRecapOutputSchema,
  dayOfWeek,
  GROUP_RULE_LABELS,
  groupProgress,
  HABIT_TYPE_LABELS,
  isDayHabitDone,
  isHabitDone,
  leafValuesFromEvents,
  MAX_RECAPS_PER_DAY,
  type DayDto,
  type DayHabitDto,
  type GuidedPromptDto,
} from "@rlo/shared";
import type { Database } from "../db/client";
import { badRequest, conflict, isUniqueViolation } from "../errors";
import type { LlmClient } from "../llm/client";
import { dailyRecapPrompt } from "../llm/prompts/recaps";
import { refsFor, renderTree, toPromptNodes } from "../llm/prompts/tree";
import * as dayRepo from "../repos/day-repo";
import * as eventRepo from "../repos/rating-event-repo";
import * as recapRepo from "../repos/recap-repo";
import { getDay, requireEditable } from "./day-service";
import { awardBadges } from "./badge-service";
import { ensureCurrentSeason } from "./season-service";
import { applyDecay, invalidateDecay } from "./decay-service";
import { renderMemories, searchMemories } from "./memory-service";
import { currentFocus } from "./weekly-service";
import * as userRepo from "../repos/user-repo";
import { loadLeafContext } from "./habit-service";
import { normalizePrompts, normalizeRecapChanges } from "./recap-changes";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function describeEntry({ habit, entry }: DayHabitDto): string {
  const { config } = habit;
  if (!entry) return "not logged";
  const done = isHabitDone(habit.type, config, entry) ? ", done" : "";
  switch (habit.type) {
    case "checkbox":
      return entry.num === 1 ? "done" : "not done";
    case "checknote":
      return `${entry.num === 1 ? "done" : "not done"}${entry.text ? ` — "${entry.text}"` : ""}`;
    case "counter":
      return `${entry.num} ${config.unit}${done}`;
    case "duration":
      return `${entry.num} min${done}`;
    case "slider":
      return `${entry.num} on a ${config.min}-${config.max} scale`;
    case "rating":
      return `${entry.num}/${config.max} stars`;
    default:
      return `"${entry.text}"`;
  }
}

function describeGoal({ habit }: DayHabitDto): string {
  const { config } = habit;
  if (habit.type === "counter") return `, goal ${config.target} ${config.unit}`;
  if (habit.type === "duration") return `, goal ${config.target} min`;
  return "";
}

/** Every habit on the day, with groups' sub-habits listed after their group. */
export function flatHabits(day: DayDto): DayHabitDto[] {
  return day.habits.flatMap((h) => [h, ...(h.children ?? [])]);
}

export function hasContent(day: DayDto): boolean {
  return (
    day.journal.trim().length > 0 ||
    flatHabits(day).some((h) => h.entry !== null) ||
    day.prompts.some((p) => p.answer?.trim())
  );
}

/** The day as the model sees it. Unscheduled habits appear only when logged. */
export function renderDay(
  day: DayDto,
  refById: Map<string, string>,
  recent: { periodStart: string; narrative: string }[],
): string {
  const line = (h: DayHabitDto, indent = "") => {
    const builds = h.habit.links.map((id) => refById.get(id)).filter(Boolean);
    const missed = !h.entry && h.scheduled ? ", scheduled today" : "";
    return (
      `${indent}- ${h.habit.name} (${HABIT_TYPE_LABELS[h.habit.type].toLowerCase()}${describeGoal(h)}): ` +
      `${describeEntry(h)}${missed}.${builds.length ? ` Builds: ${builds.join(", ")}` : ""}`
    );
  };
  const habits = day.habits
    .filter((h) => h.scheduled || h.entry || h.children?.some((c) => c.entry))
    .flatMap((h) =>
      h.habit.type === "group"
        ? [
            `- ${h.habit.name} (group, ${GROUP_RULE_LABELS[h.habit.config.rule ?? "all"].toLowerCase()}): ` +
              `${groupProgress(h)} sub-habits done${isDayHabitDone(h) ? ", group complete" : ""}.`,
            ...(h.children ?? []).map((c) => line(c, "  ")),
          ]
        : [line(h)],
    );
  const answered = day.prompts.filter((p) => p.answer?.trim());
  return [
    `Day: ${day.date} (${WEEKDAYS[dayOfWeek(day.date)]})`,
    `Journal:\n${day.journal.trim() || "(empty)"}`,
    `Habits:\n${habits.join("\n") || "(none)"}`,
    answered.length
      ? `Answers to today's questions:\n${answered.map((p) => `Q: ${p.question}\nA: ${p.answer}`).join("\n")}`
      : null,
    `Recent days:\n${recent.map((r) => `- ${r.periodStart}: ${r.narrative}`).join("\n") || "(none yet)"}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

/**
 * "End my day": the model reviews the day and moves ratings. Re-running an edited day voids
 * the previous recap's changes and replaces them. Running it again on an unchanged day
 * returns the existing recap.
 */
export async function runDailyRecap(
  db: Database,
  llm: LlmClient,
  userId: string,
  date: string,
): Promise<DayDto> {
  const { day } = await requireEditable(db, userId, date);
  await ensureCurrentSeason(db, userId);
  const ctx = await loadLeafContext(db, userId);
  if (!ctx) throw conflict("Finish onboarding before recapping days");
  const view = await getDay(db, userId, day);
  const existing = await recapRepo.findActiveDaily(db, userId, day);
  if (existing && view.status === "recapped") return view;
  if (!hasContent(view)) throw badRequest("Log something before ending the day");
  if ((await recapRepo.countDaily(db, userId, day)) >= MAX_RECAPS_PER_DAY) {
    throw conflict(`This day has been recapped ${MAX_RECAPS_PER_DAY} times, the daily limit`);
  }

  // Ratings as they stand without this day's previous recap.
  const events = (await eventRepo.findActiveBySeason(db, ctx.season.id)).filter(
    (e) => !existing || e.recapId !== existing.id,
  );
  const values = computeNodeValues(ctx.nodes, leafValuesFromEvents(events));
  const { refById, idByRef } = refsFor(ctx.nodes);
  const recent = await recapRepo.findRecentDaily(db, userId, addDays(day, -7), day);
  // Long-term memory: the profile, older days sharing words with this one, the week's focus.
  const [profile, focus, memories] = await Promise.all([
    userRepo.findProfileSummary(db, userId),
    currentFocus(db, userId),
    searchMemories(
      db,
      userId,
      [
        view.journal,
        ...flatHabits(view)
          .filter((h) => h.entry)
          .map((h) => h.habit.name),
      ].join(" "),
      { before: addDays(day, -7) },
    ),
  ]);

  const output = await llm.generateStructured({
    purpose: "recap.daily",
    userId,
    schema: dailyRecapOutputSchema,
    system: dailyRecapPrompt.system,
    prompt: [
      `What you know about the user:\n${profile || "(nothing yet)"}`,
      "Current ratings (Overall is the implicit root):",
      renderTree(toPromptNodes(ctx.nodes, refById, values), true),
      `This week's focus goals:\n${focus.map((g) => `- ${g.title}: ${g.detail}`).join("\n") || "(none)"}`,
      renderDay(view, refById, recent),
      `Related older days:\n${renderMemories(memories) || "(none)"}`,
    ].join("\n\n"),
    promptVersion: dailyRecapPrompt.version,
  });
  const changes = normalizeRecapChanges(output.changes, idByRef, ctx.leaves);
  const nextPrompts = normalizePrompts(output.nextPrompts);
  const flags = output.flags.map((f) => f.trim()).filter(Boolean);

  let recapId: string | null = null;
  try {
    await db.transaction(async (tx) => {
      if (existing) {
        await recapRepo.supersede(tx, existing.id);
        await eventRepo.voidByRecap(tx, existing.id);
      }
      const recap = await recapRepo.insert(tx, {
        userId,
        seasonId: ctx.season.id,
        kind: "daily",
        periodStart: day,
        periodEnd: day,
        narrative: output.narrative.trim(),
        output: { flags, nextPrompts },
        promptVersion: dailyRecapPrompt.version,
      });
      recapId = recap.id;
      await eventRepo.insertMany(
        tx,
        changes.map((c) => ({
          nodeId: c.nodeId,
          seasonId: ctx.season.id,
          delta: c.delta,
          source: "daily_recap" as const,
          reason: c.reason,
          evidence: c.evidence ? { quote: c.evidence } : null,
          recapId: recap.id,
        })),
      );
      await dayRepo.ensure(tx, userId, day);
      await dayRepo.setStatus(tx, userId, day, "recapped");

      // Tomorrow's questions, unless the user already started answering a set there.
      const next = await dayRepo.find(tx, userId, addDays(day, 1));
      const current = (next?.prompts ?? []) as GuidedPromptDto[];
      if (nextPrompts.length && !current.some((p) => p.answer)) {
        await dayRepo.setPrompts(
          tx,
          userId,
          addDays(day, 1),
          nextPrompts.map((question) => ({ question, answer: null })),
        );
      }
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw conflict("This day is already being recapped");
    throw error;
  }
  // A recap of a past day changes which attributes were active from then on.
  await invalidateDecay(db, userId, day);
  await applyDecay(db, userId);
  await awardBadges(db, userId, recapId);
  return getDay(db, userId, day);
}
