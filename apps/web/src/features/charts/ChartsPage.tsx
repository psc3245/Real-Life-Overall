import {
  CHART_BUCKETS,
  CHART_RANGE_LABELS,
  CHART_RANGES,
  CHART_STYLES,
  describeCorrelation,
  MAX_CHART_METRICS,
  rangeStart,
  seasonForDate,
  type ChartBucket,
  type ChartConfig,
  type ChartRange,
  type ChartStyle,
  type ChartViewDto,
} from "@rlo/shared";
import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import { useDay } from "../../api/days";
import { useMe } from "../../api/hooks";
import {
  useChartViews,
  useDeleteChartView,
  useMetrics,
  useMetricSeries,
  useSaveChartView,
  useUpdateChartView,
} from "../../api/metrics";
import { Button } from "../../components/Button";
import { DebugJson } from "../../components/debug/Debug";
import { compactFieldClass } from "../../components/form";
import { ErrorNote } from "../onboarding/ErrorNote";
import { MetricChart } from "./MetricChart";
import { MetricPicker } from "./MetricPicker";
import { buildChart, chartHref, type SeriesStats } from "./model";

const pick = <T extends string>(value: string | null, options: readonly T[], fallback: T): T =>
  options.includes(value as T) ? (value as T) : fallback;

/** The chart config lives in the URL, so any page can link to a chart. */
function useChartConfig(): [ChartConfig, (next: Partial<ChartConfig>) => void, string | null] {
  const [params, setParams] = useSearchParams();
  const config: ChartConfig = {
    metricIds: (params.get("m") ?? "").split(",").filter(Boolean).slice(0, MAX_CHART_METRICS),
    range: pick(params.get("range"), CHART_RANGES, "90d"),
    bucket: pick(params.get("bucket"), CHART_BUCKETS, "day"),
    style: pick(params.get("style"), CHART_STYLES, "line"),
    average: params.get("avg") === "1",
    trend: params.get("trend") === "1",
  };
  const set = (next: Partial<ChartConfig>) => {
    const merged = { ...config, ...next };
    const href = chartHref(merged.metricIds, merged);
    const search = new URLSearchParams(href.split("?")[1]);
    const view = params.get("view");
    if (view) search.set("view", view);
    setParams(search, { replace: true });
  };
  return [config, set, params.get("view")];
}

/** Pick any metrics, chart them together, model the trend, and save the view. */
export function ChartsPage() {
  const [config, set, viewId] = useChartConfig();
  const metrics = useMetrics();
  const me = useMe();
  const today = useDay(null).data?.today ?? null;
  const from =
    today && me.data
      ? rangeStart(
          config.range,
          today,
          seasonForDate(today).startsOn,
          me.data.createdAt.slice(0, 10),
        )
      : null;
  const series = useMetricSeries(config.metricIds, from);
  const weekStart = me.data?.weekStart ?? 1;
  const model = series.data ? buildChart(series.data.series, config, weekStart) : null;

  const toggle = (id: string) =>
    set({
      metricIds: config.metricIds.includes(id)
        ? config.metricIds.filter((x) => x !== id)
        : [...config.metricIds, id].slice(0, MAX_CHART_METRICS),
    });

  return (
    <div className="space-y-6 pt-4">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-neon">Everything you track</p>
          <h1 className="font-display text-4xl font-bold uppercase md:text-5xl">Charts</h1>
        </div>
        <Link to="/reports" className="text-sm text-court-300 hover:text-neon">
          Reports: run sets of charts with write-ups →
        </Link>
      </header>

      <div className="grid gap-6 lg:grid-cols-[18rem_1fr]">
        <aside className="space-y-4">
          <SavedViews config={config} viewId={viewId} />
          <MetricPicker
            metrics={metrics.data ?? []}
            selected={config.metricIds}
            onToggle={toggle}
            loading={metrics.isPending}
          />
          <ErrorNote error={metrics.error} />
        </aside>

        <section className="min-w-0 space-y-4">
          <Controls config={config} set={set} />
          <div className="rounded-xl border border-court-700 bg-court-900/70 p-4">
            {config.metricIds.length === 0 ? (
              <p className="flex h-80 items-center justify-center text-center text-court-500">
                Pick up to {MAX_CHART_METRICS} things to chart: ratings, habits, goals, workouts,
                exercises, body or journal.
              </p>
            ) : series.isPending ? (
              <p className="flex h-80 items-center justify-center text-court-500">Loading…</p>
            ) : series.data && model ? (
              <div className={series.isFetching ? "opacity-60 transition" : ""}>
                <MetricChart
                  series={series.data.series}
                  config={config}
                  weekStart={weekStart}
                  model={model}
                />
              </div>
            ) : null}
            <ErrorNote error={series.error} />
          </div>
          {model && model.stats.length > 0 && <Stats stats={model.stats} bucket={config.bucket} />}
          {model?.correlation && (
            <p className="rounded-lg border border-court-700 bg-court-900/40 px-4 py-3 text-sm text-court-300">
              <span className="text-court-100">{model.correlation.a.label}</span> and{" "}
              <span className="text-court-100">{model.correlation.b.label}</span>:{" "}
              {describeCorrelation(model.correlation.r)} (r = {model.correlation.r.toFixed(2)} over{" "}
              {model.correlation.n} {config.bucket}s). Correlation isn't cause, but it's a clue.
            </p>
          )}
          <DebugJson label="series + model" data={{ series: series.data, model }} />
        </section>
      </div>
    </div>
  );
}

