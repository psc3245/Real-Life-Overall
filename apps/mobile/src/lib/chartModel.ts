import {
  aggregatePoints,
  correlation,
  linearTrend,
  movingAverage,
  seriesStats,
  type ChartBucket,
  type ChartConfig,
  type MetricDto,
  type MetricPointDto,
  type MetricSeriesDto,
  type SeriesStatsDto,
} from "@rlo/shared";
import { CATEGORY_COLORS } from "@/components/charts/palette";

/** Days a trend line is projected past the last point, by bucket. */
const PROJECT_DAYS: Record<ChartBucket, number> = { day: 14, week: 28, month: 60 };

export interface ChartLine {
  /** Row key for the series' values (avg and trend use `${key}~avg`, `${key}~trend`). */
  key: string;
  metric: MetricDto;
  color: string;
  /** Y axis id: one per unit, so different units don't share a scale. */
  axis: string;
}

export interface SeriesStats extends SeriesStatsDto {
  metric: MetricDto;
  color: string;
}

export interface ChartModel {
  rows: Record<string, number | string | null>[];
  lines: ChartLine[];
  axes: { id: string; unit: string }[];
  stats: SeriesStats[];
  /** Between the first two series, over the buckets both have. */
  correlation: { r: number; n: number; a: MetricDto; b: MetricDto } | null;
}

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
    if (config.trend) {
      for (const p of linearTrend(points, PROJECT_DAYS[config.bucket])?.line ?? []) {
        row(p.date)[`${key}~trend`] = p.value;
      }
    }
    stats.push({ metric: s.metric, color, ...seriesStats(points, s.metric.kind, config.bucket) });
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

/** Route params for the chart explorer (mirrors the web's /charts?m=… links). */
export function chartParams(
  ids: string[],
  config: Partial<ChartConfig> = {},
): Record<string, string> {
  const params: Record<string, string> = { m: ids.join(",") };
  if (config.range) params.range = config.range;
  if (config.bucket) params.bucket = config.bucket;
  if (config.style) params.style = config.style;
  if (config.trend) params.trend = "1";
  if (config.average) params.avg = "1";
  return params;
}
