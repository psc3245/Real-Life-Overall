import {
  MAX_COACH_MESSAGES_PER_DAY,
  type CoachStateDto,
  type HabitDto,
  type ObjectiveDto,
  type ScoutingReportDto,
} from "@rlo/shared";
import { describe, expect, it } from "vitest";
import { coachMessages, users } from "../src/db/schema";
import { createRatedApp, json } from "./flows";
import { jsonResult } from "./helpers";

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

async function setup(responses = [reply()]) {
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