function chip(active: boolean) {
  return `rounded-full border px-3 py-1 text-xs uppercase tracking-wider ${active ? "border-neon bg-neon/10 text-neon" : "border-court-700 text-court-300 hover:border-court-500"}`;
}

function Controls({
  config,
  set,
}: {
  config: ChartConfig;
  set: (c: Partial<ChartConfig>) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Range">
        {CHART_RANGES.map((r: ChartRange) => (
          <button
            key={r}
            type="button"
            className={chip(config.range === r)}
            onClick={() => set({ range: r })}
          >
            {CHART_RANGE_LABELS[r]}
          </button>
        ))}
      </div>
      <div className="flex gap-1.5" role="group" aria-label="Group by">
        {CHART_BUCKETS.map((b: ChartBucket) => (
          <button
            key={b}
            type="button"
            className={chip(config.bucket === b)}
            onClick={() => set({ bucket: b })}
          >
            {b === "day" ? "Daily" : b === "week" ? "Weekly" : "Monthly"}
          </button>
        ))}
      </div>
      <div className="flex gap-1.5" role="group" aria-label="Style">
        {CHART_STYLES.map((s: ChartStyle) => (
          <button
            key={s}
            type="button"
            className={chip(config.style === s)}
            onClick={() => set({ style: s })}
          >
            {s}
          </button>
        ))}
      </div>
      <div className="flex gap-1.5" role="group" aria-label="Overlays">
        <button
          type="button"
          aria-pressed={config.average}
          className={chip(config.average)}
          onClick={() => set({ average: !config.average })}
        >
          7-pt average
        </button>
        <button
          type="button"
          aria-pressed={config.trend}
          className={chip(config.trend)}
          onClick={() => set({ trend: !config.trend })}
        >
          Trend + projection
        </button>
      </div>
    </div>
  );
}

const fmt = (n: number | null, unit = "") =>
  n === null
    ? "—"
    : `${Math.abs(n) >= 1000 ? Math.round(n).toLocaleString() : Math.round(n * 100) / 100}${unit ? ` ${unit}` : ""}`;

