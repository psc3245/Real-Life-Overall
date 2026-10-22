import {
  addDays,
  type ActivityDayDto,
  type DayDto,
  type HistoryDto,
  type RatingsDto,
} from "@rlo/shared";
import { describe, expect, it } from "vitest";
import { ratingEvents } from "../src/db/schema";
import { createRatedApp, json } from "./flows";

const body = async <T>(res: Response) => (await res.json()) as T;

async function onboarded(daysAgo: number) {
  const t = await createRatedApp();
  await t.db.update(ratingEvents).set({ createdAt: new Date(Date.now() - daysAgo * 86_400_000) });
  const today = (await body<DayDto>(await t.request("/days/today"))).today;
  return { ...t, today };
}

describe("rating history", () => {
  it("returns each node's value per day since onboarding, including decay", async () => {
    // Cardio 70, grace 5, 0.25/day: idle days 6..9 (the last four days) decay.
    const { request, today, nodeId } = await onboarded(10);
    const history = await body<HistoryDto>(await request("/ratings/history?days=30"));
    expect(history.dates[0]).toBe(addDays(today, -10));
    expect(history.dates.at(-1)).toBe(today);
    const cardio = history.series.find((s) => s.nodeId === nodeId("Cardio"))!.values;
    expect(cardio.slice(0, 6)).toEqual([70, 70, 70, 70, 70, 70]);
    expect(cardio.slice(-5)).toEqual([69.75, 69.5, 69.25, 69, 69]);

    const short = await body<HistoryDto>(await request("/ratings/history?days=3"));
    expect(short.dates).toEqual([addDays(today, -2), addDays(today, -1), today]);
  });

  it("marks trends over the last week on ratings", async () => {
    const { request } = await onboarded(10);
    const ratings = await body<RatingsDto>(await request("/ratings"));
    const byName = new Map(ratings.nodes.map((n) => [n.name, n]));
    expect(byName.get("Cardio")!.trend).toBe(-1);
    expect(byName.get("Fitness")!.trend).toBe(-1);
  });

  it("reports daily activity for the heatmap", async () => {
    const { request, today } = await onboarded(10);
    await request(`/days/${addDays(today, -1)}/journal`, {
      method: "PUT",
      ...json({ journal: "Ran." }),
    });
    const activity = await body<ActivityDayDto[]>(await request("/ratings/activity?days=5"));
    expect(activity.map((a) => a.date)).toEqual([4, 3, 2, 1, 0].map((n) => addDays(today, -n)));
    const yesterday = activity.find((a) => a.date === addDays(today, -1))!;
    expect(yesterday).toMatchObject({ logged: true, recapped: false, gain: 0 });
    expect(yesterday.loss).toBeLessThan(0); // decay of the three attributes
    expect(activity.at(-1)).toMatchObject({ logged: false, loss: 0 });
  });

  it("is empty before onboarding", async () => {
    const { request } = await createRatedApp();
    expect(
      (await body<HistoryDto>(await request("/ratings/history", { user: "nobody" }))).dates,
    ).toEqual([]);
  });
});
