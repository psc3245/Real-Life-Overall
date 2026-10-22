import { addDays, type DayDto, type HabitDto, type WeeklyStateDto } from "@rlo/shared";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { decayRules, ratingEvents } from "../src/db/schema";
import { findRecapGains } from "../src/repos/rating-event-repo";
import { runForUser } from "../src/services/scheduler";
import { createRatedApp, json } from "./flows";
import { jsonResult } from "./helpers";

// Standard tree refs: Fitness n1, Career n2, Cardio n3, Strength n4. Leaves n2, n3, n4.
const review = (over: Record<string, unknown> = {}) =>
  jsonResult({
    narrative: "A steady week with consistent work and little training.",
    corrections: [{ ref: "n2", delta: 9, reason: "Five straight days of shipping." }],
    decayRevisions: [
      { ref: "n3", graceDays: 2, perDay: 0.4, floor: 99, reason: "Cardio fades fast for you." },
      { ref: "n1", graceDays: 3, perDay: 0.2, floor: 10, reason: "Not a leaf." },
    ],
    focusGoals: [{ title: "Run twice", detail: "Two 30-minute runs.", refs: ["n3", "n1", "n9"] }],
    habitProposals: [
      {
        name: "Evening walk",
        type: "duration",
        days: [1, 3, 5, 9],
        target: 20,
        unit: null,
        refs: ["n3"],
        reason: "Builds a cardio base.",
      },
      {
        name: "morning run",
        type: "checkbox",
        days: [],
        target: null,
        unit: null,
        refs: [],
        reason: "dup",
      },
      {
        name: "Pushups",
        type: "counter",
        days: [],
        target: 25,
        unit: "reps",
        refs: ["n4"],
        reason: "Strength.",
      },
    ],
    profileSummary: "  Software engineer focused on promotion; trains irregularly.  ",
    projections: [
      { ref: "overall", value: 72.44 },
      { ref: "n1", value: 140 },
      { ref: "n3", value: 75 }, // a leaf: ignored
      { ref: "n9", value: 50 },
    ],
    archetype: { name: "Desk Athlete", description: "Unchanged." },
    personalBadge: null,
    ...over,
  });

const body = async <T>(res: Response) => (await res.json()) as T;

async function setup(responses = [review()], daysAgo = 14) {
  const t = await createRatedApp(responses);
  await t.db.update(ratingEvents).set({ createdAt: new Date(Date.now() - daysAgo * 86_400_000) });
  await t.request("/habits", {
    method: "POST",
    ...json({ name: "Morning run", type: "checkbox", startsOn: "2026-01-01" }),
  });
  const state = async () => body<WeeklyStateDto>(await t.request("/weekly"));
  const run = () => t.request("/weekly/run", { method: "POST" });
  return { ...t, state, run };
}

