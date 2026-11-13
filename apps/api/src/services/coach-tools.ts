import {
  addDays,
  EXERCISE_CATEGORIES,
  EXERCISE_TRACKING,
  formatSet,
  fromDisplayDistance,
  fromDisplayLength,
  fromDisplayWeight,
  HABIT_TYPE_LABELS,
  HABIT_COMPARES,
  HABIT_TYPES,
  isValidDate,
  isAvoid,
  describeHabitGoal,
  formatTimeOfDay,
  isEntryDone,
  MAX_COACH_ACTIONS,
  MAX_HABIT_LINKS,
  MAX_OBJECTIVE_DAYS,
  MAX_OBJECTIVE_TARGET,
  MAX_SETS_PER_EXERCISE,
  MAX_WORKOUT_EXERCISES,
  TRACKING_FIELDS,
  TRACKING_LABELS,
  normalizeHabitConfig,
  type CoachActionDto,
  type CoachSuggestionDto,
  type DayDto,
  type DayHabitDto,
  type ExerciseTracking,
  type HabitConfig,
  type HabitDto,
  type HabitType,
  type SetField,
  type UnitSystem,
  type WorkoutExerciseDto,
  type WorkoutSetDto,
} from "@rlo/shared";
import { tool, type ToolSet } from "ai";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import type { Database } from "../db/client";
import { getDay, saveEntry, saveObjective } from "./day-service";
import { createExercise, loadLookup, type Lookup } from "./workout-service";

/**
 * The coach's tools (DESIGN.md §5.9): logging workouts, habits and goal progress the player
 * describes in chat. Each one goes through the same services as the day log, so validation,
 * the backfill window and recap staleness all apply, and each becomes an undoable receipt.
 */

/** Short refs the model uses instead of uuids. */
export interface CoachRefs {
  habits: Map<string, HabitDto>;
  goals: Map<string, DayDto["objectives"][number]["objective"]>;
}

/** Habits and manual goals on a day's log, as short refs (h1, g1). Groups log via sub-habits. */
export function refsForDay(day: DayDto): CoachRefs {
  const habits = day.habits
    .flatMap((h) => (h.habit.type === "group" ? (h.children ?? []) : [h]))
    .map((h) => h.habit);
  const goals = day.objectives
    .filter((o) => o.objective.source === "manual")
    .map((o) => o.objective);
  return {
    habits: new Map(habits.map((h, i) => [`h${i + 1}`, h])),
    goals: new Map(goals.map((g, i) => [`g${i + 1}`, g])),
  };
}

const goalHint = (h: HabitDto) => {
  if (isAvoid(h.config))
    return h.config.target !== null ? `, limit at most ${h.config.target}` : "";
  const goal = describeHabitGoal(h.type, h.config);
  return goal ? `, goal ${goal}` : "";
};

/** What a habit's number means, so the model logs it in the right shape. */
function entryHint(h: HabitDto) {
  const avoid = isAvoid(h.config);
  switch (h.type) {
    case "checkbox":
    case "checknote":
      return avoid
        ? "num 0 = stayed clean, 1 = slipped" + (h.type === "checknote" ? "; text a note" : "")
        : "num 1 = done, 0 = not done" + (h.type === "checknote" ? "; text a note" : "");
    case "counter":
      return `num = count${h.config.unit ? ` of ${h.config.unit}` : ""}${goalHint(h)}`;
    case "duration":
      return `num = minutes${goalHint(h)}`;
    case "time":
      return `num = minutes after midnight (6:30 AM = 390)${goalHint(h)}`;
    case "slider":
      return `num ${h.config.min ?? 0}-${h.config.max ?? 10}${goalHint(h)}`;
    case "rating":
      return `num 1-${h.config.max ?? 5}${goalHint(h)}`;
    default:
      return "text = what they wrote";
  }
}

const entryText = (h: DayHabitDto) => {
  if (!h.entry) return "not logged";
  if (h.entry.text?.trim()) return `"${h.entry.text.trim().slice(0, 60)}"`;
  return isEntryDone(h.habit.type, h.habit.config, h.entry)
    ? `done (${h.entry.num})`
    : `logged ${h.entry.num}`;
};

