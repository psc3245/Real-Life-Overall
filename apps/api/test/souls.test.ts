import type { DayDto, HabitDto, RatingsDto, SoulsDto } from "@rlo/shared";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { seasons, users } from "../src/db/schema";
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
});
