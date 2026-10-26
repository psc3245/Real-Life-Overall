import {
  addDays,
  aggregatePoints,
  localDateIn,
  MAX_REPORT_AI_RUNS_PER_DAY,
  MAX_REPORT_SUGGESTIONS,
  reportAnalysisOutputSchema,
  seasonForDate,
  seriesStats,
  summarizeSeries,
  type ReportChartDto,
  type ReportDto,
  type ReportOptions,
  type ReportRange,
  type ReportRunChartDto,
  type ReportRunDto,
  type ReportRunSummaryDto,
  type reportBodySchema,
  type runReportBodySchema,
  type updateReportBodySchema,
} from "@rlo/shared";
import type { z } from "zod";
import type { Database } from "../db/client";
import { badRequest, conflict, notFound } from "../errors";
import { LlmError, type LlmClient } from "../llm/client";
import { reportAnalysisPrompt } from "../llm/prompts/reports";
import * as reportRepo from "../repos/report-repo";
import type { ReportRow, ReportRunRow } from "../repos/report-repo";
import * as userRepo from "../repos/user-repo";
import { series } from "./metrics-service";

const summary = (r: {
  id: string;
  from: string;
  to: string;
  createdAt: Date;
}): ReportRunSummaryDto => ({
  id: r.id,
  from: r.from,
  to: r.to,
  createdAt: r.createdAt.toISOString(),
});

function toDto(row: ReportRow, lastRun: ReportRunSummaryDto | null): ReportDto {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    charts: row.charts as ReportChartDto[],
    options: row.options as ReportOptions,
    defaultRange: row.defaultRange as ReportDto["defaultRange"],
    lastRun,
  };
}

/** A blank title becomes the metrics' names once they're known (at run time). */
const normalizeCharts = (charts: ReportChartDto[]) =>
  charts.map((c) => ({ ...c, title: c.title.trim() }));

export async function listReports(db: Database, userId: string): Promise<ReportDto[]> {
  const rows = await reportRepo.findByUser(db, userId);
  const latest = new Map(
    (
      await reportRepo.findLatestRuns(
        db,
        rows.map((r) => r.id),
      )
    ).map((r) => [r.reportId, summary(r)]),
  );
  return rows.map((r) => toDto(r, latest.get(r.id) ?? null));
}

async function own(db: Database, userId: string, id: string) {
  const row = await reportRepo.findById(db, userId, id);
  if (!row) throw notFound("Report not found");
  return row;
}

export async function getReport(db: Database, userId: string, id: string): Promise<ReportDto> {
  const row = await own(db, userId, id);
  const [latest] = await reportRepo.findLatestRuns(db, [row.id]);
  return toDto(row, latest ? summary(latest) : null);
}

export async function createReport(
  db: Database,
  userId: string,
  input: z.infer<typeof reportBodySchema>,
): Promise<ReportDto> {
  const row = await reportRepo.insert(db, {
    userId,
    name: input.name,
    description: input.description,
    charts: normalizeCharts(input.charts),
    options: input.options,
    defaultRange: input.defaultRange,
  });
  return toDto(row, null);
}

export async function updateReport(
  db: Database,
  userId: string,
  id: string,
  input: z.infer<typeof updateReportBodySchema>,
): Promise<ReportDto> {
  const row = await own(db, userId, id);
  await reportRepo.update(db, row.id, {
    ...(input.name !== undefined && { name: input.name }),
    ...(input.description !== undefined && { description: input.description }),
    ...(input.charts !== undefined && { charts: normalizeCharts(input.charts) }),
    ...(input.options !== undefined && { options: input.options }),
    ...(input.defaultRange !== undefined && { defaultRange: input.defaultRange }),
  });
  return getReport(db, userId, row.id);
}

export async function deleteReport(db: Database, userId: string, id: string) {
  await reportRepo.remove(db, (await own(db, userId, id)).id);
}

/** A preset (ending today, in the user's timezone) or custom dates. */
function resolvePeriod(
  range: ReportRange,
  today: string,
  custom: { from?: string; to?: string },
): { from: string; to: string } {
  switch (range) {
    case "7d":
      return { from: addDays(today, -6), to: today };
    case "30d":
      return { from: addDays(today, -29), to: today };
    case "90d":
      return { from: addDays(today, -89), to: today };
    case "season":
      return { from: seasonForDate(today).startsOn, to: today };
    case "year":
      return { from: addDays(today, -364), to: today };
    case "custom": {
      const to = custom.to! > today ? today : custom.to!;
      if (custom.from! > to) throw badRequest("The period can't start in the future");
      return { from: custom.from!, to };
    }
  }
}

