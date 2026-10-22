import {
  addDays,
  type ChangeFeedItemDto,
  type DayDto,
  type HabitDto,
  type PauseDto,
  type RatingsDto,
} from "@rlo/shared";
import { describe, expect, it } from "vitest";
import { decayRuns, ratingEvents } from "../src/db/schema";
import { localHour, runForUser } from "../src/services/scheduler";
import { createRatedApp, json } from "./flows";
import { jsonResult, testBindings } from "./helpers";

// Standard ratings: Career 80, Cardio 70, Strength 50; every rule is
// grace 5 days, 0.25/day, floor value - 20.
const body = async <T>(res: Response) => (await res.json()) as T;

async function onboardedDaysAgo(days: number, responses: ReturnType<typeof jsonResult>[] = []) {
  const t = await createRatedApp(responses);
  await t.db.update(ratingEvents).set({ createdAt: new Date(Date.now() - days * 86_400_000) });
  const today = (await body<DayDto>(await t.request("/days/today"))).today;
  const values = async () =>
    Object.fromEntries(
      (await body<RatingsDto>(await t.request("/ratings"))).nodes.map((n) => [n.name, n.value]),
    );
  return { ...t, today, values };
}

describe("decay", () => {
  it("catches up on read: fades each idle attribute after its grace period", async () => {
    const { request, values, db } = await onboardedDaysAgo(10);
    // Days 1..9 after onboarding are processed (through yesterday); idle days 6..9 decay.
    expect(await values()).toMatchObject({ Cardio: 69, Strength: 49, Career: 79 });
    expect(await db.select().from(decayRuns)).toHaveLength(9);

    await values(); // idempotent
    expect(await db.select().from(decayRuns)).toHaveLength(9);

    const feed = await body<ChangeFeedItemDto[]>(await request("/ratings/changes?limit=3"));
    expect(feed[0]).toMatchObject({ source: "decay", delta: -0.25 });
    expect(feed[0]!.reason).toMatch(/^No (Career|Cardio|Strength) activity for 9 days\.$/);
    expect(feed[0]!.date).not.toBeNull();
  });

  it("recomputes when a linked habit is completed on a past day", async () => {
    const { request, values, today, nodeId } = await onboardedDaysAgo(10);
    await values();
    const run = await body<HabitDto>(
      await request("/habits", {
        method: "POST",
        ...json({
          name: "Run",
          type: "checkbox",
          links: [nodeId("Cardio")],
          startsOn: addDays(today, -3),
        }),
      }),
    );
    await request(`/days/${addDays(today, -2)}/habits/${run.id}`, {
      method: "PUT",
      ...json({ num: 1 }),
    });
    // Cardio: idle 1..7 before the run (decays at 6 and 7), then 1 idle day after.
    expect(await values()).toMatchObject({ Cardio: 69.5, Strength: 49, Career: 79 });
  });

  it("does not decay paused days, and pauses can be ended", async () => {
    const { request, values, today } = await onboardedDaysAgo(10);
    const pause = await body<PauseDto>(
      await request("/pauses", {
        method: "POST",
        ...json({ startsOn: addDays(today, -3), reason: "Vacation" }),
      }),
    );
    expect(pause).toMatchObject({ endsOn: null, reason: "Vacation" });
    // Days -9..-4 processed unpaused (idle 1..6 → one decay), -3..-1 paused.
    expect(await values()).toMatchObject({ Cardio: 69.75, Career: 79.75 });

    const overlap = await request("/pauses", {
      method: "POST",
      ...json({ startsOn: addDays(today, -1) }),
    });
    expect(overlap.status).toBe(409);
    const tooEarly = await request("/pauses", {
      method: "POST",
      ...json({ startsOn: addDays(today, -9) }),
    });
    expect(tooEarly.status).toBe(400);

    const ended = await body<PauseDto>(
      await request(`/pauses/${pause.id}/end`, {
        method: "POST",
        ...json({ endsOn: addDays(today, -2) }),
      }),
    );
    expect(ended.endsOn).toBe(addDays(today, -2));
    // Yesterday is no longer paused: idle 7 → another decay.
    expect(await values()).toMatchObject({ Cardio: 69.5, Career: 79.5 });

    const removed = await request(`/pauses/${pause.id}/end`, {
      method: "POST",
      ...json({ endsOn: addDays(today, -4) }),
    });
    expect(removed.status).toBe(204);
    expect(await body<PauseDto[]>(await request("/pauses"))).toEqual([]);
    expect(await values()).toMatchObject({ Cardio: 69, Career: 79 });
  });
});

describe("scheduled job", () => {
  const recap = jsonResult({
    changes: [{ ref: "n3", delta: 0.5, reason: "You ran.", evidence: "Ran" }],
    narrative: "Auto.",
    flags: [],
    nextPrompts: [],
  });

  it("auto-recaps forgotten days with content, then decays", async () => {
    const t = await onboardedDaysAgo(10, [recap]);
    await t.request(`/days/${addDays(t.today, -1)}/journal`, {
      method: "PUT",
      ...json({ journal: "Ran 5k." }),
    });
    const result = await runForUser(
      t.db,
      t.llm,
      (await body<{ id: string }>(await t.request("/me"))).id,
      "UTC",
      {
        recap: true,
      },
    );
    expect(result.recapped).toEqual([addDays(t.today, -1)]);
    expect(result.failed).toEqual([]);
    const yesterday = await body<DayDto>(await t.request(`/days/${addDays(t.today, -1)}`));
    expect(yesterday.recap?.narrative).toBe("Auto.");
    // Cardio idled 8 days (3 decays) before the recap raised it yesterday, which also
    // counts as activity, so yesterday doesn't decay: 70 - 0.75 + 0.5.
    expect(await t.values()).toMatchObject({ Cardio: 69.75, Career: 79 });
  });

  it("reads the hour in the user's timezone", () => {
    const at = new Date("2026-10-21T09:30:00Z");
    expect(localHour("UTC", at)).toBe(9);
    expect(localHour("America/Chicago", at)).toBe(4);
  });

  it("hides dev routes outside development", async () => {
    const t = await onboardedDaysAgo(1);
    expect((await t.request("/dev/run-scheduled", { method: "POST" })).status).toBe(404);
    const dev = await t.app.request(
      "/dev/run-scheduled",
      { method: "POST", headers: { "x-dev-user": "tester" } },
      { ...testBindings, APP_ENV: "development" },
    );
    expect(dev.status).toBe(200);
  });
});
