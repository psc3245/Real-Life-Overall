import {
  addDays,
  type ChangeFeedItemDto,
  type DayDto,
  type HabitDto,
  type RatingsDto,
} from "@rlo/shared";
import { describe, expect, it } from "vitest";
import { ratingEvents, recaps } from "../src/db/schema";
import { normalizeRecapChanges } from "../src/services/recap-changes";
import { createRatedApp, json } from "./flows";
import { jsonResult } from "./helpers";

// Standard tree refs: Fitness n1, Career n2, Cardio n3, Strength n4. Leaves: n2, n3, n4.
// Starting values: Career 80, Cardio 70, Strength 50.
const recap = (changes: { ref: string; delta: number }[], extra: Record<string, unknown> = {}) =>
  jsonResult({
    changes: changes.map((c) => ({
      reason: `Moved ${c.ref}.`,
      evidence: "Morning run",
      ...c,
    })),
    narrative: "A solid day.",
    flags: [],
    nextPrompts: ["How did you sleep?", "Any strength work?"],
    ...extra,
  });

const body = async <T>(res: Response) => (await res.json()) as T;

async function setup(responses: ReturnType<typeof jsonResult>[]) {
  const t = await createRatedApp(responses);
  const run = await body<HabitDto>(
    await t.request("/habits", {
      method: "POST",
      ...json({ name: "Morning run", type: "duration", links: [t.nodeId("Cardio")] }),
    }),
  );
  const today = (await body<DayDto>(await t.request("/days/today"))).today;
  const log = (date = today) =>
    t.request(`/days/${date}/habits/${run.id}`, { method: "PUT", ...json({ num: 40 }) });
  const endDay = (date = today) => t.request(`/days/${date}/recap`, { method: "POST" });
  return { ...t, run, today, log, endDay };
}

describe("normalizeRecapChanges", () => {
  const idByRef = new Map([
    ["n1", "parent"],
    ["n2", "a"],
    ["n3", "b"],
  ]);
  const raw = (ref: string, delta: number) => ({ ref, delta, reason: " r ", evidence: " " });
  it("caps, merges duplicates, and drops parents and negligible moves", () => {
    expect(
      normalizeRecapChanges(
        [raw("n2", 2.5), raw("n2", 2), raw("n3", -9), raw("n1", 1), raw("n3", 0.001), raw("x", 1)],
        idByRef,
        new Set(["a", "b"]),
      ),
    ).toEqual([
      { nodeId: "a", delta: 3, reason: "r", evidence: null },
      { nodeId: "b", delta: -3, reason: "r", evidence: null },
    ]);
  });
});