/** The numbers and summaries the model sees for one chart. */
function describeChart(c: ReportRunChartDto, i: number): string {
  const lines = c.series.map((s, j) => {
    const st = c.stats[j]!;
    const sentence = summarizeSeries(s.metric, st, c.chart.bucket);
    return (
      `  - ${s.metric.label}${s.metric.detail ? ` (${s.metric.detail})` : ""}: ${sentence} ` +
      `[points ${st.points}, mean ${st.mean ?? "n/a"}, min ${st.min ?? "n/a"}, max ${st.max ?? "n/a"}` +
      `${st.r2 !== null ? `, trend fit r2 ${st.r2}` : ""}]`
    );
  });
  return [`${i + 1}. ${c.chart.title} (by ${c.chart.bucket})`, ...lines].join("\n");
}

/**
 * Runs a report over a period: fetches every chart's data, aggregates it, adds summaries and
 * (if asked) an AI write-up and suggestions, and stores the whole run as a snapshot.
 */
export async function runReport(
  db: Database,
  llm: LlmClient,
  userId: string,
  reportId: string,
  input: z.infer<typeof runReportBodySchema>,
): Promise<ReportRunDto> {
  const report = await own(db, userId, reportId);
  const user = await userRepo.findById(db, userId);
  if (!user) throw notFound("User not found");
  const today = localDateIn(user.timezone);
  const range = input.range ?? (report.defaultRange as ReportRange);
  const { from, to } = resolvePeriod(range, today, input);
  const options: ReportOptions = { ...(report.options as ReportOptions), ...input.options };
  const usesAi = options.writeUp || options.suggestions;
  if (usesAi) {
    const since = new Date(Date.now() - 86_400_000);
    if ((await reportRepo.countAiRunsSince(db, userId, since)) >= MAX_REPORT_AI_RUNS_PER_DAY) {
      throw conflict(
        `You've run ${MAX_REPORT_AI_RUNS_PER_DAY} reports with a write-up or suggestions in the ` +
          "last day. Run it without them, or try again later.",
      );
    }
  }

  const charts: ReportRunChartDto[] = [];
  for (const chart of report.charts as ReportChartDto[]) {
    const data = await series(db, userId, chart.metricIds, { from, to });
    const stats = data.series.map((s) =>
      seriesStats(
        aggregatePoints(s.points, chart.bucket, s.metric.kind, user.weekStart),
        s.metric.kind,
        chart.bucket,
      ),
    );
    charts.push({
      chart: {
        ...chart,
        title: chart.title || data.series.map((s) => s.metric.label).join(" vs "),
      },
      series: data.series,
      stats,
      summaries: options.summaries
        ? data.series.map((s, i) => summarizeSeries(s.metric, stats[i]!, chart.bucket))
        : null,
    });
  }

  let writeUp: string | null = null;
  let suggestions: string[] | null = null;
  let aiError: string | null = null;
  if (usesAi) {
    const profile = await userRepo.findProfileSummary(db, userId);
    try {
      const out = await llm.generateStructured({
        purpose: "reports.analysis",
        userId,
        schema: reportAnalysisOutputSchema,
        system: reportAnalysisPrompt.system,
        prompt: [
          `What you know about the user:\n${profile?.trim() || "(nothing yet)"}`,
          `Report: ${report.name}${report.description ? ` — ${report.description}` : ""}`,
          `Period: ${from} to ${to}`,
          `Charts:\n${charts.map(describeChart).join("\n")}`,
          `Wanted: ${[options.writeUp && "writeUp", options.suggestions && "suggestions"].filter(Boolean).join(" and ")}.`,
        ].join("\n\n"),
        promptVersion: reportAnalysisPrompt.version,
      });
      if (options.writeUp) writeUp = out.writeUp.trim() || null;
      if (options.suggestions) {
        suggestions = out.suggestions
          .map((s) => s.trim())
          .filter(Boolean)
          .slice(0, MAX_REPORT_SUGGESTIONS);
      }
    } catch (error) {
      if (!(error instanceof LlmError)) throw error;
      aiError = error.message;
    }
  }

  const result = { reportName: report.name, options, charts, writeUp, suggestions, aiError };
  const row = await reportRepo.insertRun(db, {
    reportId: report.id,
    userId,
    from,
    to,
    usedAi: usesAi,
    result,
  });
  return toRunDto(row);
}

function toRunDto(row: ReportRunRow): ReportRunDto {
  const r = row.result as Omit<ReportRunDto, keyof ReportRunSummaryDto | "reportId">;
  return { ...summary(row), reportId: row.reportId, ...r };
}

export async function listRuns(db: Database, userId: string, reportId: string) {
  await own(db, userId, reportId);
  return (await reportRepo.findRuns(db, userId, reportId)).map(summary);
}

export async function getRun(db: Database, userId: string, runId: string): Promise<ReportRunDto> {
  const row = await reportRepo.findRun(db, userId, runId);
  if (!row) throw notFound("Report run not found");
  return toRunDto(row);
}

export async function deleteRun(db: Database, userId: string, runId: string) {
  const row = await reportRepo.findRun(db, userId, runId);
  if (!row) throw notFound("Report run not found");
  await reportRepo.removeRun(db, row.id);
}
