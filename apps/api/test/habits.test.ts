import { addDays, type DayDto, type HabitDto } from "@rlo/shared";
import { describe, expect, it } from "vitest";
import { habitEntries } from "../src/db/schema";
import { createRatedApp, json } from "./flows";
import { createTestApp, jsonResult } from "./helpers";

const body = async <T>(res: Response) => (await res.json()) as T;

describe("habits", () => {
  it("creates with normalized config, links and default schedule", async () => {
    const { request, nodeId } = await createRatedApp();
    const res = await request("/habits", {
      method: "POST",
      ...json({
        name: "Run",
        type: "duration",
        config: { min: 3 },
        links: [nodeId("Cardio"), nodeId("Cardio")],
      }),
    });
    expect(res.status).toBe(201);
    const habit = await body<HabitDto>(res);
    expect(habit).toMatchObject({
      name: "Run",
      type: "duration",
      config: { target: 30, unit: null, min: null, max: null },
      days: [0, 1, 2, 3, 4, 5, 6],
      links: [nodeId("Cardio")],
    });
    expect((await body<HabitDto[]>(await request("/habits"))).map((h) => h.name)).toEqual(["Run"]);
  });

  it("only links to rated attributes in the user's own tree", async () => {
    const { request, nodeId } = await createRatedApp();
    const toParent = await request("/habits", {
      method: "POST",
      ...json({ name: "Gym", type: "checkbox", links: [nodeId("Fitness")] }),
    });
    expect(toParent.status).toBe(400);

    const other = await createTestApp();
    const res = await other.request("/habits", {
      method: "POST",
      ...json({ name: "Read", type: "checkbox", links: [crypto.randomUUID()] }),
    });
    expect(res.status).toBe(400); // no onboarding yet
  });

  it("updates name, schedule, config and links but keeps the type", async () => {
    const { request, nodeId } = await createRatedApp();
    const created = await body<HabitDto>(
      await request("/habits", {
        method: "POST",
        ...json({ name: "Pushups", type: "counter", config: { target: 20, unit: "reps" } }),
      }),
    );
    const updated = await body<HabitDto>(
      await request(`/habits/${created.id}`, {
        method: "PATCH",
        ...json({
          name: "Push-ups",
          days: [1, 3, 5],
          config: { target: 50 },
          links: [nodeId("Strength")],
        }),
      }),
    );
    expect(updated).toMatchObject({
      name: "Push-ups",
      type: "counter",
      days: [1, 3, 5],
      config: { target: 50, unit: "reps" },
      links: [nodeId("Strength")],
    });
  });

  it("archives habits and hides them from other users", async () => {
    const { request } = await createRatedApp();
    const created = await body<HabitDto>(
      await request("/habits", { method: "POST", ...json({ name: "Floss", type: "checkbox" }) }),
    );
    expect(
      (await request(`/habits/${created.id}`, { method: "DELETE", user: "mallory" })).status,
    ).toBe(404);
    expect((await request(`/habits/${created.id}`, { method: "DELETE" })).status).toBe(204);
    expect(await body<HabitDto[]>(await request("/habits"))).toEqual([]);
  });

  it("suggests links from the model, keeping only rated attributes", async () => {
    const { request, nodeId } = await createRatedApp([
      jsonResult({ refs: ["n3", "n1", "n99"], reason: "Running builds endurance." }),
    ]);
    const res = await request("/habits/suggest-links", {
      method: "POST",
      ...json({ name: "Morning run", type: "duration" }),
    });
    expect(await res.json()).toEqual({
      nodeIds: [nodeId("Cardio")],
      reason: "Running builds endurance.",
    });
  });
});

describe("days", () => {
  async function withHabits() {
    const t = await createRatedApp();
    const make = async (b: unknown) =>
      body<HabitDto>(await t.request("/habits", { method: "POST", ...json(b) }));
    const today = (await body<DayDto>(await t.request("/days/today"))).today;
    return { ...t, make, today };
  }

  it("lists habits with scheduled ones first and saves the journal", async () => {
    const { request, make, today } = await withHabits();
    const weekday = new Date(`${today}T00:00:00Z`).getUTCDay();
    await make({ name: "Off day", type: "checkbox", days: [(weekday + 1) % 7] });
    await make({ name: "Daily", type: "checkbox" });

    const saved = await body<DayDto>(
      await request(`/days/${today}/journal`, { method: "PUT", ...json({ journal: "Good day." }) }),
    );
    expect(saved).toMatchObject({
      date: today,
      editable: true,
      status: "open",
      journal: "Good day.",
    });
    expect(saved.habits.map((h) => [h.habit.name, h.scheduled])).toEqual([
      ["Daily", true],
      ["Off day", false],
    ]);
  });

  it("saves, validates and clears habit entries", async () => {
    const { request, make, today, db } = await withHabits();
    const pages = await make({
      name: "Read",
      type: "counter",
      config: { unit: "pages", target: 10 },
    });
    const url = `/days/${today}/habits/${pages.id}`;

    const saved = await body<DayDto>(await request(url, { method: "PUT", ...json({ num: 12 }) }));
    expect(saved.habits[0]!.entry).toEqual({ num: 12, text: null });
    expect((await request(url, { method: "PUT", ...json({ num: 1.5 }) })).status).toBe(400);

    const cleared = await body<DayDto>(await request(url, { method: "PUT", ...json({}) }));
    expect(cleared.habits[0]!.entry).toBeNull();
    expect(await db.select().from(habitEntries)).toHaveLength(0);
  });

  it("allows backfill within the window only, and never the future", async () => {
    const { request, today } = await withHabits();
    const put = (date: string) =>
      request(`/days/${date}/journal`, { method: "PUT", ...json({ journal: "x" }) });
    expect((await put(addDays(today, -3))).status).toBe(200);
    expect((await put(addDays(today, -4))).status).toBe(409);
    expect((await put(addDays(today, 1))).status).toBe(400);

    const old = await body<DayDto>(await request(`/days/${addDays(today, -10)}`));
    expect(old.editable).toBe(false);
  });

  it("hides habits on days before they existed", async () => {
    const { request, make, today } = await withHabits();
    await make({ name: "New habit", type: "checkbox" });
    const yesterday = await body<DayDto>(await request(`/days/${addDays(today, -1)}`));
    expect(yesterday.habits).toEqual([]);
  });

  it("keeps archived habits on days they were logged", async () => {
    const { request, make, today } = await withHabits();
    const habit = await make({ name: "Old", type: "checkbox" });
    await request(`/days/${today}/habits/${habit.id}`, { method: "PUT", ...json({ num: 1 }) });
    await request(`/habits/${habit.id}`, { method: "DELETE" });
    const day = await body<DayDto>(await request(`/days/${today}`));
    expect(day.habits.map((h) => h.habit.name)).toEqual(["Old"]);
    const write = await request(`/days/${today}/habits/${habit.id}`, {
      method: "PUT",
      ...json({ num: 0 }),
    });
    expect(write.status).toBe(404);
  });
});
