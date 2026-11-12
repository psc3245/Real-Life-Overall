import {
  MAX_COACH_MESSAGES_PER_DAY,
  type CoachStateDto,
  type DayDto,
  type WorkoutHistoryDto,
  type HabitDto,
  type ObjectiveDto,
  type ScoutingReportDto,
} from "@rlo/shared";
import { describe, expect, it } from "vitest";
import { coachMessages, users } from "../src/db/schema";
import { createRatedApp, json } from "./flows";
import { jsonResult, toolCallResult } from "./helpers";

// Standard tree refs: Fitness n1, Career n2, Cardio n3, Strength n4. Leaves n2, n3, n4.
const suggestion = (over: Record<string, unknown>) => ({
  kind: "habit",
  name: "",
  reason: "Because.",
  refs: [],
  habitType: null,
  days: [],
  target: null,
  unit: null,
  durationDays: null,
  section: null,
  importance: null,
  ...over,
});

const reply = (over: Record<string, unknown> = {}) =>
  jsonResult({
    reply: "Cardio is your biggest gap. Two short runs a week would move it.",
    suggestions: [
      suggestion({
        name: "Short run",
        habitType: "duration",
        days: [2, 4, 9],
        target: 20,
        refs: ["n3", "n1", "n9"],
      }),
      suggestion({ name: "morning run", habitType: "checkbox" }), // duplicate habit
      suggestion({
        kind: "goal",
        name: "Run 30 miles",
        target: 30,
        unit: "miles",
        durationDays: 30,
        refs: ["n3"],
      }),
      suggestion({
        kind: "report",
        name: "Endurance",
        section: "priority",
        importance: 4,
        refs: ["n3"],
      }),
    ],
    ...over,
  });

const body = async <T>(res: Response) => (await res.json()) as T;

async function setup(responses: Parameters<typeof createRatedApp>[0] = [reply()]) {
  const t = await createRatedApp(responses);
  await t.request("/habits", {
    method: "POST",
    ...json({ name: "Morning run", type: "checkbox", startsOn: "2026-01-01" }),
  });
  const send = (content: string) =>
    t.request("/coach/messages", { method: "POST", ...json({ content }) });
  const resolve = (id: string, index: number, action: string) =>
    t.request(`/coach/messages/${id}/suggestions/${index}/${action}`, { method: "POST" });
  return { ...t, send, resolve };
}

describe("coach", () => {
  it("answers with context and keeps sensible suggestions", async () => {
    const t = await setup();
    const empty = await body<CoachStateDto>(await t.request("/coach"));
    expect(empty).toEqual({ messages: [], remaining: MAX_COACH_MESSAGES_PER_DAY });

    const state = await body<CoachStateDto>(await t.send("  What should I work on?  "));
    expect(state.remaining).toBe(MAX_COACH_MESSAGES_PER_DAY - 1);
    expect(state.messages.map((m) => [m.role, m.content])).toEqual([
      ["user", "What should I work on?"],
      ["assistant", "Cardio is your biggest gap. Two short runs a week would move it."],
    ]);
    const s = state.messages[1]!.suggestions;
    expect(s.map((x) => [x.index, x.kind])).toEqual([
      [0, "habit"],
      [1, "goal"],
      [2, "report"],
    ]);
    expect(s[0]).toMatchObject({
      name: "Short run",
      days: [2, 4],
      target: 20,
      nodeIds: [t.nodeId("Cardio")], // categories and unknown refs dropped
    });

    const call = t.model.doGenerateCalls.at(-1)!;
    const prompt = JSON.stringify(call.prompt);
    expect(prompt).toContain("Scouting Report:");
    expect(prompt).toContain("Morning run (done / not done, daily): done 0 of");
    expect(prompt).toContain("[n3] Cardio: 70.0");
    expect(prompt).toContain("What should I work on?");
  });

  it("sends earlier messages with each turn", async () => {
    const t = await setup([reply(), reply({ reply: "Sure.", suggestions: [] })]);
    await t.send("First question");
    await t.send("Second question");
    const prompt = JSON.stringify(t.model.doGenerateCalls.at(-1)!.prompt);
    expect(prompt).toContain("First question");
    expect(prompt).toContain("Cardio is your biggest gap");
    expect(prompt).toContain("Second question");
  });

  it("adds suggested habits, goals and report lines with one tap", async () => {
    const t = await setup();
    const state = await body<CoachStateDto>(await t.send("Ideas?"));
    const id = state.messages[1]!.id;

    const habit = await body<{ habit: HabitDto }>(await t.resolve(id, 0, "accept"));
    expect(habit.habit).toMatchObject({ name: "Short run", type: "duration" });
    expect(habit.habit.links).toEqual([t.nodeId("Cardio")]);

    const goal = await body<{ goal: ObjectiveDto }>(await t.resolve(id, 1, "accept"));
    expect(goal.goal).toMatchObject({ name: "Run 30 miles", target: 30, unit: "miles" });
    const days = (Date.parse(goal.goal.endsOn) - Date.parse(goal.goal.startsOn)) / 86_400_000;
    expect(days).toBe(29);

    const after = await body<{ state: CoachStateDto }>(await t.resolve(id, 2, "accept"));
    expect(after.state.messages[1]!.suggestions.map((x) => x.status)).toEqual([
      "accepted",
      "accepted",
      "accepted",
    ]);
    const report = await body<ScoutingReportDto>(await t.request("/scouting-report"));
    expect(report.priorities).toEqual([
      expect.objectContaining({ area: "Endurance", importance: 4, nodeName: "Cardio" }),
    ]);
    expect(report.updatedBy).toBe("user");

    expect((await t.resolve(id, 0, "dismiss")).status).toBe(409);
    expect((await t.resolve(id, 9, "accept")).status).toBe(404);
    expect((await t.resolve(id, 0, "maybe")).status).toBe(400);
  });

  it("doesn't suggest switched-off parts of the app", async () => {
    const t = await setup();
    await t.db.update(users).set({ preferences: { features: { habits: false } } });
    const state = await body<CoachStateDto>(await t.send("Ideas?"));
    expect(state.messages[1]!.suggestions.map((x) => x.kind)).toEqual(["goal", "report"]);
    expect(JSON.stringify(t.model.doGenerateCalls.at(-1)!.prompt)).toContain(
      "Switched off by the user: habits",
    );
  });

  it("stores nothing when the model fails, and caps messages per day", async () => {
    const bad = jsonResult({ nope: true });
    const t = await setup([bad, bad, bad]);
    expect((await t.send("Hello")).status).toBe(502);
    expect((await body<CoachStateDto>(await t.request("/coach"))).messages).toEqual([]);

    const [user] = await t.db.select().from(users);
    await t.db.insert(coachMessages).values(
      Array.from({ length: MAX_COACH_MESSAGES_PER_DAY }, () => ({
        userId: user!.id,
        role: "user" as const,
        content: "spam",
      })),
    );
    expect((await body<CoachStateDto>(await t.request("/coach"))).remaining).toBe(0);
    const capped = await t.send("One more");
    expect(capped.status).toBe(429);

    const cleared = await body<CoachStateDto>(await t.request("/coach", { method: "DELETE" }));
    expect(cleared).toEqual({ messages: [], remaining: MAX_COACH_MESSAGES_PER_DAY });
  });

  it("validates messages", async () => {
    const t = await setup();
    expect((await t.send("   ")).status).toBe(400);
    expect((await t.send("x".repeat(1001))).status).toBe(400);
  });
});

