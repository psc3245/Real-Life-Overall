import {
  addDays,
  MAX_COACH_MESSAGES_PER_DAY,
  type CoachStateDto,
  type DayDto,
  type WorkoutTemplateDto,
  type WorkoutHistoryDto,
  type HabitDto,
  type ObjectiveDto,
  type ScoutingReportDto,
} from "@rlo/shared";
import { describe, expect, it } from "vitest";
import { coachMessages, coachThreads, users } from "../src/db/schema";
import { claimsWork } from "../src/services/coach-service";
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
    expect(empty).toEqual({ thread: null, messages: [], remaining: MAX_COACH_MESSAGES_PER_DAY });

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
    // Not even an empty thread.
    expect(await body(await t.request("/coach/threads"))).toEqual([]);

    const [user] = await t.db.select().from(users);
    const [thread] = await t.db
      .insert(coachThreads)
      .values({ userId: user!.id, title: "Spam" })
      .returning();
    await t.db.insert(coachMessages).values(
      Array.from({ length: MAX_COACH_MESSAGES_PER_DAY }, () => ({
        userId: user!.id,
        threadId: thread!.id,
        role: "user" as const,
        content: "spam",
      })),
    );
    expect((await body<CoachStateDto>(await t.request("/coach"))).remaining).toBe(0);
    const capped = await t.send("One more");
    expect(capped.status).toBe(429);

    const cleared = await body<CoachStateDto>(await t.request("/coach", { method: "DELETE" }));
    expect(cleared).toEqual({ thread: null, messages: [], remaining: MAX_COACH_MESSAGES_PER_DAY });
    expect(await body(await t.request("/coach/threads"))).toEqual([]);
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

  it("drafts a workout the player describes; nothing is saved until they accept it", async () => {
    const drafted = jsonResult({ reply: "Here's your leg day; look right?", suggestions: [] });
    const t = await setup([toolCallResult(["draft_workout", legDay]), drafted]);
    expect(
      (await t.send("Hit legs: squats 2x5 at 225, leg press 300 for 10. 50 min.")).status,
    ).toBe(200);
    expect((await body<WorkoutHistoryDto>(await t.request("/workouts"))).workouts).toEqual([]);

    const { message } = await action(t);
    const draft = message.suggestions[0]!;
    expect(draft).toMatchObject({ kind: "workout", name: "Leg Day", status: "pending" });
    if (draft.kind !== "workout") throw new Error("not a workout");
    expect(draft.durationS).toBe(3000);
    expect(draft.exercises.map((e) => [e.exerciseId, e.sets.length])).toEqual([
      ["squat-barbell", 2],
      ["leg-press", 1],
    ]);
    expect(draft.exercises[0]!.sets[0]!.weightKg).toBeCloseTo(102.06, 1); // 225 lb

    // The player fixes a weight before saving.
    const edits = {
      name: "Leg Day",
      notes: "",
      localDate: draft.date,
      durationS: 3000,
      exercises: draft.exercises.map((e, i) =>
        i === 1 ? { ...e, sets: e.sets.map((x) => ({ ...x, weightKg: 140 })) } : e,
      ),
    };
    const res = await t.request(`/coach/messages/${message.id}/suggestions/0/accept`, {
      method: "POST",
      ...json({ edits }),
    });
    expect(res.status).toBe(200);
    const { createdId } = await body<{ createdId: string }>(res);
    const w = (await body<WorkoutHistoryDto>(await t.request("/workouts"))).workouts[0]!;
    expect(w.id).toBe(createdId);
    expect(w.exercises[1]!.sets[0]!.weightKg).toBe(140);
    expect((await action(t)).message.suggestions[0]).toMatchObject({
      status: "accepted",
      createdId,
    });
    // Later turns know it was saved.
    await t.request("/coach/messages", { method: "POST", ...json({ content: "Thanks" }) });
    expect(JSON.stringify(t.model.doGenerateCalls.at(-1)!.prompt)).toContain(
      'Draft workout \\"Leg Day\\": saved by the user',
    );
  });

  it("tells the model when an exercise isn't in the library, or adds it as asked", async () => {
    const unknown = {
      ...legDay,
      exercises: [{ exercise: "Tire flip", newExercise: null, sets: [set(null, 10)] }],
    };
    const added = {
      ...legDay,
      exercises: [
        {
          exercise: "Tire flip",
          newExercise: { category: "legs", tracking: "duration" },
          sets: [{ ...set(null, null), seconds: 40 }],
        },
      ],
    };
    const t = await setup([
      toolCallResult(["draft_workout", unknown]),
      toolCallResult(["draft_workout", added]),
      done,
    ]);
    await t.send("Did tire flips");
    const second = JSON.stringify(
      t.model.doGenerateCalls[t.model.doGenerateCalls.length - 2]!.prompt,
    );
    expect(second).toContain("isn't in the library");
    const { message } = await action(t);
    expect(message.suggestions).toHaveLength(1);
    const draft = message.suggestions[0]!;
    if (draft.kind !== "workout") throw new Error("not a workout");
    expect(draft.exercises[0]!.sets[0]!.durationS).toBe(40);
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
      jsonResult({ reply: "That date is in the future; which day was it?", suggestions: [] }),
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
    // Its own thread, about its day: the answer's tools default to that day.
    expect(state.thread!.title).toMatch(/^Postgame: \w{3} \d{4}-\d{2}-\d{2}$/);
  });

  it("makes the model act on a claim it didn't back with a tool, or says so plainly", async () => {
    const claim = jsonResult({ reply: "Logged your run.", suggestions: [] });
    const t = await setup([
      claim,
      toolCallResult(["log_habit", { habit: "h1", date: null, num: 1, text: null }]),
      done,
      claim,
      claim,
    ]);
    const before = t.model.doGenerateCalls.length;
    await t.send("I ran this morning");
    const fixed = await action(t);
    expect(fixed.message.content).toBe("Logged it.");
    expect(fixed.message.actions.map((a) => a.kind)).toEqual(["habit"]);
    expect(JSON.stringify(t.model.doGenerateCalls[before + 1]!.prompt)).toContain("no tool ran");

    // Still a false claim after the correction: the reply says so instead.
    const state = await body<CoachStateDto>(await t.send("And I stretched"));
    expect(state.messages.at(-1)!.content).toMatch(
      /^I didn't manage to log, draft or save anything/,
    );
    expect(state.messages.at(-1)!.actions).toEqual([]);
  });
  it("drafts habits, goals and templates the player reviews and saves", async () => {
    const plan = {
      name: "Push Day",
      notes: null,
      exercises: [
        {
          exercise: "Bench Press (Barbell)",
          newExercise: null,
          sets: [set(185, 5), set(null, null)],
        },
        { exercise: "dip", newExercise: null, sets: [set(null, 10)] },
      ],
    };
    const habit = (name: string, refs: string[]) => ({
      name,
      type: "counter",
      days: [],
      target: 20,
      unit: "pages",
      avoid: false,
      refs,
      reason: "You said you want to read more.",
    });
    const t = await setup([
      toolCallResult(
        ["draft_habit", habit("Read", ["n2", "n9"])],
        ["draft_habit", habit("Morning run", [])],
        ["draft_habit", habit("read", [])],
        [
          "draft_goal",
          {
            name: "Run 50 miles",
            kind: "total",
            target: 50,
            unit: "miles",
            startValue: null,
            deadline: addDays(new Date().toISOString().slice(0, 10), 29),
            refs: ["n3"],
            reason: "Builds your base.",
          },
        ],
        [
          "draft_goal",
          {
            name: "Weigh 185",
            kind: "reach",
            target: 185,
            unit: "lb",
            startValue: null,
            deadline: "2026-01-01",
            refs: [],
            reason: "",
          },
        ],
        ["draft_workout_template", plan],
      ),
      jsonResult({ reply: "Three drafts below; tweak anything.", suggestions: [] }),
    ]);
    await t.send("Set me up: a reading habit, a 50 mile month, and save my push day");
    // Nothing exists yet.
    expect((await body<HabitDto[]>(await t.request("/habits"))).map((h) => h.name)).toEqual([
      "Morning run",
    ]);
    expect(await body(await t.request("/objectives"))).toEqual([]);
    expect(await body(await t.request("/workout-templates"))).toEqual([]);
    const prompt = JSON.stringify(t.model.doGenerateCalls.at(-1)!.prompt);
    expect(prompt).toContain("already have a habit called Morning run");
    expect(prompt).toContain("already have a habit called read");
    expect(prompt).toContain("a reach goal needs a startValue");

    const { message } = await action(t);
    expect(message.suggestions.map((x) => [x.index, x.kind])).toEqual([
      [0, "habit"],
      [1, "goal"],
      [2, "template"],
    ]);
    expect(message.suggestions[0]).toMatchObject({
      name: "Read",
      habitType: "counter",
      target: 20,
      unit: "pages",
      nodeIds: [t.nodeId("Career")],
      reason: "You said you want to read more.",
    });
    const accept = (i: number, edits?: unknown) =>
      t.request(`/coach/messages/${message.id}/suggestions/${i}/accept`, {
        method: "POST",
        ...(edits !== undefined && json({ edits })),
      });

    // The habit, tweaked: weekdays and 10 pages.
    const tweaked = {
      name: "Read",
      type: "counter",
      config: { target: 10, unit: "pages" },
      days: [1, 2, 3, 4, 5],
      links: [t.nodeId("Career")],
    };
    expect((await accept(0, tweaked)).status).toBe(200);
    const read = (await body<HabitDto[]>(await t.request("/habits"))).find(
      (h) => h.name === "Read",
    )!;
    expect(read).toMatchObject({ days: [1, 2, 3, 4, 5], config: { target: 10 } });
    // The goal and template as proposed.
    expect((await accept(1)).status).toBe(200);
    const goals = await body<ObjectiveDto[]>(await t.request("/objectives"));
    expect(goals.map((g) => [g.name, g.target, g.unit, g.links])).toEqual([
      ["Run 50 miles", 50, "miles", [t.nodeId("Cardio")]],
    ]);
    expect((await accept(2)).status).toBe(200);
    const templates = await body<WorkoutTemplateDto[]>(await t.request("/workout-templates"));
    expect(templates[0]!.name).toBe("Push Day");
    // A template is a plan: blank numbers stay, nothing is done.
    expect(templates[0]!.exercises.map((e) => [e.exerciseId, e.sets.length])).toEqual([
      ["bench-press-barbell", 2],
      ["dip", 1],
    ]);
    expect(templates[0]!.exercises[0]!.sets.every((x) => !x.done)).toBe(true);

    // Each draft saves once.
    expect((await accept(0, tweaked)).status).toBe(409);
  });

  it("refuses invalid edits and keeps the draft", async () => {
    const t = await setup([
      toolCallResult([
        "draft_habit",
        {
          name: "Stretch",
          type: "checkbox",
          days: [],
          target: null,
          unit: null,
          avoid: false,
          refs: [],
          reason: "",
        },
      ]),
      jsonResult({ reply: "Drafted a stretch habit; look right?", suggestions: [] }),
    ]);
    await t.send("Suggest a habit");
    const { message } = await action(t);
    const res = await t.request(`/coach/messages/${message.id}/suggestions/0/accept`, {
      method: "POST",
      ...json({ edits: { name: "", type: "checkbox" } }),
    });
    expect(res.status).toBe(400);
    expect((await action(t)).message.suggestions[0]!.status).toBe("pending");
  });
});

