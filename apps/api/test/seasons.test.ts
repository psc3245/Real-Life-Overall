import {
  addDays,
  seasonForDate,
  type DayDto,
  type HabitDto,
  type OnboardingStateDto,
  type RatingsDto,
  type SeasonCardDto,
  type SeasonDetailDto,
  type SeasonSetupDto,
} from "@rlo/shared";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { ratingEvents, seasons } from "../src/db/schema";
import { createRatedApp, json } from "./flows";
import { jsonResult } from "./helpers";

const body = async <T>(res: Response) => (await res.json()) as T;

/** A rated user whose season was last quarter, so the next request rolls it over. */
async function lastQuarter(responses: ReturnType<typeof jsonResult>[] = []) {
  const t = await createRatedApp(responses);
  const today = (await body<DayDto>(await t.request("/days/today"))).today;
  const current = seasonForDate(today);
  const prev = seasonForDate(addDays(current.startsOn, -1));
  await t.db
    .update(seasons)
    .set({ label: prev.label, startsOn: prev.startsOn, endsOn: prev.endsOn });
  await t.db
    .update(ratingEvents)
    .set({ createdAt: new Date(`${addDays(prev.endsOn, -20)}T12:00:00Z`) });
  return { ...t, today, current, prev };
}

describe("season rollover", () => {
  it("archives the ended season and carries the tree, ratings, goals and links over", async () => {
    const t = await lastQuarter();
    const cardioBefore = t.nodeId("Cardio");
    await t.request(`/goals/${cardioBefore}`, { method: "PUT", ...json({ target: 80 }) });
    const habit = await body<HabitDto>(
      await t.request("/habits", {
        method: "POST",
        ...json({ name: "Run", type: "checkbox", links: [cardioBefore] }),
      }),
    );
    const ratings = await body<RatingsDto>(await t.request("/ratings"));
    expect(ratings.season).toMatchObject({ label: t.current.label, status: "active" });
    const cardio = ratings.nodes.find((n) => n.name === "Cardio")!;
    expect(cardio.id).not.toBe(cardioBefore);
    expect(cardio).toMatchObject({
      value: 70,
      goal: 80,
      rationale: `Carried over from ${t.prev.label}.`,
      decay: { graceDays: 5, perDay: 0.25, floor: 50 },
    });
    expect(ratings.archetype?.name).toBe("Desk Athlete");

    const habits = await body<HabitDto[]>(await t.request("/habits"));
    expect(habits.find((h) => h.id === habit.id)!.links).toEqual([cardio.id]);

    const cards = await body<SeasonCardDto[]>(await t.request("/seasons"));
    expect(cards).toHaveLength(1);
    expect(cards[0]).toMatchObject({ label: t.prev.label, overall: 70, archetype: "Desk Athlete" });
    expect(cards[0]!.nodes.find((n) => n.name === "Cardio")!.value).toBe(70);

    const onboarding = await body<OnboardingStateDto>(await t.request("/onboarding"));
    expect(onboarding.stage).toBe("complete");
    expect(onboarding.season.label).toBe(t.current.label);

    // Idempotent.
    await t.request("/ratings");
    expect(await t.db.select().from(seasons)).toHaveLength(2);
  });

  it("lets the new season's tree be edited during setup, rating new attributes", async () => {
    const t = await lastQuarter([
      jsonResult({
        ratings: [
          {
            ref: "n4",
            value: 55.55,
            confidence: "low",
            rationale: "No mobility data yet.",
            decayGraceDays: 7,
            decayPerDay: 0.2,
            decayFloor: 99,
          },
          {
            ref: "n2",
            value: 1,
            confidence: "low",
            rationale: "Not asked.",
            decayGraceDays: 1,
            decayPerDay: 1,
            decayFloor: 0,
          },
        ],
      }),
    ]);
    const ratings = await body<RatingsDto>(await t.request("/ratings"));
    const id = (name: string) => ratings.nodes.find((n) => n.name === name)!.id;
    const setup = await body<SeasonSetupDto>(await t.request("/seasons/setup"));
    expect(setup).toMatchObject({ label: t.current.label, editable: true });
    expect(setup.previous?.label).toBe(t.prev.label);

    const res = await t.request("/seasons/setup/tree", {
      method: "PUT",
      ...json({
        nodes: [
          { key: id("Fitness"), parentKey: null, name: "Fitness" },
          { key: id("Career"), parentKey: null, name: "Career", weight: 8 },
          { key: id("Cardio"), parentKey: id("Fitness"), name: "Endurance" },
          {
            key: "new-mobility",
            parentKey: id("Fitness"),
            name: "Mobility",
            description: "Range of motion",
          },
        ],
      }),
    });
    expect(res.status).toBe(200);
    const after = await body<RatingsDto>(res);
    const byName = new Map(after.nodes.map((n) => [n.name, n]));
    expect(byName.has("Strength")).toBe(false);
    expect(byName.get("Endurance")).toMatchObject({ id: id("Cardio"), value: 70 });
    expect(byName.get("Mobility")).toMatchObject({
      value: 55.6,
      confidence: "low",
      decay: { graceDays: 7, perDay: 0.2, floor: 55.6 },
    });
    expect(byName.get("Career")).toMatchObject({ value: 80, weight: 8 }); // not re-rated
    expect(byName.get("Fitness")!.value).toBeCloseTo(62.8, 1); // (70 + 55.6) / 2

    const prompt = JSON.stringify(t.model.doGenerateCalls.at(-1)!.prompt);
    expect(prompt).toContain("Rate these refs: n4");
    expect(prompt).toContain(`Last season (${t.prev.label}) final ratings`);
  });

  it("closes setup after the window, and the first season has none", async () => {
    const t = await lastQuarter();
    await t.request("/ratings");
    await t.db
      .update(seasons)
      .set({ setupEndsOn: addDays(t.today, -1) })
      .where(eq(seasons.label, t.current.label));
    expect((await body<SeasonSetupDto>(await t.request("/seasons/setup"))).editable).toBe(false);
    const res = await t.request("/seasons/setup/tree", {
      method: "PUT",
      ...json({ nodes: [{ key: "x", parentKey: null, name: "X" }] }),
    });
    expect(res.status).toBe(409);

    const fresh = await createRatedApp();
    expect(await body<SeasonSetupDto>(await fresh.request("/seasons/setup"))).toMatchObject({
      editable: false,
      setupEndsOn: null,
      previous: null,
    });
  });
});

describe("season detail", () => {
  it("recomputes an archived season from its ledger and shows the current one so far", async () => {
    const t = await lastQuarter();
    await t.request("/ratings"); // rolls over
    const [card] = await body<SeasonCardDto[]>(await t.request("/seasons"));

    const past = await body<SeasonDetailDto>(await t.request(`/seasons/${card!.id}`));
    expect(past).toMatchObject({ label: t.prev.label, current: false, through: t.prev.endsOn });
    const cardio = past.nodes.find((n) => n.name === "Cardio")!;
    expect(cardio).toMatchObject({ start: 70, end: 70 });
    expect(past.history.dates.at(-1)).toBe(t.prev.endsOn);
    expect(past.archetype).toBe("Desk Athlete");

    const ratings = await body<RatingsDto>(await t.request("/ratings"));
    const now = await body<SeasonDetailDto>(await t.request(`/seasons/${ratings.season.id}`));
    expect(now).toMatchObject({ current: true, through: t.today });

    expect((await t.request(`/seasons/${card!.id}`, { user: "intruder" })).status).toBe(404);
    expect((await t.request("/seasons/nope")).status).toBe(404);
  });
});
