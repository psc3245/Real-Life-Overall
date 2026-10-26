import {
  addDays,
  type DayDto,
  type HabitDto,
  type ReportDto,
  type ReportRunDto,
  type ReportRunSummaryDto,
} from "@rlo/shared";
import { describe, expect, it } from "vitest";
import { reportRuns } from "../src/db/schema";
import { createRatedApp, json } from "./flows";
import { createTestApp, jsonResult } from "./helpers";

const body = async <T>(res: Response) => (await res.json()) as T;

async function setup(responses: ReturnType<typeof jsonResult>[] = []) {
  const t = await createRatedApp(responses);
  const today = (await body<DayDto>(await t.request("/days/today"))).today;
  const run = await body<HabitDto>(
    await t.request("/habits", {
      method: "POST",
      ...json({
        name: "Run",
        type: "duration",
        config: { target: 30 },
        startsOn: addDays(today, -6),
      }),
    }),
  );
  for (const [i, num] of [20, 30, 40].entries()) {
    await t.request(`/days/${addDays(today, -i)}/habits/${run.id}`, {
      method: "PUT",
      ...json({ num }),
    });
  }
  const create = async (input: Record<string, unknown> = {}) =>
    body<ReportDto>(
      await t.request("/reports", {
        method: "POST",
        ...json({
          name: "Weekly check-in",
          charts: [
            { metricIds: [`habit:${run.id}`], bucket: "day" },
            { title: "Fitness", metricIds: [`rating:${t.nodeId("Cardio")}`, "workouts:count"] },
          ],
          defaultRange: "7d",
          ...input,
        }),
      }),
    );
  const runReport = (id: string, input: Record<string, unknown> = {}) =>
    t.request(`/reports/${id}/run`, { method: "POST", ...json(input) });
  return { ...t, today, run, create, runReport };
}

describe("reports", () => {
  it("runs a collection of charts over a period with summaries", async () => {
    const { request, today, create, runReport } = await setup();
    const report = await create();
    expect(report).toMatchObject({
      options: { summaries: true, writeUp: false, suggestions: false },
      lastRun: null,
    });

    const res = await runReport(report.id);
    expect(res.status).toBe(201);
    const r = await body<ReportRunDto>(res);
    expect(r).toMatchObject({
      from: addDays(today, -6),
      to: today,
      writeUp: null,
      suggestions: null,
    });
    expect(r.charts).toHaveLength(2);
    // A blank title becomes the metrics' names.
    expect(r.charts[0]!.chart.title).toBe("Run");
    expect(r.charts[0]!.stats[0]).toMatchObject({ total: 90, max: 40 });
    expect(r.charts[0]!.summaries![0]).toMatch(/^Run totaled 90 min/);
    expect(r.charts[1]!.series.map((s) => s.metric.label)).toEqual(["Cardio", "Workouts"]);

    // Re-run over custom dates; runs are listed newest first.
    const custom = await body<ReportRunDto>(
      await runReport(report.id, { range: "custom", from: addDays(today, -1), to: today }),
    );
    expect(custom.charts[0]!.stats[0]!.total).toBe(50);
    const runs = await body<ReportRunSummaryDto[]>(await request(`/reports/${report.id}/runs`));
    expect(runs.map((x) => x.id)).toEqual([custom.id, r.id]);
    const listed = await body<ReportDto[]>(await request("/reports"));
    expect(listed[0]!.lastRun!.id).toBe(custom.id);

    const fetched = await body<ReportRunDto>(await request(`/reports/runs/${r.id}`));
    expect(fetched.charts[0]!.stats[0]!.total).toBe(90); // the snapshot doesn't change
  });

  it("adds an AI write-up and suggestions when checked", async () => {
    const { create, runReport, model } = await setup([
      jsonResult({
        writeUp: "Running time climbed through the week.",
        suggestions: ["Add a fourth run on Saturday.", "Keep runs near 40 minutes."],
      }),
    ]);
    const report = await create({
      options: { summaries: false, writeUp: true, suggestions: true },
    });
    const r = await body<ReportRunDto>(await runReport(report.id));
    expect(r).toMatchObject({
      writeUp: "Running time climbed through the week.",
      suggestions: ["Add a fourth run on Saturday.", "Keep runs near 40 minutes."],
      aiError: null,
    });
    expect(r.charts[0]!.summaries).toBeNull();
    const prompt = JSON.stringify(model.doGenerateCalls.at(-1)!.prompt);
    expect(prompt).toContain("Run totaled 90 min");
    expect(prompt).toContain("Wanted: writeUp and suggestions.");

    // Per-run overrides: this time only suggestions.
    const second = await setup([jsonResult({ writeUp: "x", suggestions: ["y"] })]);
    const rep2 = await second.create({
      options: { summaries: true, writeUp: true, suggestions: false },
    });
    const r2 = await body<ReportRunDto>(
      await second.runReport(rep2.id, { options: { writeUp: false, suggestions: true } }),
    );
    expect(r2).toMatchObject({ writeUp: null, suggestions: ["y"] });
  });

  it("keeps the charts when the AI part fails", async () => {
    const { create, runReport } = await setup(); // no queued model responses
    const report = await create({
      options: { summaries: true, writeUp: true, suggestions: false },
    });
    const res = await runReport(report.id);
    expect(res.status).toBe(201);
    const r = await body<ReportRunDto>(res);
    expect(r.writeUp).toBeNull();
    expect(r.aiError).toBeTruthy();
    expect(r.charts[0]!.summaries).toHaveLength(1);
  });

  it("caps AI runs per day and validates periods", async () => {
    const { db, create, runReport, today } = await setup();
    const report = await create({
      options: { summaries: true, writeUp: true, suggestions: false },
    });
    const userId = (await db.query.reports.findFirst())!.userId;
    await db.insert(reportRuns).values(
      Array.from({ length: 10 }, () => ({
        reportId: report.id,
        userId,
        from: today,
        to: today,
        usedAi: true,
        result: {},
      })),
    );
    expect((await runReport(report.id)).status).toBe(409);
    // Without the AI parts it still runs.
    expect((await runReport(report.id, { options: { writeUp: false } })).status).toBe(201);
    expect((await runReport(report.id, { range: "custom" })).status).toBe(400);
  });

  it("keeps reports private and updates without wiping charts", async () => {
    const { request, create } = await setup();
    const report = await create();
    const renamed = await body<ReportDto>(
      await request(`/reports/${report.id}`, { method: "PATCH", ...json({ name: "Monthly" }) }),
    );
    expect(renamed).toMatchObject({ name: "Monthly", defaultRange: "7d" });
    expect(renamed.charts).toHaveLength(2);
    const other = await createTestApp();
    expect((await other.request(`/reports/${report.id}`)).status).toBe(404);
    expect((await request(`/reports/${report.id}`, { method: "DELETE" })).status).toBe(204);
  });
});
