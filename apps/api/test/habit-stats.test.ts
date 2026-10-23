import { addDays, type DayDto, type HabitDto, type HabitStatsResponseDto } from "@rlo/shared";
import { describe, expect, it } from "vitest";
import { createRatedApp, json } from "./flows";

const body = async <T>(res: Response) => (await res.json()) as T;

describe("habit stats", () => {
  it("summarizes each habit for the week, month and season", async () => {
    const t = await createRatedApp();
    const today = (await body<DayDto>(await t.request("/days/today"))).today;
    const habit = await body<HabitDto>(
      await t.request("/habits", {
        method: "POST",
        ...json({ name: "Run", type: "checkbox", startsOn: addDays(today, -20) }),
      }),
    );
    for (const offset of [-2, -1, 0]) {
      await t.request(`/days/${addDays(today, offset)}/habits/${habit.id}`, {
        method: "PUT",
        ...json({ num: 1 }),
      });
    }

    const season = await body<HabitStatsResponseDto>(await t.request("/habits/stats?range=season"));
    expect(season.range).toBe("season");
    const run = season.habits[0]!;
    expect(run).toMatchObject({ currentStreak: 3, bestStreak: 3 });
    expect(run.completed).toBe(3);
    expect(run.days.length).toBeGreaterThanOrEqual(90);

    const week = await body<HabitStatsResponseDto>(
      await t.request(`/habits/stats?range=week&date=${today}`),
    );
    expect(week.habits[0]!.days).toHaveLength(7);
    expect((await t.request("/habits/stats?range=year")).status).toBe(400);
  });
});
