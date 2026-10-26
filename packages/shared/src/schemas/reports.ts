import { z } from "zod";
import { isValidDate } from "../dates";
import {
  CHART_BUCKETS,
  CHART_STYLES,
  MAX_CHART_METRICS,
  type ChartBucket,
  type ChartStyle,
  type MetricSeriesDto,
  type SeriesStatsDto,
} from "./metrics";

/**
 * Reports (DESIGN.md §7.8): a named collection of charts, run over any period. Each run is a
 * snapshot (data, stats, and optionally an AI write-up and suggestions), so runs can be compared.
 */
export const REPORT_RANGES = ["7d", "30d", "90d", "season", "year", "custom"] as const;
export type ReportRange = (typeof REPORT_RANGES)[number];
export const REPORT_RANGE_LABELS: Record<ReportRange, string> = {
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  "90d": "Last 90 days",
  season: "This season",
  year: "Last year",
  custom: "Custom dates",
};

export const MAX_REPORT_CHARTS = 12;
/** Runs with a write-up or suggestions call the model; capped per user per day. */
export const MAX_REPORT_AI_RUNS_PER_DAY = 10;
export const MAX_REPORT_SUGGESTIONS = 5;

export interface ReportChartDto {
  title: string;
  metricIds: string[];
  bucket: ChartBucket;
  style: ChartStyle;
  average: boolean;
  trend: boolean;
}

export interface ReportOptions {
  /** A plain sentence per chart from its numbers (no AI). */
  summaries: boolean;
  /** An AI narrative of the period. */
  writeUp: boolean;
  /** AI suggestions for what to do next. */
  suggestions: boolean;
}

export interface ReportRunSummaryDto {
  id: string;
  from: string;
  to: string;
  createdAt: string;
}

export interface ReportDto {
  id: string;
  name: string;
  description: string;
  charts: ReportChartDto[];
  options: ReportOptions;
  /** Presets only; custom dates are chosen per run. */
  defaultRange: Exclude<ReportRange, "custom">;
  lastRun: ReportRunSummaryDto | null;
}

export interface ReportRunChartDto {
  chart: ReportChartDto;
  series: MetricSeriesDto[];
  /** Per series, over the chart's buckets. */
  stats: SeriesStatsDto[];
  /** One sentence per series (when summaries are on). */
  summaries: string[] | null;
}

export interface ReportRunDto extends ReportRunSummaryDto {
  reportId: string;
  reportName: string;
  options: ReportOptions;
  charts: ReportRunChartDto[];
  writeUp: string | null;
  suggestions: string[] | null;
  /** Set when the AI part failed; the charts and summaries are still there. */
  aiError: string | null;
}

// Request bodies

const reportChartSchema = z.object({
  title: z.string().trim().max(80).default(""),
  metricIds: z.array(z.string().min(1).max(80)).min(1).max(MAX_CHART_METRICS),
  bucket: z.enum(CHART_BUCKETS).default("day"),
  style: z.enum(CHART_STYLES).default("line"),
  average: z.boolean().default(false),
  trend: z.boolean().default(false),
});

const optionsSchema = z.object({
  summaries: z.boolean().default(true),
  writeUp: z.boolean().default(false),
  suggestions: z.boolean().default(false),
});

export const reportBodySchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(500).default(""),
  charts: z.array(reportChartSchema).min(1).max(MAX_REPORT_CHARTS),
  options: optionsSchema.default({ summaries: true, writeUp: false, suggestions: false }),
  defaultRange: z.enum(REPORT_RANGES).exclude(["custom"]).default("30d"),
});

/** Updates without defaults, so a missing field keeps its saved value. */
export const updateReportBodySchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    description: z.string().trim().max(500),
    charts: z.array(reportChartSchema).min(1).max(MAX_REPORT_CHARTS),
    options: z.object({ summaries: z.boolean(), writeUp: z.boolean(), suggestions: z.boolean() }),
    defaultRange: z.enum(REPORT_RANGES).exclude(["custom"]),
  })
  .partial();

const dateSchema = z.string().refine(isValidDate, "Use a valid YYYY-MM-DD date");

export const runReportBodySchema = z
  .object({
    range: z.enum(REPORT_RANGES).optional(),
    from: dateSchema.optional(),
    to: dateSchema.optional(),
    /** Override the report's checkboxes for this run. */
    options: z
      .object({ summaries: z.boolean(), writeUp: z.boolean(), suggestions: z.boolean() })
      .partial()
      .optional(),
  })
  .refine((v) => v.range !== "custom" || (v.from && v.to && v.from <= v.to), {
    message: "Custom ranges need from and to, with from first",
    path: ["from"],
  });

// LLM output

export const reportAnalysisOutputSchema = z.object({
  writeUp: z
    .string()
    .describe("3-6 sentences on the period: what moved, what held, notable patterns"),
  suggestions: z
    .array(z.string())
    .describe(`Up to ${MAX_REPORT_SUGGESTIONS} concrete next steps, each one sentence`),
});
