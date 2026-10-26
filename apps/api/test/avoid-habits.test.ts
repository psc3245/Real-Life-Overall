import {
  addDays,
  isDayHabitDone,
  type DayDto,
  type HabitDto,
  type HabitStatsResponseDto,
  type ObjectiveDto,
} from "@rlo/shared";
import { describe, expect, it } from "vitest";
import { createRatedApp, json } from "./flows";
import { jsonResult } from "./helpers";

const body = async <T>(res: Response) => (await res.json()) as T;

async function setup(responses: ReturnType<typeof jsonResult>[] = []) {
  const t = await createRatedApp(responses);
  const today = (await body<DayDto>(await t.request("/days/today"))).today;
  const create = async (input: Record<string, unknown>) =>
    body<HabitDto>(await t.request("/habits", { method: "POST", ...json(input) }));
  const log = (date: string, habitId: string, value: { num?: number | null; text?: string }) =>
    t.request(`/days/${date}/habits/${habitId}`, { method: "PUT", ...json(value) });
  return { ...t, today, create, log };
}

describe("avoid habits", () => {
  it("are kept until a slip is logged", async () => {
    const { request, today, create, log } = await setup();
    const smoke = await create({
      name: "No smoking",
      type: "checkbox",
      config: { direction: "avoid" },
      startsOn: addDays(today, -3),
    });
    expect(smoke.config.direction).toBe("avoid");

    let day = await body<DayDto>(await request("/days/today"));
    const item = () => day.habits.find((h) => h.habit.id === smoke.id)!;
    expect(isDayHabitDone(item())).toBe(true); // clean so far

    day = await body<DayDto>(await log(today, smoke.id, { num: 1 }));
    expect(isDayHabitDone(item())).toBe(false);

    const stats = await body<HabitStatsResponseDto>(await request("/habits/stats?range=week"));
    const s = stats.habits.find((h) => h.habit.id === smoke.id)!;
    expect(s.slips).toBe(1);
  });

  it("use a daily limit for counts, which can be zero", async () => {
    const { today, create, log } = await setup();
    const coffee = await create({
      name: "Coffee",
      type: "counter",
      config: { direction: "avoid", target: 2, unit: "cups" },
    });
    const cigs = await create({
      name: "Cigarettes",
      type: "counter",
      config: { direction: "avoid" },
    });
    expect(cigs.config.target).toBe(0);

    const within = await body<DayDto>(await log(today, coffee.id, { num: 2 }));
    expect(isDayHabitDone(within.habits.find((h) => h.habit.id === coffee.id)!)).toBe(true);
    const over = await body<DayDto>(await log(today, coffee.id, { num: 3 }));
    expect(isDayHabitDone(over.habits.find((h) => h.habit.id === coffee.id)!)).toBe(false);
  });

  it("keep their direction on edit", async () => {
    const { request, create } = await setup();
    const h = await create({
      name: "Soda",
      type: "counter",
      config: { direction: "avoid", target: 1 },
    });
    const updated = await body<HabitDto>(
      await request(`/habits/${h.id}`, {
        method: "PATCH",
        ...json({ config: { direction: "build", target: 0 } }),
      }),
    );
    expect(updated.config).toMatchObject({ direction: "avoid", target: 0 });
  });

  it("count clean days toward goals", async () => {
    const { request, today, create, log } = await setup();
    const smoke = await create({
      name: "No smoking",
      type: "checkbox",
      config: { direction: "avoid" },
      startsOn: addDays(today, -3),
    });
    await log(addDays(today, -2), smoke.id, { num: 1 }); // one slip
    await log(addDays(today, -1), smoke.id, { num: 0 }); // reported clean
    const goal = await body<ObjectiveDto>(
      await request("/objectives", {
        method: "POST",
        ...json({
          name: "30 days smoke-free",
          target: 30,
          source: "habit",
          habitId: smoke.id,
          startsOn: addDays(today, -3),
          endsOn: addDays(today, 26),
        }),
      }),
    );
    // 4 days so far (today included), minus the slip.
    expect(goal).toMatchObject({ unit: "days", progress: { current: 3 } });
  });

  it("read as kept or slipped in the recap", async () => {
    const { request, today, create, log, model } = await setup([
      jsonResult({ changes: [], narrative: "Ok.", flags: [], nextPrompts: [] }),
    ]);
    await create({ name: "No smoking", type: "checkbox", config: { direction: "avoid" } });
    const coffee = await create({
      name: "Coffee",
      type: "counter",
      config: { direction: "avoid", target: 2, unit: "cups" },
    });
    await log(today, coffee.id, { num: 4 });
    await request(`/days/${today}/journal`, { method: "PUT", ...json({ journal: "Long day." }) });
    expect((await request(`/days/${today}/recap`, { method: "POST" })).status).toBe(200);
    const prompt = JSON.stringify(model.doGenerateCalls.at(-1)!.prompt);
    expect(prompt).toContain("No smoking (done / not done, trying to avoid): no slip logged.");
    expect(prompt).toContain("Coffee (count, trying to avoid): slipped: 4 cups (limit 2 cups).");
  });
});