function Stats({ stats, bucket }: { stats: SeriesStats[]; bucket: ChartBucket }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-court-700 bg-court-900/70">
      <table className="w-full text-sm tabular-nums">
        <thead className="text-left text-[11px] uppercase tracking-wider text-court-500">
          <tr>
            <th className="px-3 py-2 font-semibold">Metric</th>
            <th className="pr-3 text-right font-semibold">Latest</th>
            <th className="pr-3 text-right font-semibold">Avg</th>
            <th className="pr-3 text-right font-semibold">Min–max</th>
            <th className="pr-3 text-right font-semibold">Total / change</th>
            <th className="pr-3 text-right font-semibold">Trend per {bucket}</th>
          </tr>
        </thead>
        <tbody>
          {stats.map((s) => (
            <tr key={s.metric.id} className="border-t border-court-800">
              <td className="px-3 py-1.5">
                <span
                  className="mr-2 inline-block h-2.5 w-2.5 rounded-sm"
                  style={{ background: s.color }}
                />
                {s.metric.label}
              </td>
              <td className="pr-3 text-right">{fmt(s.latest, s.metric.unit)}</td>
              <td className="pr-3 text-right text-court-300">{fmt(s.mean)}</td>
              <td className="pr-3 text-right text-court-300">
                {fmt(s.min)}–{fmt(s.max)}
              </td>
              <td className="pr-3 text-right">
                {s.total !== null
                  ? fmt(s.total, s.metric.unit)
                  : s.change !== null
                    ? `${s.change > 0 ? "+" : ""}${fmt(s.change)}`
                    : "—"}
              </td>
              <td
                className={`pr-3 text-right ${s.slope === null ? "" : s.slope > 0 ? "text-tier-green" : s.slope < 0 ? "text-flare" : ""}`}
                title={s.r2 !== null ? `fit r² = ${s.r2}` : undefined}
              >
                {s.slope === null ? "—" : `${s.slope > 0 ? "+" : ""}${fmt(s.slope)}`}
                {s.r2 !== null && <span className="ml-1 text-[11px] text-court-500">r²{s.r2}</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SavedViews({ config, viewId }: { config: ChartConfig; viewId: string | null }) {
  const views = useChartViews();
  const save = useSaveChartView();
  const update = useUpdateChartView();
  const remove = useDeleteChartView();
  const [, setParams] = useSearchParams();
  const [name, setName] = useState("");
  const current = views.data?.find((v) => v.id === viewId);
  const open = (v: ChartViewDto) => {
    const search = new URLSearchParams(chartHref(v.metricIds, v).split("?")[1]);
    search.set("view", v.id);
    setParams(search);
  };

  return (
    <div className="space-y-3 rounded-xl border border-court-700 bg-court-900/70 p-3">
      <h2 className="font-display text-sm uppercase tracking-wider">Saved charts</h2>
      {views.data?.length === 0 && (
        <p className="text-xs text-court-500">Save a chart to reopen it or pin it to Today.</p>
      )}
      <ul className="space-y-1">
        {views.data?.map((v) => (
          <li key={v.id} className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => open(v)}
              className={`min-w-0 flex-1 truncate rounded px-2 py-1 text-left text-sm ${v.id === viewId ? "bg-neon/10 text-neon" : "hover:bg-court-800"}`}
            >
              {v.name}
            </button>
            <button
              type="button"
              aria-pressed={v.pinned}
              title={v.pinned ? "Pinned to Today" : "Pin to Today"}
              onClick={() => update.mutate({ id: v.id, pinned: !v.pinned })}
              className={`rounded px-1.5 text-sm ${v.pinned ? "text-neon" : "text-court-500 hover:text-court-100"}`}
            >
              {v.pinned ? "★" : "☆"}
            </button>
            <button
              type="button"
              aria-label={`Delete ${v.name}`}
              onClick={() => remove.mutate(v.id)}
              className="rounded px-1.5 text-court-500 hover:text-flare"
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
      {config.metricIds.length > 0 && (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate(
              { ...config, name: name.trim() },
              {
                onSuccess: (v) => {
                  setName("");
                  open(v);
                },
              },
            );
          }}
        >
          <input
            aria-label="Chart name"
            value={name}
            maxLength={60}
            placeholder="Name this chart"
            onChange={(e) => setName(e.target.value)}
            className={`${compactFieldClass} min-w-0 flex-1`}
          />
          <Button
            type="submit"
            variant="primary"
            className="px-3"
            disabled={!name.trim() || save.isPending}
          >
            Save
          </Button>
        </form>
      )}
      {current && (
        <Button
          className="w-full"
          disabled={update.isPending}
          onClick={() => update.mutate({ id: current.id, ...config })}
        >
          Update "{current.name}"
        </Button>
      )}
      <ErrorNote error={save.error ?? update.error ?? remove.error} />
    </div>
  );
}
