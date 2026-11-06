import {
  addDays,
  seasonForDate,
  type DayDto,
  type HabitDto,
  type HistoryDto,
  type LeaderboardDto,
  type RatingsDto,
  type SeasonCardDto,
  type SoulsDto,
} from "@rlo/shared";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { llmCalls, ratingEvents, recaps, seasons, soulLevels, users } from "../src/db/schema";
import { createRatedApp, json } from "./flows";
import { jsonResult } from "./helpers";

// Standard tree: leaves Career 80, Cardio 70, Strength 50 → start levels 32, 28, 20.
const recap = (changes: { ref: string; delta: number }[]) =>
  jsonResult({
    changes: changes.map((c) => ({ reason: `Moved ${c.ref}.`, evidence: "Run", ...c })),
    narrative: "A solid day.",
    flags: [],
    nextPrompts: [],
  });

const body = async <T>(res: Response) => (await res.json()) as T;

async function setup(responses: ReturnType<typeof jsonResult>[] = []) {
  const t = await createRatedApp(responses);
  await t.db.update(users).set({ role: "dev" });
  await t.db.update(seasons).set({ mode: "souls" });
  const today = (await body<DayDto>(await t.request("/days/today"))).today;
  const habit = async (input: Record<string, unknown>) =>
    body<HabitDto>(await t.request("/habits", { method: "POST", ...json(input) }));
  const souls = async () => body<SoulsDto>(await t.request("/souls"));
  const levelUp = (nodeId: string, levels = 1) =>
    t.request("/souls/level-up", { method: "POST", ...json({ nodeId, levels }) });
  return { ...t, today, habit, souls, levelUp };
}

