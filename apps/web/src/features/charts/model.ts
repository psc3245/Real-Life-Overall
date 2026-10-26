import {
  aggregatePoints,
  correlation,
  linearTrend,
  movingAverage,
  type ChartBucket,
  type ChartConfig,
  type MetricDto,
  type MetricPointDto,
  type MetricSeriesDto,
} from "@rlo/shared";
import { CATEGORY_COLORS } from "../../components/charts/palette";

/** Days a trend line is projected past the last point, by bucket. */
const PROJECT_DAYS: Record<ChartBucket, number> = { day: 14, week: 28, month: 60 };
const DAYS_PER: Record<ChartBucket, number> = { day: 1, week: 7, month: 30 };

export interface ChartLine {
  /** Row key for the series' values (avg and trend use `${key}~avg`, `${key}~trend`). */
  key: string;
  metric: MetricDto;
  color: string;
  /** Y axis id: one per unit, so different units don't share a scale. */
  axis: string;
}

export interface SeriesStats {
  metric: MetricDto;
  color: string;
  points: number;
  latest: number | null;
  min: number | null;
  max: number | null;
  mean: number | null;
  /** Sum over the range (amount metrics). */
  total: number | null;
  /** Last minus first point (levels and sessions). */
  change: number | null;
  /** Fitted change per bucket, and how well the line fits. */
  slope: number | null;
  r2: number | null;
}

export interface ChartModel {
  rows: Record<string, number | string | null>[];
  lines: ChartLine[];
  axes: { id: string; unit: string }[];
  stats: SeriesStats[];
  /** Between the first two series, over the buckets both have. */
  correlation: { r: number; n: number; a: MetricDto; b: MetricDto } | null;
}

const round = (n: number) => Math.round(n * 100) / 100;

export function buildChart(
  series: MetricSeriesDto[],
  config: Pick<ChartConfig, "bucket" | "average" | "trend">,
  weekStart: number,
): ChartModel {
  const units = [...new Set(series.map((s) => s.metric.unit || s.metric.label))];
  const axes = units.map((unit, i) => ({ id: `y${i}`, unit }));
  const rows = new Map<string, Record<string, number | string | null>>();
  const row = (date: string) => {
    if (!rows.has(date)) rows.set(date, { date });
    return rows.get(date)!;
  };
  const lines: ChartLine[] = [];
  const stats: SeriesStats[] = [];
  const aggregated: MetricPointDto[][] = [];

  series.forEach((s, i) => {
    const key = `s${i}`;
    const color = CATEGORY_COLORS[i % CATEGORY_COLORS.length]!;
    const axis = axes[units.indexOf(s.metric.unit || s.metric.label)]!.id;
    const points = aggregatePoints(s.points, config.bucket, s.metric.kind, weekStart);
    aggregated.push(points);
    lines.push({ key, metric: s.metric, color, axis });
    for (const p of points) row(p.date)[key] = p.value;
    if (config.average && points.length > 1) {
      for (const p of movingAverage(points, 7)) row(p.date)[`${key}~avg`] = p.value;
    }
    const trend = linearTrend(points, config.trend ? PROJECT_DAYS[config.bucket] : 0);
    if (config.trend && trend) {
      for (const p of trend.line) row(p.date)[`${key}~trend`] = p.value;
    }
    const values = points.map((p) => p.value);
    stats.push({
      metric: s.metric,
      color,
      points: points.length,
      latest: values.at(-1) ?? null,
      min: values.length ? Math.min(...values) : null,
      max: values.length ? Math.max(...values) : null,
      mean: values.length ? round(values.reduce((a, b) => a + b, 0) / values.length) : null,
      total: s.metric.kind === "amount" ? round(values.reduce((a, b) => a + b, 0)) : null,
      change:
        s.metric.kind !== "amount" && values.length > 1 ? round(values.at(-1)! - values[0]!) : null,
      slope: trend ? round(trend.slope * DAYS_PER[config.bucket]) : null,
      r2: trend ? round(trend.r2) : null,
    });
  });

  const c = series.length >= 2 ? correlation(aggregated[0]!, aggregated[1]!) : null;
  return {
    rows: [...rows.values()].sort((a, b) => String(a.date).localeCompare(String(b.date))),
    lines,
    axes,
    stats,
    correlation: c ? { ...c, a: series[0]!.metric, b: series[1]!.metric } : null,
  };
}

/** "/charts?m=…" for a set of metric ids, with optional config overrides. */
export function chartHref(ids: string[], config: Partial<ChartConfig> = {}): string {
  const params = new URLSearchParams({ m: ids.join(",") });
  if (config.range) params.set("range", config.range);
  if (config.bucket) params.set("bucket", config.bucket);
  if (config.style) params.set("style", config.style);
  if (config.trend) params.set("trend", "1");
  if (config.average) params.set("avg", "1");
  return `/charts?${params}`;
}