/** The day in focus as the coach sees it: what's logged and what can still be logged. */
export function renderDayLog(day: DayDto, refs: CoachRefs, features: Record<string, boolean>) {
  const byId = new Map(
    day.habits
      .flatMap((h) => (h.habit.type === "group" ? (h.children ?? []) : [h]))
      .map((h) => [h.habit.id, h]),
  );
  const habits = [...refs.habits].map(([ref, h]) => {
    const item = byId.get(h.id);
    return (
      `- [${ref}] ${h.name} (${HABIT_TYPE_LABELS[h.type].toLowerCase()}${isAvoid(h.config) ? ", avoid" : ""}` +
      `${item && !item.scheduled ? ", not scheduled" : ""}; ${entryHint(h)}): ${item ? entryText(item) : "not logged"}`
    );
  });
  const goals = [...refs.goals].map(([ref, g]) => {
    const logged = day.objectives.find((o) => o.objective.id === g.id)?.logged ?? null;
    return g.kind === "reach"
      ? `- [${ref}] ${g.name} (reach ${g.target} ${g.unit}, now ${g.progress.current}): ` +
          `${logged === null ? "no reading this day" : `reading ${logged}`}`
      : `- [${ref}] ${g.name} (${g.progress.current} of ${g.target} ${g.unit}): ` +
          `${logged === null ? "nothing logged this day" : `${logged} logged this day`}`;
  });
  return [
    `The day in focus: ${day.date}${day.editable ? "" : " (read-only, past the backfill window)"}.`,
    features.journal && `Journal: ${day.journal.trim() || "(empty)"}`,
    day.prompts.some((p) => p.answer?.trim()) &&
      `Answers:\n${day.prompts
        .filter((p) => p.answer?.trim())
        .map((p) => `- ${p.question} ${p.answer}`)
        .join("\n")}`,
    features.habits && `Habits (for log_habit):\n${habits.join("\n") || "(none)"}`,
    features.workouts &&
      `Workouts logged this day:\n${day.workouts.map((w) => `- ${w.name}: ${w.lines.join("; ")}`).join("\n") || "(none)"}`,
    features.goals && `Goals you can log to (log_goal_progress):\n${goals.join("\n") || "(none)"}`,
    day.recap && `This day's recap: ${day.recap.narrative}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

/** The exercise library, compactly, so the model can pick ids. */
export function renderExercises(lookup: Lookup) {
  return [...lookup.values()]
    .filter((e) => !e.archived)
    .map((e) => `${e.id}: ${e.name} [${e.tracking}]`)
    .join("\n");
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
const bare = (name: string) => norm(name.replace(/\(.*?\)/g, ""));

/** An exercise by id or name; otherwise the closest names, to offer the model. */
export function resolveExercise(lookup: Lookup, query: string) {
  const live = [...lookup.values()].filter((e) => !e.archived);
  const q = norm(query);
  const byId = lookup.get(query.trim());
  if (byId && !byId.archived) return { match: byId, close: [] };
  const exact = live.filter((e) => norm(e.name) === q);
  if (exact.length === 1) return { match: exact[0]!, close: [] };
  // "Squat" means "Squat (Barbell)" when only one exercise is just that.
  const plain = live.filter((e) => bare(e.name) === q);
  if (plain.length === 1) return { match: plain[0]!, close: [] };
  const words = q.split(" ").filter(Boolean);
  const scored = live
    .map((e) => ({ e, hits: words.filter((w) => norm(e.name).split(" ").includes(w)).length }))
    .filter((x) => x.hits > 0)
    .sort((a, b) => b.hits - a.hits);
  const all = scored.filter((x) => x.hits === words.length);
  if (all.length === 1) return { match: all[0]!.e, close: [] };
  return { match: null, close: scored.slice(0, 5).map((x) => x.e.name) };
}

const SET_FIELD_KEYS: Record<SetField, keyof WorkoutSetDto> = {
  weight: "weightKg",
  reps: "reps",
  duration: "durationS",
  distance: "distanceM",
  length: "distanceM",
  attempts: "attempts",
};

const message = (error: unknown) =>
  error instanceof HTTPException || error instanceof Error ? error.message : String(error);

export interface CoachToolContext {
  db: Database;
  userId: string;
  today: string;
  units: UnitSystem;
  refs: CoachRefs;
  features: Record<string, boolean>;
  /** Whether the day in focus can still be logged (creating things works either way). */
  editable: boolean;
  /** Tree refs (n3) to node ids, and the leaves habits and goals can build, by name. */
  idByRef: Map<string, string>;
  leaves: Map<string, string>;
  /** Receipts for what the tools logged, in order. */
  actions: CoachActionDto[];
  /** Drafts the player reviews before anything is saved (indexes are set by the caller). */
  drafts: CoachSuggestionDto[];
  /** Habit names that exist already, to keep drafts from duplicating them. */
  habitNames: string[];
}

const dateField = z
  .string()
  .nullable()
  .describe("YYYY-MM-DD the day it happened; null for the day in focus");

const exercisesField = (units: UnitSystem) => {
  const weight = units === "imperial" ? "lb" : "kg";
  const distance = units === "imperial" ? "miles" : "km";
  return z.array(
    z.object({
      exercise: z.string().describe("An id from the exercise library, or its name"),
      newExercise: z
        .object({ category: z.enum(EXERCISE_CATEGORIES), tracking: z.enum(EXERCISE_TRACKING) })
        .nullable()
        .describe("Only when nothing in the library fits: adds it as the user's own exercise"),
      sets: z.array(
        z.object({
          weight: z.number().nullable().describe(`In ${weight}; weight_reps only`),
          reps: z.number().nullable().describe("Reps, or makes for makes/attempts"),
          seconds: z.number().nullable().describe("duration and distance+time only"),
          distance: z
            .number()
            .nullable()
            .describe(
              `In ${distance} for distance fields, ${units === "imperial" ? "feet" : "meters"} for length fields`,
            ),
          attempts: z.number().nullable().describe("makes/attempts only"),
        }),
      ),
    }),
  );
};
type ExercisesInput = z.infer<ReturnType<typeof exercisesField>>;

/**
 * Exercises as stored, resolving names to the library (or adding the player's own). Sets with
 * none of the numbers their exercise tracks are dropped, unless `keepEmpty` (a template's plan
 * can leave numbers blank).
 */
async function buildExercises(
  c: CoachToolContext,
  input: ExercisesInput,
  { done, keepEmpty }: { done: boolean; keepEmpty: boolean },
): Promise<{ exercises: WorkoutExerciseDto[]; lookup: Lookup } | { error: string }> {
  let lookup = await loadLookup(c.db, c.userId);
  const exercises: WorkoutExerciseDto[] = [];
  for (const e of input.slice(0, MAX_WORKOUT_EXERCISES)) {
    const resolved = resolveExercise(lookup, e.exercise);
    let match = resolved.match;
    if (!match && e.newExercise) {
      const created = await createExercise(c.db, c.userId, {
        name: e.exercise.trim().slice(0, 60),
        ...e.newExercise,
      });
      lookup = await loadLookup(c.db, c.userId);
      match = lookup.get(created.id) ?? null;
    }
    if (!match) {
      return {
        error:
          `"${e.exercise}" isn't in the library.` +
          (resolved.close.length ? ` Closest: ${resolved.close.join(", ")}.` : "") +
          " Use one of those, or pass newExercise to add it.",
      };
    }
    const fields = TRACKING_FIELDS[match.tracking];
    const sets = e.sets.slice(0, MAX_SETS_PER_EXERCISE).map((s): WorkoutSetDto => ({
      kind: "normal",
      weightKg: s.weight !== null ? fromDisplayWeight(s.weight, c.units) : null,
      reps: s.reps !== null ? Math.round(s.reps) : null,
      durationS: s.seconds !== null ? Math.round(s.seconds) : null,
      distanceM:
        s.distance === null
          ? null
          : fields.includes("length")
            ? fromDisplayLength(s.distance, c.units)
            : fromDisplayDistance(s.distance, c.units),
      attempts: s.attempts !== null ? Math.round(s.attempts) : null,
      done,
    }));
    exercises.push({
      exerciseId: match.id,
      notes: "",
      restS: null,
      sets: keepEmpty
        ? sets
        : sets.filter((s) => fields.some((f) => s[SET_FIELD_KEYS[f]] !== null)),
    });
  }
  return { exercises, lookup };
}