describe("coach threads", () => {
  const say = (text: string) => jsonResult({ reply: text, suggestions: [] });

  it("keeps conversations apart, newest first, each with its own history", async () => {
    const t = await setup([say("One."), say("Two."), say("Three.")]);
    const send = async (content: string, threadId?: string | null) =>
      body<CoachStateDto>(
        await t.request("/coach/messages", { method: "POST", ...json({ content, threadId }) }),
      );
    const first = await send(
      "What should I focus on this week? I want a plan for my running",
      null,
    );
    expect(first.thread!.title).toBe("What should I focus on this week? I want a plan for my…");
    const second = await send("Budget question", null);
    expect(second.thread!.id).not.toBe(first.thread!.id);
    expect(second.messages.map((m) => m.content)).toEqual(["Budget question", "Two."]);

    // Back in the first thread: only its history goes to the model.
    const again = await send("More on running", first.thread!.id);
    expect(again.messages.map((m) => m.content)).toEqual([
      "What should I focus on this week? I want a plan for my running",
      "One.",
      "More on running",
      "Three.",
    ]);
    const prompt = JSON.stringify(t.model.doGenerateCalls.at(-1)!.prompt);
    expect(prompt).not.toContain("Budget question");

    const threads = await body<{ id: string; title: string }[]>(await t.request("/coach/threads"));
    expect(threads.map((x) => x.id)).toEqual([first.thread!.id, second.thread!.id]);
    // No thread given: the latest (older clients); "new": an empty chat.
    expect((await body<CoachStateDto>(await t.request("/coach"))).thread!.id).toBe(
      first.thread!.id,
    );
    expect(await body(await t.request("/coach?thread=new"))).toMatchObject({
      thread: null,
      messages: [],
    });
    expect((await t.request(`/coach?thread=${crypto.randomUUID()}`)).status).toBe(404);

    expect(
      (await t.request(`/coach/threads/${second.thread!.id}`, { method: "DELETE" })).status,
    ).toBe(204);
    expect((await body<unknown[]>(await t.request("/coach/threads"))).length).toBe(1);
    expect(
      (
        await t.request(`/coach/threads/${second.thread!.id}`, {
          method: "DELETE",
          user: "mallory",
        })
      ).status,
    ).toBe(404);
    expect(
      (
        await t.request("/coach/messages", {
          method: "POST",
          ...json({ content: "Hi", threadId: second.thread!.id }),
        })
      ).status,
    ).toBe(404);
  });
});

describe("claimsWork", () => {
  it("tells claims of work done from offers to do it", () => {
    for (const done of [
      "Logged Wednesday (Nov 11) as Chest Day: Bench Press 3 × 8.",
      "Here's the draft: Leg Day on today's date, 45 minutes.",
      "I've drafted Leg Day for you. Does it look right?",
      "Done. I created the habit Read 20 pages.",
      "Got it. Saved your push day.",
      "Check it and save it from the card.",
      "The chest work is written down as a card. Does the card look right?",
      "Your run has been logged.",
    ]) {
      expect(claimsWork(done), done).toBe(true);
    }
    for (const offer of [
      "Nice work. What did you do? Tell me the sets and I'll draft the workout for you to check.",
      "Once you confirm, I'll log the whole day.",
      "Want me to set up a reading habit?",
      "How many reps did you do per set?",
    ]) {
      expect(claimsWork(offer), offer).toBe(false);
    }
  });
});
