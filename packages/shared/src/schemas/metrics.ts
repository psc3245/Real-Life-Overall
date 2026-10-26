import { z } from "zod";
import { addDays, dayOfWeek, daysBetween, isValidDate } from "../dates";

/**
 * Charts for everything (DESIGN.md §7.7). Any number the app tracks is a metric with a stable id:
 *   rating:<nodeId>  habit:<habitId>  goal:<objectiveId>  exercise:<exerciseId>
 *   workouts:count|volume|duration|sets  body:weight|height  journal:words  habits:done
 * The API turns ids into daily points in the user's units; charts aggregate and model them here.
 */
export const METRIC_GROUPS = [
  "ratings",
  "habits",
  "goals",
  "workouts",
  "exercises",
  "body",
  "journal",
] as const;
export type MetricGroup = (typeof METRIC_GROUPS)[number];
export const METRIC_GROUP_LABELS: Record<MetricGroup, string> = {
  ratings: "Ratings",
  habits: "Habits",
  goals: "Goals",
  workouts: "Workouts",
  exercises: "Exercises",
  body: "Body",
  journal: "Logging",
};

/**
 * level: a value that holds between points (a rating, body weight, a goal's running total).
 * amount: a quantity per day (minutes, reps, workouts); days without one are 0.
 * session: sporadic bests (an exercise's top set); days without one have no point.
 */
export const METRIC_KINDS = ["level", "amount", "session"] as const;
export type MetricKind = (typeof METRIC_KINDS)[number];

export interface MetricDto {
  id: string;
  group: MetricGroup;
  label: string;
  unit: string;
  kind: MetricKind;
  /** A reference line (habit goal or limit, goal target, rating goal). */
  target: number | null;
  /** Extra context for the picker, e.g. "Fitness › Cardio". */
  detail: string | null;
}

export interface MetricPointDto {
  date: string;
  value: number;
}

export interface MetricSeriesDto {
  metric: MetricDto;
  points: MetricPointDto[];
}

export interface MetricSeriesResponseDto {
  from: string;
  to: string;
  series: MetricSeriesDto[];
}

export const CHART_RANGES = ["30d", "90d", "season", "year", "all"] as const;
export type ChartRange = (typeof CHART_RANGES)[number];
export const CHART_RANGE_LABELS: Record<ChartRange, string> = {
  "30d": "30 days",
  "90d": "90 days",
  season: "Season",
  year: "Year",
  all: "All time",
};

export const CHART_BUCKETS = ["day", "week", "month"] as const;
export type ChartBucket = (typeof CHART_BUCKETS)[number];

export const CHART_STYLES = ["line", "area", "bar"] as const;
export type ChartStyle = (typeof CHART_STYLES)[number];

export const MAX_CHART_METRICS = 6;

export interface ChartConfig {
  metricIds: string[];
  range: ChartRange;
  bucket: ChartBucket;
  style: ChartStyle;
  /** Overlays: a 7-point moving average and a linear trend projected forward. */
  average: boolean;
  trend: boolean;
}

export interface ChartViewDto extends ChartConfig {
  id: string;
  name: string;
  /** Pinned views also appear on Today. */
  pinned: boolean;
}

export const chartConfigSchema = z.object({
  metricIds: z.array(z.string().min(1).max(80)).min(1).max(MAX_CHART_METRICS),
  range: z.enum(CHART_RANGES).default("90d"),
  bucket: z.enum(CHART_BUCKETS).default("day"),
  style: z.enum(CHART_STYLES).default("line"),
  average: z.boolean().default(false),
  trend: z.boolean().default(false),
});

export const chartViewBodySchema = chartConfigSchema.extend({
  name: z.string().trim().min(1).max(60),
  pinned: z.boolean().default(false),
});

/** Updates without defaults, so a missing field keeps its saved value. */
export const chartViewUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(60),
    pinned: z.boolean(),
    metricIds: z.array(z.string().min(1).max(80)).min(1).max(MAX_CHART_METRICS),
    range: z.enum(CHART_RANGES),
    bucket: z.enum(CHART_BUCKETS),
    style: z.enum(CHART_STYLES),
    average: z.boolean(),
    trend: z.boolean(),
  })
  .partial();

export const metricSeriesQuerySchema = z.object({
  ids: z
    .string()
    .transform((s) => s.split(",").filter(Boolean))
    .pipe(z.array(z.string().max(80)).min(1).max(MAX_CHART_METRICS)),
  from: z.string().refine(isValidDate).optional(),
  to: z.string().refine(isValidDate).optional(),
});