/** "Squat (Barbell): 3 × 225 lb × 5 · Leg Press: 3 × 270 lb × 12" */
function describeExercises(exercises: WorkoutExerciseDto[], lookup: Lookup, units: UnitSystem) {
  return exercises
    .map((x) => {
      const info = lookup.get(x.exerciseId);
      const last = x.sets.at(-1);
      const shown = last && info ? formatSet(info.tracking, last, units) : "";
      return `${info?.name ?? "Exercise"}: ${x.sets.length}${shown && shown !== "—" ? ` × ${shown}` : " sets"}`;
    })
    .join(" · ");
}

/** Tools for the parts of the app the player has switched on. */
export function coachTools(c: CoachToolContext, focusDate: string): ToolSet {
  const full = () =>
    c.actions.length >= MAX_COACH_ACTIONS
      ? { error: "That's all the logging for this turn; ask the user to send another message." }
      : null;
  // One at a time, in call order: goal amounts add to what's there, and receipts stay ordered.
  let queue: Promise<unknown> = Promise.resolve();
  const serial = <T>(run: () => Promise<T>): Promise<T> => {
    const next = queue.then(run, run);
    queue = next.catch(() => undefined);
    return next;
  };
  const tools: ToolSet = {};

  if (c.features.workouts) {
    tools.draft_workout = tool({
      description:
        "Draft a finished workout the user describes, with every set they did. It shows as a " +
        "card they check, tweak and save; nothing is logged until they do. Ask first if you " +
        "don't know the exercises and roughly the sets, reps and weights; don't invent numbers.",
      inputSchema: z.object({
        date: dateField,
        name: z.string().describe('Short name, e.g. "Leg Day"'),
        durationMinutes: z.number().nullable().describe("How long it took; null if unknown"),
        notes: z.string().nullable(),
        exercises: exercisesField(c.units).describe("In the order they were done"),
      }),
      execute: (input) =>
        serial(async () => {
          if (full()) return full();
          const date = input.date ?? focusDate;
          if (!isValidDate(date) || date > c.today) {
            return { error: "Workouts can't be in the future" };
          }
          try {
            const built = await buildExercises(c, input.exercises, {
              done: true,
              keepEmpty: false,
            });
            if ("error" in built) return built;
            const exercises = built.exercises.filter((e) => e.sets.length > 0);
            if (!exercises.length) return { error: "A workout needs at least one set" };
            const sets = exercises.reduce((n, x) => n + x.sets.length, 0);
            const name = input.name.trim().slice(0, 80) || "Workout";
            c.drafts.push({
              index: 0,
              kind: "workout",
              name,
              date,
              durationS: Math.round((input.durationMinutes ?? Math.max(20, 3 * sets)) * 60),
              notes: (input.notes ?? "").trim().slice(0, 2000),
              exercises,
              reason: "",
              status: "pending",
            });
            return {
              ok: true,
              drafted: `${name} on ${date}: ${describeExercises(exercises, built.lookup, c.units)}`,
              note: "Not saved yet: ask if it's right; they save it from the card.",
            };
          } catch (error) {
            return { error: message(error) };
          }
        }),
    });

    tools.draft_workout_template = tool({
      description:
        "Draft a workout template (a routine they can start from the Train page): its " +
        "exercises with the planned sets, numbers null where they haven't said. They review " +
        "and save it from the card.",
      inputSchema: z.object({
        name: z.string().describe('e.g. "Push Day"'),
        notes: z.string().nullable(),
        exercises: exercisesField(c.units).describe("In order; one entry per planned set"),
      }),
      execute: (input) =>
        serial(async () => {
          if (full()) return full();
          try {
            const built = await buildExercises(c, input.exercises, {
              done: false,
              keepEmpty: true,
            });
            if ("error" in built) return built;
            if (!built.exercises.length) return { error: "A template needs an exercise" };
            const name = input.name.trim().slice(0, 80) || "Routine";
            c.drafts.push({
              index: 0,
              kind: "template",
              name,
              notes: (input.notes ?? "").trim().slice(0, 2000),
              exercises: built.exercises,
              reason: "",
              status: "pending",
            });
            return {
              ok: true,
              drafted: `Template ${name}: ${describeExercises(built.exercises, built.lookup, c.units)}`,
              note: "Not saved yet: they review and save it from the card.",
            };
          } catch (error) {
            return { error: message(error) };
          }
        }),
    });
  }

  if (c.features.habits && c.editable) {
    tools.log_habit = tool({
      description:
        "Log one of the user's habits for a day when they tell you they did it (or slipped on " +
        "an avoid habit). Use the number or text shape listed for the habit.",
      inputSchema: z.object({
        habit: z.string().describe("The habit's ref, e.g. h2"),
        date: dateField,
        num: z.number().nullable(),
        text: z.string().nullable(),
      }),
      execute: (input) =>
        serial(async () => {
          if (full()) return full();
          const habit = c.refs.habits.get(input.habit.trim());
          if (!habit) return { error: `No habit ${input.habit}; use a ref from the list` };
          const date = input.date ?? focusDate;
          try {
            const before = await getDay(c.db, c.userId, date);
            const previous =
              before.habits
                .flatMap((h) => [h, ...(h.children ?? [])])
                .find((h) => h.habit.id === habit.id)?.entry ?? null;
            await saveEntry(c.db, c.userId, date, habit.id, {
              num: input.num,
              text: input.text,
            });
            const entry = { num: input.num, text: input.text };
            const done = isEntryDone(habit.type, habit.config as HabitConfig, entry);
            const detail = input.text?.trim()
              ? input.text.trim().slice(0, 80)
              : habit.type === "checkbox" || habit.type === "checknote"
                ? done
                  ? isAvoid(habit.config)
                    ? "Stayed clean"
                    : "Done"
                  : isAvoid(habit.config)
                    ? "Slipped"
                    : "Not done"
                : habit.type === "time"
                  ? formatTimeOfDay(input.num ?? 0)
                  : `${input.num}${habit.type === "duration" ? " min" : habit.config.unit ? ` ${habit.config.unit}` : ""}`;
            c.actions.push({
              index: c.actions.length,
              kind: "habit",
              habitId: habit.id,
              previous,
              date,
              title: habit.name,
              detail,
              undone: false,
            });
            return { ok: true, logged: `${habit.name} on ${date}: ${detail}` };
          } catch (error) {
            return { error: message(error) };
          }
        }),
    });
  }

  if (c.features.goals && c.editable) {
    tools.log_goal_progress = tool({
      description:
        "Add progress to one of the user's goals for a day. For a total goal, `amount` is what " +
        "they did (added to anything already logged that day); for a reach goal, it's their " +
        "current reading (e.g. today's weight or balance).",
      inputSchema: z.object({
        goal: z.string().describe("The goal's ref, e.g. g1"),
        date: dateField,
        amount: z.number(),
      }),
      execute: (input) =>
        serial(async () => {
          if (full()) return full();
          const goal = c.refs.goals.get(input.goal.trim());
          if (!goal) return { error: `No goal ${input.goal}; use a ref from the list` };
          const date = input.date ?? focusDate;
          try {
            const before = await getDay(c.db, c.userId, date);
            const previous =
              before.objectives.find((o) => o.objective.id === goal.id)?.logged ?? null;
            const value = goal.kind === "reach" ? input.amount : (previous ?? 0) + input.amount;
            await saveObjective(c.db, c.userId, date, goal.id, value);
            const detail =
              goal.kind === "reach"
                ? `Reading ${input.amount} ${goal.unit}`
                : `+${input.amount} ${goal.unit}`;
            c.actions.push({
              index: c.actions.length,
              kind: "goal",
              objectiveId: goal.id,
              previous,
              date,
              title: goal.name,
              detail,
              undone: false,
            });
            return { ok: true, logged: `${goal.name} on ${date}: ${detail}` };
          } catch (error) {
            return { error: message(error) };
          }
        }),
    });
  }
  const refs = z
    .array(z.string())
    .describe("Attribute refs (leaves, e.g. n3) it builds; [] if none fits");
  const toLinks = (list: string[]) =>
    [
      ...new Set(list.map((r) => c.idByRef.get(r.trim())).filter((id) => id && c.leaves.has(id))),
    ].slice(0, MAX_HABIT_LINKS) as string[];
  const builds = (links: string[]) =>
    links.length ? ` · builds ${links.map((id) => c.leaves.get(id)).join(", ")}` : "";

  if (c.features.habits) {
    tools.draft_habit = tool({
      description:
        "Draft a habit: when they ask for one, or when you recommend one. It shows as a card " +
        "with every detail; they tweak and add it. Never duplicate an existing habit.",
      inputSchema: z.object({
        name: z.string().describe("Short, e.g. 'Read' or 'No soda'"),
        type: z
          .enum(HABIT_TYPES.filter((t) => t !== "group") as [HabitType, ...HabitType[]])
          .describe(
            "Prefer checkbox, counter or duration; time for a time of day (wake-up, bedtime)",
          ),
        days: z.array(z.number()).describe("Weekdays 0=Sunday..6=Saturday; [] for every day"),
        target: z
          .number()
          .nullable()
          .describe(
            "counter: daily count; duration: daily minutes; time: minutes after midnight " +
              "(6:30 AM = 390); slider/rating: optional line; avoid: the daily limit",
          ),
        compare: z
          .enum(HABIT_COMPARES)
          .nullable()
          .describe(
            "Build habits: atLeast (reach it, the default), moreThan (beat it), atMost / " +
              "lessThan (stay under it). For time, less is earlier: atMost = by, lessThan = before",
          ),
        unit: z.string().nullable().describe("counter only, e.g. 'pages'"),
        avoid: z.boolean().describe("true for a habit to cut back on or quit"),
        refs,
        reason: z.string().describe("One sentence on why, tied to what you know about them"),
      }),
      execute: (input) =>
        serial(async () => {
          if (full()) return full();
          const name = input.name.trim().slice(0, 60);
          const taken = [
            ...c.habitNames,
            ...c.drafts.filter((d) => d.kind === "habit").map((d) => d.name),
          ];
          if (!name || taken.some((n) => n.toLowerCase() === name.toLowerCase())) {
            return { error: `They already have a habit called ${name}` };
          }
          const days = [
            ...new Set(input.days.map(Math.round).filter((d) => d >= 0 && d <= 6)),
          ].sort();
          const config = normalizeHabitConfig(input.type, {
            target: input.target,
            unit: input.unit?.trim() || null,
            direction: input.avoid ? "avoid" : "build",
            compare: input.compare,
          });
          const nodeIds = toLinks(input.refs);
          c.drafts.push({
            index: 0,
            kind: "habit",
            name,
            habitType: input.type,
            days: days.length ? days : [0, 1, 2, 3, 4, 5, 6],
            target: config.target,
            unit: config.unit,
            avoid: input.avoid,
            compare: input.avoid ? null : (config.compare ?? null),
            nodeIds,
            reason: input.reason.trim(),
            status: "pending",
          });
          return {
            ok: true,
            drafted: `${name} (${HABIT_TYPE_LABELS[input.type]}${input.avoid ? ", avoid" : ""})${builds(nodeIds)}`,
            note: "Not added yet: they review and add it from the card.",
          };
        }),
    });
  }

  if (c.features.goals) {
    tools.draft_goal = tool({
      description:
        "Draft a goal: when they ask for one, or when you recommend one. total: reach a " +
        "total by the deadline ('Run 50 miles'). reach: move a number from where it is to a " +
        "target ('Weigh 185', 'Pay the card down to 0'). They tweak and add it from the card.",
      inputSchema: z.object({
        name: z.string(),
        kind: z.enum(["total", "reach"]),
        target: z.number(),
        unit: z.string().describe("What it counts, e.g. 'miles', 'lb', 'dollars'"),
        startValue: z.number().nullable().describe("reach only: where they are now"),
        deadline: z
          .string()
          .describe("YYYY-MM-DD, inclusive; 'this month' means the month's last day"),
        refs,
        reason: z.string().describe("One sentence on why, tied to what you know about them"),
      }),
      execute: (input) =>
        serial(async () => {
          if (full()) return full();
          if (input.kind === "reach" && input.startValue === null) {
            return { error: "Ask where they are now first; a reach goal needs a startValue" };
          }
          const last = addDays(c.today, MAX_OBJECTIVE_DAYS - 1);
          if (!isValidDate(input.deadline) || input.deadline < c.today || input.deadline > last) {
            return { error: `The deadline must be a date from ${c.today} to ${last}` };
          }
          if (!Number.isFinite(input.target) || (input.kind === "total" && input.target <= 0)) {
            return { error: "A total goal needs a target above 0" };
          }
          const nodeIds = toLinks(input.refs);
          const name = input.name.trim().slice(0, 80);
          const unit = input.unit.trim().slice(0, 20) || "times";
          c.drafts.push({
            index: 0,
            kind: "goal",
            name,
            goalKind: input.kind,
            target: Math.min(MAX_OBJECTIVE_TARGET, input.target),
            unit,
            startValue: input.kind === "reach" ? input.startValue : null,
            endsOn: input.deadline,
            durationDays:
              Math.round(
                (Date.parse(`${input.deadline}T00:00:00Z`) - Date.parse(`${c.today}T00:00:00Z`)) /
                  86_400_000,
              ) + 1,
            nodeIds,
            reason: input.reason.trim(),
            status: "pending",
          });
          return {
            ok: true,
            drafted: `${name}: ${input.kind === "reach" ? `${input.startValue} → ` : ""}${input.target} ${unit} by ${input.deadline}${builds(nodeIds)}`,
            note: "Not added yet: they review and add it from the card.",
          };
        }),
    });
  }
  return tools;
}

/** For the prompt: what each tracking kind's sets record. */
export const TRACKING_NOTE = EXERCISE_TRACKING.map(
  (t: ExerciseTracking) =>
    `${t} (${TRACKING_LABELS[t].toLowerCase()}): ${TRACKING_FIELDS[t].join(", ")}`,
).join("; ");
