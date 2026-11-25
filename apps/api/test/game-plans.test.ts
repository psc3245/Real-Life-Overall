import { addDays, MAX_GAME_PLANS, type DayDto, type GamePlanDto } from "@rlo/shared";
import { describe, expect, it } from "vitest";
import { createRatedApp, json } from "./flows";
import { jsonResult } from "./helpers";

const body = async <T>(res: Response) => (await res.json()) as T;

const recap = jsonResult({ changes: [], narrative: "A quiet day.", flags: [], nextPrompts: [] });
const coachReply = jsonResult({ reply: "Keep lifting first.", suggestions: [] });

async function setup(responses: ReturnType<typeof jsonResult>[] = []) {
  const t = await createRatedApp(responses);
  const today = (await body<DayDto>(await t.request("/days/today"))).today;
  const create = (input: Record<string, unknown>) =>
    t.request("/game-plans", { method: "POST", ...json(input) });
  const list = async () => body<GamePlanDto[]>(await t.request("/game-plans"));
  return { ...t, today, create, list };
}

describe("game plans", () => {
  it("creates, edits and deletes them, with status from the window", async () => {
    const t = await setup();
    const res = await t.create({
      name: "Build strength",
      note: "Lifting first.",
      endsOn: addDays(t.today, 30),
      links: [t.nodeId("Strength"), t.nodeId("Fitness")],
    });
    expect(res.status).toBe(201);
    const plan = await body<GamePlanDto>(res);
    expect(plan).toMatchObject({
      name: "Build strength",
      startsOn: t.today,
      status: "active",
      links: [t.nodeId("Strength"), t.nodeId("Fitness")], // categories can be linked too
    });

    const later = await body<GamePlanDto>(
      await t.create({
        name: "Sleep",
        startsOn: addDays(t.today, 5),
        endsOn: addDays(t.today, 40),
      }),
    );
    expect(later.status).toBe("upcoming");
    const edited = await body<GamePlanDto>(
      await t.request(`/game-plans/${plan.id}`, {
        method: "PATCH",
        ...json({ startsOn: addDays(t.today, -20), endsOn: addDays(t.today, -1), links: [] }),
      }),
    );
    expect(edited).toMatchObject({ status: "ended", links: [] });
    // Running and upcoming first, then ended.
    expect((await t.list()).map((p) => p.name)).toEqual(["Sleep", "Build strength"]);

    expect((await t.request(`/game-plans/${plan.id}`, { method: "DELETE" })).status).toBe(204);
    expect((await t.list()).map((p) => p.name)).toEqual(["Sleep"]);
    expect((await t.request(`/game-plans/${plan.id}`, { method: "DELETE" })).status).toBe(404);
  });

  it("validates the window and links, and caps how many run at once", async () => {
    const t = await setup();
    const bad = (input: Record<string, unknown>) => t.create({ name: "X", ...input });
    expect((await bad({ endsOn: addDays(t.today, -1) })).status).toBe(400);
    expect((await bad({ endsOn: addDays(t.today, 400) })).status).toBe(400);
    expect(
      (await bad({ endsOn: t.today, links: ["00000000-0000-4000-8000-000000000000"] })).status,
    ).toBe(400);
    for (let i = 0; i < MAX_GAME_PLANS; i++) {
      expect((await t.create({ name: `Plan ${i}`, endsOn: t.today })).status).toBe(201);
    }
    expect((await t.create({ name: "One more", endsOn: t.today })).status).toBe(409);
  });

  it("goes to the coach and the daily recap while it runs", async () => {
    const t = await setup([coachReply, recap]);
    await t.create({
      name: "Build strength",
      note: "Lifting first.",
      endsOn: addDays(t.today, 30),
      links: [t.nodeId("Strength")],
    });
    await t.create({ name: "Sleep reset", startsOn: addDays(t.today, 3), endsOn: addDays(t.today, 9) });

    await t.request("/coach/messages", { method: "POST", ...json({ content: "What now?" }) });
    const coach = JSON.stringify(t.model.doGenerateCalls.at(-1)!.prompt);
    expect(coach).toContain(
      `- Build strength (through ${addDays(t.today, 30)}), leaning into Strength: Lifting first.`,
    );
    expect(coach).not.toContain("Sleep reset"); // not running yet

    await t.request(`/days/${t.today}/journal`, { method: "PUT", ...json({ journal: "Lifted." }) });
    await t.request(`/days/${t.today}/recap`, { method: "POST" });
    const daily = JSON.stringify(t.model.doGenerateCalls.at(-1)!.prompt);
    expect(daily).toContain("Game Plans (what the user chose to lean into");
    expect(daily).toContain("Build strength");
  });
});