describe("weekly review", () => {
  it("reviews the last finished week once, applying its outputs", async () => {
    const { state, run, model, db, nodeId } = await setup();
    const before = await state();
    expect(before.ready).toBe(true);
    expect(before.review).toBeNull();

    const after = await body<WeeklyStateDto>(await run());
    expect(after.ready).toBe(false);
    const r = after.review!;
    expect(r).toMatchObject({ weekStart: before.week!.start, weekEnd: before.week!.end });
    expect(r.narrative).toMatch(/steady week/);
    expect(r.corrections.map((c) => [c.nodeName, c.delta])).toEqual([["Career", 5]]); // capped
    expect(r.decayRevisions).toEqual([
      expect.objectContaining({ nodeName: "Cardio", graceDays: 2, perDay: 0.4 }),
    ]);
    expect(r.decayRevisions[0]!.floor).toBeLessThanOrEqual(70); // floor kept below the value
    expect(r.focusGoals).toEqual([
      {
        title: "Run twice",
        detail: "Two 30-minute runs.",
        nodeIds: [nodeId("Cardio"), nodeId("Fitness")],
      },
    ]);
    expect(r.habitProposals.map((p) => [p.index, p.name, p.days, p.status])).toEqual([
      [0, "Evening walk", [1, 3, 5], "pending"],
      [1, "Pushups", [0, 1, 2, 3, 4, 5, 6], "pending"],
    ]);

    const rules = await db
      .select()
      .from(decayRules)
      .where(eq(decayRules.nodeId, nodeId("Cardio")));
    expect(rules.map((x) => [x.version, x.active])).toEqual(
      expect.arrayContaining([
        [1, false],
        [2, true],
      ]),
    );

    // Idempotent: no second model call.
    const calls = model.doGenerateCalls.length;
    await run();
    expect(model.doGenerateCalls).toHaveLength(calls);

    const prompt = JSON.stringify(model.doGenerateCalls.at(-1)!.prompt);
    expect(prompt).toContain(`Week: ${before.week!.start} to ${before.week!.end}`);
    expect(prompt).toContain("Morning run (done / not done): done 0 of 7 scheduled days");
    expect(prompt).toContain("[n3] Cardio: grace 5 days, 0.25/day, floor 50");
    expect(prompt).toContain("Existing habit names: Morning run");
    expect(prompt).toContain("Related older days:\\n(none)");
  });

  it("weekly corrections are not day-level activity for decay", async () => {
    const { run, db } = await setup();
    await run();
    const seasonId = (
      await db.select().from(ratingEvents).where(eq(ratingEvents.source, "weekly_review"))
    )[0]!.seasonId;
    expect(await findRecapGains(db, seasonId)).toEqual([]);
  });

  it("accepts and dismisses habit proposals", async () => {
    const { request, run, nodeId } = await setup();
    const r = (await body<WeeklyStateDto>(await run())).review!;
    const accepted = await body<{ state: WeeklyStateDto; habit: HabitDto }>(
      await request(`/weekly/${r.id}/proposals/0/accept`, { method: "POST" }),
    );
    expect(accepted.habit).toMatchObject({
      name: "Evening walk",
      type: "duration",
      days: [1, 3, 5],
      config: { target: 20 },
      links: [nodeId("Cardio")],
    });
    expect(accepted.state.review!.habitProposals[0]!.status).toBe("accepted");
    expect((await request(`/weekly/${r.id}/proposals/0/accept`, { method: "POST" })).status).toBe(
      409,
    );

    const dismissed = await body<{ state: WeeklyStateDto; habit: null }>(
      await request(`/weekly/${r.id}/proposals/1/dismiss`, { method: "POST" }),
    );
    expect(dismissed.habit).toBeNull();
    expect(dismissed.state.review!.habitProposals[1]!.status).toBe("dismissed");
    expect((await request(`/weekly/${r.id}/proposals/5/accept`, { method: "POST" })).status).toBe(
      404,
    );
    expect((await request(`/weekly/${r.id}/proposals/0/explode`, { method: "POST" })).status).toBe(
      400,
    );
    const other = await request(`/weekly/${r.id}/proposals/1/accept`, {
      method: "POST",
      user: "mallory",
    });
    expect(other.status).toBe(404);
  });

  it("feeds the profile and focus goals into later daily recaps", async () => {
    const daily = jsonResult({ changes: [], narrative: "Ok.", flags: [], nextPrompts: [] });
    const { request, run, model } = await setup([review(), daily]);
    await run();
    expect(await body(await request("/weekly/focus"))).toEqual([
      expect.objectContaining({ title: "Run twice" }),
    ]);
    const today = (await body<DayDto>(await request("/days/today"))).today;
    await request(`/days/${today}/journal`, {
      method: "PUT",
      ...json({ journal: "Planned a run." }),
    });
    await request(`/days/${today}/recap`, { method: "POST" });
    const prompt = JSON.stringify(model.doGenerateCalls.at(-1)!.prompt);
    expect(prompt).toContain("Software engineer focused on promotion; trains irregularly.");
    expect(prompt).toContain("- Run twice: Two 30-minute runs.");
  });

  it("waits until a full week has passed since onboarding", async () => {
    const { state, run } = await setup([review()], 0);
    expect(await state()).toMatchObject({ week: null, ready: false, review: null });
    expect((await run()).status).toBe(409);
  });

  it("is run by the 4am job", async () => {
    const t = await setup();
    const me = await body<{ id: string }>(await t.request("/me"));
    const result = await runForUser(t.db, t.llm, me.id, "UTC", { recap: true });
    expect(result.weeklyReview).toBe((await t.state()).week!.start);
    expect((await t.state()).ready).toBe(false);
  });
});