describe("souls mode", () => {
  it("starts levels from ratings, earns souls from the day and spends them on levels", async () => {
    const t = await setup([
      recap([
        { ref: "n2", delta: 3 },
        { ref: "n3", delta: 3 },
        { ref: "n4", delta: 3 },
      ]),
    ]);
    const start = await t.souls();
    const stat = (s: SoulsDto, name: string) => s.stats.find((n) => n.name === name)!;
    expect([32, 28, 20]).toEqual(["Career", "Cardio", "Strength"].map((n) => stat(start, n).level));
    expect(start).toMatchObject({ held: 0, startedOn: t.today, deaths: 0 });
    expect(stat(start, "Strength").cost).toBe(660);

    const run = await t.habit({ name: "Run", type: "checkbox" });
    await t.request(`/days/${t.today}/habits/${run.id}`, { method: "PUT", ...json({ num: 1 }) });
    await t.request(`/days/${t.today}/recap`, { method: "POST" });
    const earned = await t.souls();
    expect(earned.held).toBe(925); // 9 points × 100 + one habit
    expect(earned.days[0]!.earned).toMatchObject({ recap: 900, habits: 25 });

    expect((await t.levelUp(t.nodeId("Strength"), 2)).status).toBe(409);
    expect((await t.levelUp(t.nodeId("Fitness"))).status).toBe(400);
    const leveled = await body<SoulsDto>(await t.levelUp(t.nodeId("Strength")));
    expect(leveled.held).toBe(265);
    expect(stat(leveled, "Strength")).toMatchObject({ level: 21, gained: 1 });

    const ratings = await body<RatingsDto>(await t.request("/ratings"));
    expect(ratings.nodes.find((n) => n.name === "Strength")).toMatchObject({ value: 21 });
    expect(ratings.nodes.find((n) => n.name === "Strength")!.rating).toBeCloseTo(53, 5);
  });

  it("drops held souls as a bloodstain on a slip", async () => {
    const t = await setup([recap([{ ref: "n3", delta: 2 }])]);
    const smoke = await t.habit({
      name: "Smoking",
      type: "checkbox",
      config: { direction: "avoid" },
    });
    await t.request(`/days/${t.today}/recap`, { method: "POST" }); // nothing logged yet: refused
    const run = await t.habit({ name: "Run", type: "checkbox" });
    await t.request(`/days/${t.today}/habits/${run.id}`, { method: "PUT", ...json({ num: 1 }) });
    await t.request(`/days/${t.today}/recap`, { method: "POST" });
    expect((await t.souls()).held).toBe(225);

    await t.request(`/days/${t.today}/habits/${smoke.id}`, { method: "PUT", ...json({ num: 1 }) });
    const dead = await t.souls();
    expect(dead).toMatchObject({ held: 0, deaths: 1, bloodstain: { amount: 225, date: t.today } });
    expect(dead.days[0]!.deaths).toEqual(["slip"]);
  });

  it("keeps Souls seasons to testers", async () => {
    const t = await createRatedApp();
    const refused = await t.request("/seasons/setup/mode", {
      method: "PUT",
      ...json({ mode: "souls" }),
    });
    expect(refused.status).toBe(403);
    expect((await t.request("/souls")).status).toBe(404);
    await t.db.update(seasons).set({ mode: "souls" }).where(eq(seasons.status, "active"));
    expect((await t.request("/souls")).status).toBe(200);
  });

  it("tells the model about Souls mode, and charts, boards and cards use levels", async () => {
    const t = await setup([recap([{ ref: "n4", delta: 3 }])]);
    await t.souls();
    await t.request(`/days/${t.today}/journal`, { method: "PUT", ...json({ journal: "Lifted." }) });
    await t.request(`/days/${t.today}/recap`, { method: "POST" });
    const system = JSON.stringify(t.model.doGenerateCalls.at(-1)!.prompt);
    expect(system).toContain("picked Souls mode");
    expect(system).toContain("You are the Firekeeper");
    expect(system).not.toContain("light sports framing");
    const [call] = await t.db.select().from(llmCalls).where(eq(llmCalls.purpose, "recap.daily"));
    expect(call!.promptVersion).toMatch(/\+souls$/);

    // 300 souls can't buy level 20 → 21 (660); give the run a boss-sized day instead.
    await t.db.update(ratingEvents).set({ delta: 9 }).where(eq(ratingEvents.source, "daily_recap"));
    await t.levelUp(t.nodeId("Strength"));
    const history = await body<HistoryDto>(await t.request("/ratings/history?days=7"));
    const strength = history.series.find((s) => s.nodeId === t.nodeId("Strength"))!;
    expect(strength.values.at(-1)).toBe(21);
    const ratings = await body<RatingsDto>(await t.request("/ratings"));
    expect(ratings.nodes.find((n) => n.name === "Strength")!.trend).toBe(1);

    const board = await body<LeaderboardDto>(
      await t.request("/leaderboards?scope=friends&board=overall"),
    );
    const overall = ratings.nodes.find((n) => n.parentId === null)!.value!;
    expect(board).toMatchObject({ mode: "souls", myMode: "souls" });
    expect(board.me!.value).toBeCloseTo(overall, 2);
  });

  it("carries levels and unspent souls into New Game+", async () => {
    const t = await setup([
      recap([
        { ref: "n2", delta: 3 },
        { ref: "n3", delta: 3 },
        { ref: "n4", delta: 3 },
      ]),
    ]);
    await t.souls();
    await t.request(`/days/${t.today}/journal`, {
      method: "PUT",
      ...json({ journal: "Big day." }),
    });
    await t.request(`/days/${t.today}/recap`, { method: "POST" });
    await t.levelUp(t.nodeId("Strength")); // 900 - 660 = 240 left

    // Move the whole run to the last day of last quarter, so the next request rolls over.
    const prev = seasonForDate(addDays(seasonForDate(t.today).startsOn, -1));
    await t.db
      .update(seasons)
      .set({ label: prev.label, startsOn: prev.startsOn, endsOn: prev.endsOn });
    await t.db.update(recaps).set({ periodStart: prev.endsOn, periodEnd: prev.endsOn });
    await t.db.update(soulLevels).set({ afterDate: prev.endsOn });
    await t.db
      .update(ratingEvents)
      .set({ createdAt: new Date(`${addDays(prev.endsOn, -1)}T12:00:00Z`) });

    const ngp = await t.souls();
    expect(ngp).toMatchObject({ carried: 240, held: 240, cycle: 1 });
    expect(ngp.season.label).not.toBe(prev.label);
    expect(ngp.stats.find((s) => s.name === "Strength")).toMatchObject({ level: 21, gained: 0 });
    const [card] = await body<SeasonCardDto[]>(await t.request("/seasons"));
    expect(card).toMatchObject({ mode: "souls", label: prev.label });
    expect(card!.level).toBeCloseTo(ngp.soulLevel!, 2);
    expect(card!.nodes.find((n) => n.name === "Strength")!.level).toBe(21);
  });
});
