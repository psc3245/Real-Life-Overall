import {
  addDays,
  isDayHabitDone,
  type DayDto,
  type HabitDto,
  type HabitStatsResponseDto,
} from "@rlo/shared";
import { describe, expect, it } from "vitest";
import { createRatedApp, json } from "./flows";
import { jsonResult } from "./helpers";

const body = async <T>(res: Response) => (await res.json()) as T;

async function routine(responses: ReturnType<typeof jsonResult>[] = []) {
  const t = await createRatedApp(responses);
  const today = (await body<DayDto>(await t.request("/days/today"))).today;
  const post = async (input: Record<string, unknown>) =>
    body<HabitDto>(await t.request("/habits", { method: "POST", ...json(input) }));
  const group = await post({
    name: "Morning routine",
    type: "group",
    config: { rule: "count", target: 2 },
    startsOn: addDays(today, -7),
  });
  const stretch = await post({ name: "Stretch", type: "checkbox", parentId: group.id });
  const water = await post({
    name: "Water",
    type: "counter",
    config: { target: 2, unit: "glasses" },
    parentId: group.id,
    links: [t.nodeId("Cardio")],
  });
  const journal = await post({ name: "Pages", type: "shorttext", parentId: group.id });
  return { ...t, today, group, stretch, water, journal };
}

describe("habit groups", () => {
  it("nest sub-habits that share the group's schedule", async () => {
    const t = await routine();
    expect(t.stretch).toMatchObject({ parentId: t.group.id, startsOn: t.group.startsOn });
    expect(t.group.config).toMatchObject({ rule: "count", target: 2 });

    const day = await body<DayDto>(await t.request("/days/today"));
    expect(day.habits.map((h) => h.habit.name)).toEqual(["Morning routine"]);
    const group = day.habits[0]!;
    expect(group.children!.map((c) => c.habit.name)).toEqual(["Stretch", "Water", "Pages"]);
    expect(isDayHabitDone(group)).toBe(false);

    await t.request(`/days/${t.today}/habits/${t.stretch.id}`, {
      method: "PUT",
      ...json({ num: 1 }),
    });
    const after = await body<DayDto>(
      await t.request(`/days/${t.today}/habits/${t.water.id}`, {
        method: "PUT",
        ...json({ num: 2 }),
      }),
    );
    expect(isDayHabitDone(after.habits[0]!)).toBe(true); // 2 of 3 meets "at least 2"

    // The group itself takes no entries.
    const direct = await t.request(`/days/${t.today}/habits/${t.group.id}`, {
      method: "PUT",
      ...json({ num: 1 }),
    });
    expect(direct.status).toBe(400);

    // Changing the group's schedule moves its sub-habits too.
    await t.request(`/habits/${t.group.id}`, { method: "PATCH", ...json({ days: [1, 3, 5] }) });
    const habits = await body<HabitDto[]>(await t.request("/habits"));
    expect(habits.find((h) => h.id === t.water.id)!.days).toEqual([1, 3, 5]);
  });

  it("derive group stats from sub-habits", async () => {
    const t = await routine();
    for (const id of [t.stretch.id, t.journal.id]) {
      await t.request(`/days/${t.today}/habits/${id}`, {
        method: "PUT",
        ...json(id === t.journal.id ? { text: "Ch. 4" } : { num: 1 }),
      });
    }
    const stats = await body<HabitStatsResponseDto>(
      await t.request(`/habits/stats?range=week&date=${t.today}`),
    );
    const group = stats.habits.find((h) => h.habit.id === t.group.id)!;
    expect(group.days.find((d) => d.date === t.today)).toMatchObject({ done: true, value: "2/3" });
    expect(group.currentStreak).toBe(1);
  });

  it("reject bad structures and archive with the group", async () => {
    const t = await routine();
    const nested = await t.request("/habits", {
      method: "POST",
      ...json({ name: "Inner", type: "group", parentId: t.group.id }),
    });
    expect(nested.status).toBe(400);
    const underLeaf = await t.request("/habits", {
      method: "POST",
      ...json({ name: "Oops", type: "checkbox", parentId: t.stretch.id }),
    });
    expect(underLeaf.status).toBe(400);
    const linkedGroup = await t.request("/habits", {
      method: "POST",
      ...json({ name: "Linked", type: "group", links: [t.nodeId("Cardio")] }),
    });
    expect(linkedGroup.status).toBe(400);

    await t.request(`/habits/${t.group.id}`, { method: "DELETE" });
    expect(await body<HabitDto[]>(await t.request("/habits"))).toEqual([]);
  });

  it("show the group and its sub-habits to the daily recap", async () => {
    const t = await routine([
      jsonResult({ changes: [], narrative: "Routine done.", flags: [], nextPrompts: [] }),
    ]);
    await t.request(`/days/${t.today}/habits/${t.stretch.id}`, {
      method: "PUT",
      ...json({ num: 1 }),
    });
    await t.request(`/days/${t.today}/habits/${t.water.id}`, {
      method: "PUT",
      ...json({ num: 2 }),
    });
    await t.request(`/days/${t.today}/recap`, { method: "POST" });
    const prompt = JSON.stringify(t.model.doGenerateCalls.at(-1)!.prompt);
    expect(prompt).toContain(
      "- Morning routine (group, at least n done): 2/3 · need 2 sub-habits done, group complete.",
    );
    expect(prompt).toContain("  - Water (count, goal 2 glasses): 2 glasses, done.");
  });
});
