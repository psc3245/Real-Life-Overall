import {
  addDays,
  emptySet,
  type ChartViewDto,
  type DayDto,
  type HabitDto,
  type MetricDto,
  type MetricSeriesResponseDto,
  type ObjectiveDto,
  type WorkoutDto,
} from "@rlo/shared";
import { describe, expect, it } from "vitest";
import { createRatedApp, json } from "./flows";
import { createTestApp } from "./helpers";

const body = async <T>(res: Response) => (await res.json()) as T;

describe("metrics", () => {
  it("lists every chartable number and returns points in the user's units", async () => {
    const t = await createRatedApp();
    const { request, nodeId } = t;
    const today = (await body<DayDto>(await request("/days/today"))).today;
    const run = await body<HabitDto>(
      await request("/habits", {
        method: "POST",
        ...json({
          name: "Run",
          type: "duration",
          config: { target: 30 },
          startsOn: addDays(today, -2),
        }),
      }),
    );
    await request(`/days/${addDays(today, -1)}/habits/${run.id}`, {
      method: "PUT",
      ...json({ num: 40 }),
    });
    const goal = await body<ObjectiveDto>(
      await request("/objectives", {
        method: "POST",
        ...json({
          name: "Miles",
          target: 100,
          unit: "miles",
          startsOn: addDays(today, -1),
          endsOn: addDays(today, 30),
        }),
      }),
    );
    await request(`/days/${addDays(today, -1)}/objectives/${goal.id}`, {
      method: "PUT",
      ...json({ value: 3 }),
    });
    await request(`/days/${today}/objectives/${goal.id}`, { method: "PUT", ...json({ value: 4 }) });
    const w = await body<WorkoutDto>(await request("/workouts", { method: "POST" }));
    await request(`/workouts/${w.id}`, {
      method: "PUT",
      ...json({
        exercises: [
          {
            exerciseId: "bench-press-barbell",
            sets: [{ ...emptySet(), weightKg: 61.235, reps: 8, done: true }],
          },
        ],
      }),
    });
    await request(`/workouts/${w.id}/finish`, { method: "POST" });

    const catalog = await body<MetricDto[]>(await request("/metrics"));
    const ids = catalog.map((m) => m.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        `rating:${nodeId("Cardio")}`,
        `habit:${run.id}`,
        `goal:${goal.id}`,
        "workouts:volume",
        "exercise:bench-press-barbell",
        "journal:words",
      ]),
    );
    expect(catalog.find((m) => m.id === "workouts:volume")).toMatchObject({
      unit: "lb",
      kind: "amount",
    });
    expect(ids).not.toContain("body:weight"); // not tracked

    const q = [
      `habit:${run.id}`,
      `goal:${goal.id}`,
      "workouts:volume",
      "exercise:bench-press-barbell",
      `rating:${nodeId("Cardio")}`,
    ];
    const res = await body<MetricSeriesResponseDto>(
      await request(`/metrics/series?ids=${q.join(",")}&from=${addDays(today, -2)}`),
    );
    const [habit, goalSeries, volume, bench, cardio] = res.series;
    // Amounts are dense from the habit's start, with 0 on quiet days.
    expect(habit!.points.map((p) => p.value)).toEqual([0, 40, 0]);
    expect(goalSeries!.points).toEqual([
      { date: addDays(today, -1), value: 3 },
      { date: today, value: 7 },
    ]);
    expect(volume!.points.at(-1)).toEqual({ date: today, value: 1080 });
    expect(bench!.points).toEqual([{ date: today, value: 171 }]); // est. 1RM in lb: 135 × (1 + 8/30)
    expect(cardio!.points.at(-1)).toMatchObject({ date: today, value: 70 });
  });

  it("rejects unknown metrics and other users' entities", async () => {
    const t = await createRatedApp();
    const habit = await body<HabitDto>(
      await t.request("/habits", { method: "POST", ...json({ name: "Read", type: "checkbox" }) }),
    );
    expect((await t.request("/metrics/series?ids=nope:1")).status).toBe(404);
    const other = await createTestApp();
    expect((await other.request(`/metrics/series?ids=habit:${habit.id}`)).status).toBe(404);
  });

  it("saves, pins and deletes chart views", async () => {
    const { request } = await createTestApp();
    const created = await body<ChartViewDto>(
      await request("/chart-views", {
        method: "POST",
        ...json({
          name: "Volume vs words",
          metricIds: ["workouts:volume", "journal:words"],
          trend: true,
        }),
      }),
    );
    expect(created).toMatchObject({
      range: "90d",
      bucket: "day",
      style: "line",
      trend: true,
      pinned: false,
    });
    const pinned = await body<ChartViewDto>(
      await request(`/chart-views/${created.id}`, {
        method: "PATCH",
        ...json({ pinned: true, bucket: "week" }),
      }),
    );
    expect(pinned).toMatchObject({
      pinned: true,
      bucket: "week",
      trend: true,
      name: "Volume vs words",
    });
    expect((await request(`/chart-views/${created.id}`, { method: "DELETE" })).status).toBe(204);
    expect(await body<ChartViewDto[]>(await request("/chart-views"))).toEqual([]);
  });
});