describe("daily recap", () => {
  it("moves ratings with reasons, shows before/after, feeds, and seeds tomorrow's questions", async () => {
    const { request, log, endDay, today, model } = await setup([
      recap([
        { ref: "n3", delta: 0.6 },
        { ref: "n4", delta: -0.2 },
      ]),
    ]);
    await request(`/days/${today}/journal`, { method: "PUT", ...json({ journal: "Ran 6k." }) });
    await log();
    const day = await body<DayDto>(await endDay());

    expect(day.status).toBe("recapped");
    expect(day.recap).toMatchObject({
      date: today,
      narrative: "A solid day.",
      overallBefore: 70, // equal weights: (Fitness 60 + Career 80) / 2
      flags: [],
    });
    expect(day.recap!.changes.map((c) => [c.nodeName, c.delta, c.valueAfter])).toEqual([
      ["Cardio", 0.6, 70.6],
      ["Strength", -0.2, 49.8],
    ]);
    expect(day.recap!.overallAfter).toBeCloseTo(70.1, 5); // Fitness 60.2

    const prompt = JSON.stringify(model.doGenerateCalls.at(-1)!.prompt);
    expect(prompt).toContain("[n3] Cardio: 70.0");
    expect(prompt).toContain("Morning run (time spent, goal 30 min): 40 min, done. Builds: n3");
    expect(prompt).toContain("Ran 6k.");

    const ratings = await body<RatingsDto>(await request("/ratings"));
    expect(ratings.nodes.find((n) => n.name === "Cardio")).toMatchObject({
      value: 70.6,
      rationale: "Moved n3.",
    });
    const feed = await body<ChangeFeedItemDto[]>(await request("/ratings/changes?limit=2"));
    expect(feed.map((f) => [f.nodeName, f.delta, f.source, f.date])).toEqual([
      ["Cardio", 0.6, "daily_recap", today],
      ["Strength", -0.2, "daily_recap", today],
    ]);
  });

  it("returns the existing recap when nothing changed, re-runs after an edit", async () => {
    const { request, log, endDay, today, db, model } = await setup([
      recap([{ ref: "n3", delta: 0.5 }]),
      recap([{ ref: "n3", delta: 1.2 }]),
    ]);
    await log();
    await endDay();
    const again = await body<DayDto>(await endDay());
    expect(again.recap!.changes[0]!.delta).toBe(0.5);
    expect(model.doGenerateCalls).toHaveLength(3); // onboarding x2 + one recap

    const edited = await body<DayDto>(
      await request(`/days/${today}/journal`, {
        method: "PUT",
        ...json({ journal: "Also lifted." }),
      }),
    );
    expect(edited.status).toBe("stale");

    const rerun = await body<DayDto>(await endDay());
    expect(rerun.status).toBe("recapped");
    expect(rerun.recap!.changes.map((c) => [c.delta, c.valueAfter])).toEqual([[1.2, 71.2]]);

    const statuses = (await db.select().from(recaps)).map((r) => r.status).sort();
    expect(statuses).toEqual(["active", "superseded"]);
    const voided = (await db.select().from(ratingEvents)).filter((e) => e.voidedAt);
    expect(voided.map((e) => e.delta)).toEqual([0.5]);
  });

  it("caps each move and refuses days with nothing logged", async () => {
    const { endDay, log } = await setup([recap([{ ref: "n3", delta: 12 }])]);
    expect((await endDay()).status).toBe(400);
    await log();
    const day = await body<DayDto>(await endDay());
    expect(day.recap!.changes[0]!.delta).toBe(3);
  });

  it("limits re-runs per day", async () => {
    const r = recap([{ ref: "n3", delta: 0.1 }]);
    const { request, endDay, log, today } = await setup([r, r, r, r]);
    await log();
    for (let i = 0; i < 3; i++) {
      expect((await endDay()).status).toBe(200);
      await request(`/days/${today}/journal`, { method: "PUT", ...json({ journal: `edit ${i}` }) });
    }
    expect((await endDay()).status).toBe(409);
  });

  it("works on backfilled days but not past the window", async () => {
    const { endDay, log, today } = await setup([recap([{ ref: "n3", delta: 0.2 }])]);
    expect((await endDay(addDays(today, -4))).status).toBe(409);
    expect((await endDay(addDays(today, 1))).status).toBe(400);
    await log();
    expect((await endDay()).status).toBe(200);
  });

  it("records only one recap when two requests race", async () => {
    const r = recap([{ ref: "n3", delta: 0.3 }]);
    const { endDay, log, db } = await setup([r, r]);
    await log();
    const statuses = (await Promise.all([endDay(), endDay()])).map((res) => res.status).sort();
    expect(statuses[0]).toBe(200);
    expect(await db.select().from(recaps)).toHaveLength(1);
    expect(
      (await db.select().from(ratingEvents)).filter((e) => e.source === "daily_recap"),
    ).toHaveLength(1);
  });

  it("seeds the next day's questions, which can be answered and inform its recap", async () => {
    const { request, log, endDay, today, model } = await setup([
      recap([{ ref: "n3", delta: 0.3 }]),
      recap([{ ref: "n4", delta: 0.4 }]),
    ]);
    const yesterday = addDays(today, -1);
    await request(`/habits`, { method: "POST", ...json({ name: "x", type: "checkbox" }) });
    await request(`/days/${yesterday}/journal`, { method: "PUT", ...json({ journal: "Ran." }) });
    await endDay(yesterday);

    const fresh = await body<DayDto>(await request(`/days/${today}`));
    expect(fresh.prompts).toEqual([
      { question: "How did you sleep?", answer: null },
      { question: "Any strength work?", answer: null },
    ]);
    const answered = await body<DayDto>(
      await request(`/days/${today}/prompts`, {
        method: "PUT",
        ...json({ answers: [null, " Deadlifts, 3x5 "] }),
      }),
    );
    expect(answered.prompts[1]).toEqual({
      question: "Any strength work?",
      answer: "Deadlifts, 3x5",
    });
    expect(
      (
        await request(`/days/${today}/prompts`, {
          method: "PUT",
          ...json({ answers: ["a", "b", "c"] }),
        })
      ).status,
    ).toBe(400);

    // Answers alone count as content, and reach the model.
    await endDay();
    const prompt = JSON.stringify(model.doGenerateCalls.at(-1)!.prompt);
    expect(prompt).toContain("Q: Any strength work?\\nA: Deadlifts, 3x5");
    expect(prompt).toContain(`- ${yesterday}: A solid day.`);
    void log;
  });
});
