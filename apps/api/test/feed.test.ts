import type { ActivityDayDto, ChangeFeedItemDto, DayDto } from "@rlo/shared";
import { describe, expect, it } from "vitest";
import { firstSentence } from "../src/services/history-service";
import { createRatedApp, json } from "./flows";
import { jsonResult } from "./helpers";

const body = async <T>(res: Response) => (await res.json()) as T;

describe("change feed filters and activity summaries", () => {
  it("filters by source and node (a category covers its attributes) and pages", async () => {
    const t = await createRatedApp([
      jsonResult({
        changes: [
          { ref: "n3", delta: 1, reason: "Ran far. Felt good.", evidence: "run" },
          { ref: "n2", delta: -0.5, reason: "Skipped work.", evidence: "work" },
        ],
        narrative: "Ran 10k before work. Then a slow afternoon.",
        flags: [],
        nextPrompts: [],
      }),
    ]);
    const today = (await body<DayDto>(await t.request("/days/today"))).today;
    await t.request(`/days/${today}/journal`, { method: "PUT", ...json({ journal: "Ran 10k." }) });
    await t.request(`/days/${today}/recap`, { method: "POST" });

    const recaps = await body<ChangeFeedItemDto[]>(
      await t.request("/ratings/changes?source=daily_recap"),
    );
    expect(recaps.map((c) => c.nodeName).sort()).toEqual(["Cardio", "Career"]);

    const fitness = await body<ChangeFeedItemDto[]>(
      await t.request(`/ratings/changes?source=daily_recap&nodeId=${t.nodeId("Fitness")}`),
    );
    expect(fitness.map((c) => c.nodeName)).toEqual(["Cardio"]);

    const all = await body<ChangeFeedItemDto[]>(await t.request("/ratings/changes?limit=200"));
    const page2 = await body<ChangeFeedItemDto[]>(
      await t.request("/ratings/changes?limit=2&offset=2"),
    );
    expect(page2.map((c) => c.id)).toEqual(all.slice(2, 4).map((c) => c.id));
    expect((await t.request("/ratings/changes?source=bogus")).status).toBe(400);

    const activity = await body<ActivityDayDto[]>(await t.request("/ratings/activity?days=3"));
    expect(activity.at(-1)).toMatchObject({ date: today, summary: "Ran 10k before work." });
  });

  it("trims summaries to one short sentence", () => {
    expect(firstSentence("One. Two.")).toBe("One.");
    expect(firstSentence("No ending")).toBe("No ending");
    expect(firstSentence("x".repeat(200)).length).toBe(110);
  });
});