describe("weekly memory", () => {
  it("matches older days on the week's journals, even without recaps", async () => {
    const t = await createRatedApp([review()]);
    await t.db.update(ratingEvents).set({ createdAt: new Date(Date.now() - 21 * 86_400_000) });
    const week = (await body<WeeklyStateDto>(await t.request("/weekly"))).week!;
    const me = await body<{ id: string }>(await t.request("/me"));
    const { dayLogs } = await import("../src/db/schema");
    await t.db.insert(dayLogs).values([
      {
        userId: me.id,
        localDate: addDays(week.start, -5),
        journal: "River loop run, knees ached.",
      },
      {
        userId: me.id,
        localDate: addDays(week.start, 1),
        journal: "River loop again, knees fine.",
      },
    ]);
    await t.request("/weekly/run", { method: "POST" });
    const prompt = JSON.stringify(t.model.doGenerateCalls.at(-1)!.prompt);
    expect(prompt).toContain(
      `- ${addDays(week.start, -5)} (journal): River loop run, knees ached.`,
    );
    expect(prompt).toContain("not recapped. Journal: River loop again, knees fine.");
  });
});

describe("potential", () => {
  it("projects season-end ratings for overall and categories, and keeps the archetype unless it changed", async () => {
    const t = await setup();
    await t.run();
    const ratings = (await (await t.request("/ratings")).json()) as {
      projectedThrough: string | null;
      archetype: { name: string } | null;
      nodes: { name: string; projection: number | null }[];
    };
    const byName = new Map(ratings.nodes.map((n) => [n.name, n.projection]));
    expect(byName.get("Overall")).toBe(72.4);
    expect(byName.get("Fitness")).toBe(100); // clamped
    expect(byName.get("Cardio")).toBeNull();
    expect(ratings.projectedThrough).toBe((await t.state()).week!.end);
    expect(ratings.archetype!.name).toBe("Desk Athlete");
    expect((await t.state()).review!.archetypeChange).toBeNull();

    const prompt = JSON.stringify(t.model.doGenerateCalls.at(-1)!.prompt);
    expect(prompt).toContain("Current archetype: Desk Athlete: Strong at work.");
    expect(prompt).toMatch(/Season: \d{4}-Q\d, ends \d{4}-\d{2}-\d{2}/);
  });

  it("renames the archetype when the review says the shape changed", async () => {
    const t = await setup([
      review({
        archetype: { name: "Two-Way Grinder", description: "Balanced work and training." },
      }),
    ]);
    const state = (await (await t.run()).json()) as WeeklyStateDto;
    expect(state.review!.archetypeChange).toEqual({
      from: "Desk Athlete",
      to: "Two-Way Grinder",
      description: "Balanced work and training.",
    });
    const ratings = (await (await t.request("/ratings")).json()) as {
      archetype: { name: string; description: string };
    };
    expect(ratings.archetype).toEqual({
      name: "Two-Way Grinder",
      description: "Balanced work and training.",
    });
  });

  it("sets and clears goals on the user's own nodes only", async () => {
    const t = await setup();
    const cardio = t.nodeId("Cardio");
    const goalOf = async () =>
      (
        (await (await t.request("/ratings")).json()) as {
          nodes: { id: string; goal: number | null }[];
        }
      ).nodes.find((n) => n.id === cardio)!.goal;
    expect(
      (await t.request(`/goals/${cardio}`, { method: "PUT", ...json({ target: 77.75 }) })).status,
    ).toBe(204);
    expect(await goalOf()).toBe(77.8);
    expect(
      (await t.request(`/goals/${cardio}`, { method: "PUT", ...json({ target: 101 }) })).status,
    ).toBe(400);
    expect(
      (
        await t.request(`/goals/${cardio}`, {
          method: "PUT",
          ...json({ target: 60 }),
          user: "mallory",
        })
      ).status,
    ).toBe(404);

    await t.run();
    expect(JSON.stringify(t.model.doGenerateCalls.at(-1)!.prompt)).toContain("- Cardio: 77.8");

    expect((await t.request(`/goals/${cardio}`, { method: "DELETE" })).status).toBe(204);
    expect(await goalOf()).toBeNull();
  });
});
