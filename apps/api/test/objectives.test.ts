import { addDays, type DayDto, type HabitDto, type ObjectiveDto } from "@rlo/shared";
import { describe, expect, it } from "vitest";
import { createRatedApp, json } from "./flows";
import { createTestApp, jsonResult } from "./helpers";

const body = async <T>(res: Response) => (await res.json()) as T;

async function setup(responses: ReturnType<typeof jsonResult>[] = []) {
  const t = await createRatedApp(responses);
  const today = (await body<DayDto>(await t.request("/days/today"))).today;
  const create = (input: Record<string, unknown>) =>
    t.request("/objectives", { method: "POST", ...json(input) });
  return { ...t, today, create };
}

describe("goals (objectives)", () => {
  it("creates a manual goal and tracks progress logged on days", async () => {
    const { request, today, create, nodeId } = await setup();
    const res = await create({
      name: "Run 100 miles",
      target: 100,
      unit: "miles",
      startsOn: addDays(today, -2),
      endsOn: addDays(today, 60),
      links: [nodeId("Cardio")],
    });
    expect(res.status).toBe(201);
    const goal = await body<ObjectiveDto>(res);
    expect(goal).toMatchObject({
      unit: "miles",
      term: "long",
      source: "manual",
      links: [nodeId("Cardio")],
      progress: { current: 0, status: "active", daysLeft: 60 },
    });

    await request(`/days/${addDays(today, -1)}/objectives/${goal.id}`, {
      method: "PUT",
      ...json({ value: 6.5 }),
    });
    const day = await body<DayDto>(
      await request(`/days/${today}/objectives/${goal.id}`, {
        method: "PUT",
        ...json({ value: 4 }),
      }),
    );
    expect(day.objectives).toHaveLength(1);
    expect(day.objectives[0]).toMatchObject({ logged: 4, dayAmount: 4 });
    expect(day.objectives[0]!.objective.progress.current).toBe(10.5);

    // Clearing a day removes its amount.
    await request(`/days/${today}/objectives/${goal.id}`, {
      method: "PUT",
      ...json({ value: null }),
    });
    const [listed] = await body<ObjectiveDto[]>(await request("/objectives"));
    expect(listed!.progress.current).toBe(6.5);
  });

  it("counts a habit's entries inside the window", async () => {
    const { request, today, create } = await setup();
    const gym = await body<HabitDto>(
      await request("/habits", {
        method: "POST",
        ...json({ name: "Gym", type: "checkbox", startsOn: addDays(today, -3) }),
      }),
    );
    const log = (date: string) =>
      request(`/days/${date}/habits/${gym.id}`, { method: "PUT", ...json({ num: 1 }) });
    await log(addDays(today, -3)); // before the goal starts
    await log(addDays(today, -1));
    await log(today);

    const goal = await body<ObjectiveDto>(
      await create({
        name: "Gym 3 times this week",
        target: 3,
        source: "habit",
        habitId: gym.id,
        startsOn: addDays(today, -2),
        endsOn: addDays(today, 4),
      }),
    );
    expect(goal).toMatchObject({
      unit: "days",
      term: "short",
      habitName: "Gym",
      progress: { current: 2, status: "active" },
    });
    // Habit goals are logged through the habit.
    const direct = await request(`/days/${today}/objectives/${goal.id}`, {
      method: "PUT",
      ...json({ value: 1 }),
    });
    expect(direct.status).toBe(400);
    const day = await body<DayDto>(await request(`/days/${today}`));
    expect(day.objectives[0]).toMatchObject({ logged: null, dayAmount: 1 });
  });

  it("completes once the target is reached", async () => {
    const { request, today, create } = await setup();
    const goal = await body<ObjectiveDto>(
      await create({ name: "Read 2 books", target: 2, unit: "books", endsOn: addDays(today, 10) }),
    );
    await request(`/days/${today}/objectives/${goal.id}`, {
      method: "PUT",
      ...json({ value: 2 }),
    });
    const [listed] = await body<ObjectiveDto[]>(await request("/objectives"));
    expect(listed!.progress).toMatchObject({ status: "completed", completedOn: today, pct: 100 });
  });

  it("rejects bad windows, days outside the window, and other users' goals", async () => {
    const { request, today, create } = await setup();
    expect(
      (await create({ name: "x", target: 1, startsOn: today, endsOn: addDays(today, -1) })).status,
    ).toBe(400);
    const goal = await body<ObjectiveDto>(
      await create({
        name: "Later",
        target: 5,
        startsOn: addDays(today, 1),
        endsOn: addDays(today, 9),
      }),
    );
    expect(goal.progress.status).toBe("upcoming");
    const early = await request(`/days/${today}/objectives/${goal.id}`, {
      method: "PUT",
      ...json({ value: 1 }),
    });
    expect(early.status).toBe(400);

    const other = await createTestApp();
    expect((await other.request(`/objectives/${goal.id}`, { method: "DELETE" })).status).toBe(404);
    expect(await body<ObjectiveDto[]>(await other.request("/objectives"))).toEqual([]);
  });

  it("updates and deletes", async () => {
    const { request, today, create } = await setup();
    const goal = await body<ObjectiveDto>(
      await create({ name: "Pushups", target: 500, unit: "reps", endsOn: addDays(today, 6) }),
    );
    const updated = await body<ObjectiveDto>(
      await request(`/objectives/${goal.id}`, {
        method: "PATCH",
        ...json({ name: "1000 pushups", target: 1000, endsOn: addDays(today, 40) }),
      }),
    );
    expect(updated).toMatchObject({ name: "1000 pushups", target: 1000, term: "long" });
    expect((await request(`/objectives/${goal.id}`, { method: "DELETE" })).status).toBe(204);
    expect(await body<ObjectiveDto[]>(await request("/objectives"))).toEqual([]);
  });

  it("feeds goal progress to the daily recap", async () => {
    const { request, today, create, model, nodeId } = await setup([
      jsonResult({ changes: [], narrative: "Ran.", flags: [], nextPrompts: [] }),
    ]);
    const goal = await body<ObjectiveDto>(
      await create({
        name: "Run 100 miles",
        target: 100,
        unit: "miles",
        endsOn: addDays(today, 60),
        links: [nodeId("Cardio")],
      }),
    );
    await request(`/days/${today}/objectives/${goal.id}`, {
      method: "PUT",
      ...json({ value: 5 }),
    });
    // A goal entry alone is enough to end the day.
    expect((await request(`/days/${today}/recap`, { method: "POST" })).status).toBe(200);
    const prompt = JSON.stringify(model.doGenerateCalls.at(-1)!.prompt);
    expect(prompt).toContain("Run 100 miles: 5/100 miles");
    expect(prompt).toContain("This day added 5.");
  });
});