/** The first date a range covers, ending today (`season` and `all` need context). */
export function rangeStart(
  range: ChartRange,
  today: string,
  seasonStart: string,
  earliest: string,
): string {
  switch (range) {
    case "30d":
      return addDays(today, -29);
    case "90d":
      return addDays(today, -89);
    case "season":
      return seasonStart;
    case "year":
      return addDays(today, -364);
    case "all":
      return earliest;
  }
}

/** The first day of the bucket containing `date`. */
export function bucketStart(date: string, bucket: ChartBucket, weekStart: number): string {
  if (bucket === "day") return date;
  if (bucket === "month") return `${date.slice(0, 7)}-01`;
  let d = date;
  while (dayOfWeek(d) !== weekStart) d = addDays(d, -1);
  return d;
}

/**
 * Daily points → one point per bucket: amounts sum, levels keep the bucket's last value, and
 * sessions keep the best.
 */
export function aggregatePoints(
  points: MetricPointDto[],
  bucket: ChartBucket,
  kind: MetricKind,
  weekStart: number,
): MetricPointDto[] {
  if (bucket === "day") return points;
  const out = new Map<string, number>();
  for (const p of [...points].sort((a, b) => a.date.localeCompare(b.date))) {
    const key = bucketStart(p.date, bucket, weekStart);
    const prev = out.get(key);
    if (kind === "amount") out.set(key, (prev ?? 0) + p.value);
    else if (kind === "session")
      out.set(key, prev === undefined ? p.value : Math.max(prev, p.value));
    else out.set(key, p.value);
  }
  return [...out].map(([date, value]) => ({ date, value: round(value) }));
}

const round = (n: number) => Math.round(n * 100) / 100;

/** Trailing mean over the last `window` points. */
export function movingAverage(points: MetricPointDto[], window = 7): MetricPointDto[] {
  return points.map((p, i) => {
    const slice = points.slice(Math.max(0, i - window + 1), i + 1);
    return { date: p.date, value: round(slice.reduce((s, x) => s + x.value, 0) / slice.length) };
  });
}

export interface TrendDto {
  /** Change per day. */
  slope: number;
  /** How well a straight line fits (0-1). */
  r2: number;
  /** The line's value at each input date, then projected `ahead` days past the last one. */
  line: MetricPointDto[];
}

/** Least-squares line through the points (by day number), projected forward. */
export function linearTrend(points: MetricPointDto[], ahead = 0): TrendDto | null {
  if (points.length < 3) return null;
  const origin = points[0]!.date;
  const xs = points.map((p) => daysBetween(origin, p.date));
  const ys = points.map((p) => p.value);
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    sxy += (xs[i]! - mx) * (ys[i]! - my);
    sxx += (xs[i]! - mx) ** 2;
    syy += (ys[i]! - my) ** 2;
  }
  if (sxx === 0) return null;
  const slope = sxy / sxx;
  const intercept = my - slope * mx;
  const at = (x: number) => round(intercept + slope * x);
  const last = xs[n - 1]!;
  const line = points.map((p, i) => ({ date: p.date, value: at(xs[i]!) }));
  if (ahead > 0) line.push({ date: addDays(points[n - 1]!.date, ahead), value: at(last + ahead) });
  return { slope, r2: syy === 0 ? 1 : (sxy * sxy) / (sxx * syy), line };
}

/** Pearson correlation of two series over the dates both have; null with fewer than 3 pairs. */
export function correlation(
  a: MetricPointDto[],
  b: MetricPointDto[],
): { r: number; n: number } | null {
  const bByDate = new Map(b.map((p) => [p.date, p.value]));
  const pairs = a.filter((p) => bByDate.has(p.date)).map((p) => [p.value, bByDate.get(p.date)!]);
  const n = pairs.length;
  if (n < 3) return null;
  const mx = pairs.reduce((s, [x]) => s + x!, 0) / n;
  const my = pairs.reduce((s, [, y]) => s + y!, 0) / n;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (const [x, y] of pairs) {
    sxy += (x! - mx) * (y! - my);
    sxx += (x! - mx) ** 2;
    syy += (y! - my) ** 2;
  }
  if (sxx === 0 || syy === 0) return null;
  return { r: sxy / Math.sqrt(sxx * syy), n };
}

/** "strong positive", "weak negative"… for a correlation coefficient. */
export function describeCorrelation(r: number): string {
  const a = Math.abs(r);
  const strength = a >= 0.7 ? "strong" : a >= 0.4 ? "moderate" : a >= 0.2 ? "weak" : "no clear";
  if (strength === "no clear") return "no clear relationship";
  return `${strength} ${r > 0 ? "positive" : "negative"}`;
}