describe("coach logging", () => {
  const done = jsonResult({ reply: "Logged it.", suggestions: [] });
  const set = (weight: number | null, reps: number | null) => ({
    weight,
    reps,
    seconds: null,
    distance: null,
    attempts: null,
  });
  const legDay = {
    date: null,
    name: "Leg Day",
    durationMinutes: 50,
    notes: null,
    exercises: [
      { exercise: "Squat", newExercise: null, sets: [set(225, 5), set(225, 5)] },
      { exercise: "leg-press", newExercise: null, sets: [set(300, 10)] },
      // No numbers at all: dropped.
      { exercise: "push-up", newExercise: null, sets: [set(null, null)] },
    ],
  };
  const action = async (t: Awaited<ReturnType<typeof setup>>, i = 0) => {
    const state = await body<CoachStateDto>(await t.request("/coach"));
    return { message: state.messages.at(-1)!, action: state.messages.at(-1)!.actions[i]! };
  };

  it("logs a workout the player describes, with a receipt that undo takes back", async () => {
    const t = await setup([toolCallResult(["log_workout", legDay]), done]);
    const res = await t.send("Hit legs: squats 2x5 at 225, leg press 300 for 10. 50 min.");
    expect(res.status).toBe(200);
    const history = await body<WorkoutHistoryDto>(await t.request("/workouts"));
    expect(history.workouts).toHaveLength(1);
    const w = history.workouts[0]!;
    expect(w).toMatchObject({ name: "Leg Day", endedAt: expect.any(String) });
    expect(w.exercises.map((e) => [e.exerciseId, e.sets.length])).toEqual([
      ["squat-barbell", 2],
      ["leg-press", 1],
    ]);
    expect(w.exercises[0]!.sets[0]!.weightKg).toBeCloseTo(102.06, 1); // 225 lb
    expect(w.summary.durationS).toBe(3000);

    const { message, action: a } = await action(t);
    expect(message.content).toBe("Logged it.");
    expect(a).toMatchObject({ kind: "workout", title: "Leg Day", undone: false });
    // The receipt rides along in later turns so the coach doesn't log it twice.
    expect(JSON.stringify(t.model.doGenerateCalls.at(-1)!.prompt)).toContain("Leg Day on ");

    const undo = await t.request(`/coach/messages/${message.id}/actions/0/undo`, {
      method: "POST",
    });
    expect(undo.status).toBe(200);
    expect((await body<WorkoutHistoryDto>(await t.request("/workouts"))).workouts).toEqual([]);
    expect((await action(t)).action.undone).toBe(true);
    const again = await t.request(`/coach/messages/${message.id}/actions/0/undo`, {
      method: "POST",
    });
    expect(again.status).toBe(409);
  });

  it("tells the model when an exercise isn't in the library, or adds it as asked", async () => {
    const unknown = {
      ...legDay,
      exercises: [{ exercise: "Sled push", newExercise: null, sets: [set(null, 10)] }],
    };
    const added = {
      ...legDay,
      exercises: [
        {
          exercise: "Sled push",
          newExercise: { category: "legs", tracking: "duration" },
          sets: [{ ...set(null, null), seconds: 40 }],
        },
      ],
    };
    const t = await setup([
      toolCallResult(["log_workout", unknown]),
      toolCallResult(["log_workout", added]),
      done,
    ]);
    await t.send("Did sled pushes");
    const second = JSON.stringify(
      t.model.doGenerateCalls[t.model.doGenerateCalls.length - 2]!.prompt,
    );
    expect(second).toContain("isn't in the library");
    const w = (await body<WorkoutHistoryDto>(await t.request("/workouts"))).workouts[0]!;
    expect(w.exercises[0]!.sets[0]!.durationS).toBe(40);
    expect((await action(t)).message.actions).toHaveLength(1);
  });

  it("logs habits and goal progress, and undo restores what was there", async () => {
    const t = await setup([
      toolCallResult(
        ["log_habit", { habit: "h1", date: null, num: 1, text: null }],
        ["log_goal_progress", { goal: "g1", date: null, amount: 3 }],
      ),
      toolCallResult(["log_goal_progress", { goal: "g1", date: null, amount: 2 }]),
      done,
    ]);
    const today = (await body<DayDto>(await t.request("/days/today"))).today;
    await t.request("/objectives", {
      method: "POST",
      ...json({ name: "Read 100 pages", target: 100, unit: "pages", endsOn: "2099-01-01" }),
    });
    await t.send("Ran this morning and read 5 pages");

    const day = await body<DayDto>(await t.request("/days/today"));
    expect(day.habits[0]!.entry).toEqual({ num: 1, text: null });
    expect(day.objectives[0]!.logged).toBe(5);
    const { message } = await action(t);
    expect(message.actions.map((a) => [a.kind, a.detail])).toEqual([
      ["habit", "Done"],
      ["goal", "+3 pages"],
      ["goal", "+2 pages"],
    ]);

    await t.request(`/coach/messages/${message.id}/actions/2/undo`, { method: "POST" });
    await t.request(`/coach/messages/${message.id}/actions/0/undo`, { method: "POST" });
    const after = await body<DayDto>(await t.request(`/days/${today}`));
    expect(after.objectives[0]!.logged).toBe(3);
    expect(after.habits[0]!.entry).toBeNull();
  });

  it("returns tool errors to the model instead of failing the turn", async () => {
    const t = await setup([
      toolCallResult(["log_habit", { habit: "h9", date: null, num: 1, text: null }]),
      toolCallResult(["log_habit", { habit: "h1", date: "2099-01-01", num: 1, text: null }]),
      done,
    ]);
    expect((await t.send("Log my run")).status).toBe(200);
    const prompts = JSON.stringify(t.model.doGenerateCalls.at(-1)!.prompt);
    expect(prompts).toContain("No habit h9");
    expect(prompts).toContain("Can't log days in the future");
    expect((await action(t)).message.actions).toEqual([]);
  });

  it("opens a postgame interview after the day's recap", async () => {
    const recap = jsonResult({ changes: [], narrative: "Quiet day.", flags: [], nextPrompts: [] });
    const opener = jsonResult({
      reply: "Quiet one. Your journal says you hit legs; what did you do?",
      suggestions: [],
    });
    const t = await setup([recap, opener]);
    const today = (await body<DayDto>(await t.request("/days/today"))).today;
    const postgame = () =>
      t.request("/coach/postgame", { method: "POST", ...json({ date: today }) });
    expect((await postgame()).status).toBe(409);

    await t.request(`/days/${today}/journal`, {
      method: "PUT",
      ...json({ journal: "Hit legs after work." }),
    });
    await t.request(`/days/${today}/recap`, { method: "POST" });
    const state = await body<CoachStateDto>(await postgame());
    expect(state.messages.map((m) => [m.role, m.content])).toEqual([
      ["assistant", "Quiet one. Your journal says you hit legs; what did you do?"],
    ]);
    // Opening doesn't spend one of the player's messages.
    expect(state.remaining).toBe(MAX_COACH_MESSAGES_PER_DAY);
    const call = JSON.stringify(t.model.doGenerateCalls.at(-1)!);
    expect(call).toContain("Postgame:");
    expect(call).toContain("Journal: Hit legs after work.");
    expect(call).toContain("This day's recap: Quiet day.");
    expect(
      (await t.request("/coach/postgame", { method: "POST", ...json({ date: "x" }) })).status,
    ).toBe(400);
  });
});
