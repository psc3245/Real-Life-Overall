import {
  CHART_BUCKETS,
  CHART_STYLES,
  MAX_CHART_METRICS,
  MAX_REPORT_CHARTS,
  REPORT_RANGE_LABELS,
  REPORT_RANGES,
  type ChartBucket,
  type ChartStyle,
  type MetricDto,
  type ReportChartDto,
  type ReportDto,
  type ReportOptions,
  type ReportRange,
} from "@rlo/shared";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useChartViews, useMetrics } from "../../api/metrics";
import { useCreateReport, useReport, useUpdateReport, type ReportInput } from "../../api/reports";
import { Button } from "../../components/Button";
import { compactFieldClass } from "../../components/form";
import { Modal } from "../../components/Modal";
import { MetricPicker } from "../charts/MetricPicker";
import { ErrorNote } from "../onboarding/ErrorNote";
import { ReportOptionsFields } from "./ReportOptionsFields";

type Preset = Exclude<ReportRange, "custom">;
const PRESETS = REPORT_RANGES.filter((r): r is Preset => r !== "custom");

/** /reports/new and /reports/:id/edit. */
export function ReportEditorPage() {
  const { id } = useParams();
  const report = useReport(id ?? "");
  if (!id) return <ReportForm />;
  if (report.isPending) return <p className="pt-10 text-court-500">Loading…</p>;
  if (report.isError) return <ErrorNote error={report.error} />;
  return <ReportForm report={report.data} />;
}

const chip = (active: boolean) =>
  `rounded-full border px-2.5 py-0.5 text-[11px] uppercase tracking-wider ${active ? "border-neon bg-neon/10 text-neon" : "border-court-700 text-court-300 hover:border-court-500"}`;

function ReportForm({ report }: { report?: ReportDto }) {
  const metrics = useMetrics();
  const create = useCreateReport();
  const update = useUpdateReport();
  const navigate = useNavigate();
  const [name, setName] = useState(report?.name ?? "");
  const [description, setDescription] = useState(report?.description ?? "");
  const [defaultRange, setDefaultRange] = useState<Preset>(report?.defaultRange ?? "30d");
  const [options, setOptions] = useState<ReportOptions>(
    report?.options ?? { summaries: true, writeUp: true, suggestions: true },
  );
  const [charts, setCharts] = useState<ReportChartDto[]>(report?.charts ?? []);
  /** "new" or the index of the chart whose metrics are being edited. */
  const [picking, setPicking] = useState<"new" | number | null>(null);
  const byId = new Map((metrics.data ?? []).map((m) => [m.id, m]));
  const saving = create.isPending || update.isPending;

  const setChart = (i: number, changes: Partial<ReportChartDto>) =>
    setCharts((cs) => cs.map((c, j) => (j === i ? { ...c, ...changes } : c)));
  const move = (i: number, delta: -1 | 1) =>
    setCharts((cs) => {
      const next = [...cs];
      const [item] = next.splice(i, 1);
      next.splice(i + delta, 0, item!);
      return next;
    });

  const submit = () => {
    const input: ReportInput = { name: name.trim(), description, defaultRange, options, charts };
    const done = { onSuccess: (r: ReportDto) => navigate(`/reports/${r.id}`) };
    if (report) update.mutate({ id: report.id, ...input }, done);
    else create.mutate(input, done);
  };

  return (
    <form
      aria-label={report ? "Edit report" : "New report"}
      className="space-y-8 pt-4"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div>
        <Link
          to={report ? `/reports/${report.id}` : "/reports"}
          className="text-sm text-court-300 hover:text-neon"
        >
          ← {report ? report.name : "Reports"}
        </Link>
        <p className="text-sm uppercase tracking-[0.3em] text-neon">
          {report ? "Edit report" : "New report"}
        </p>
        <input
          aria-label="Report name"
          value={name}
          required
          maxLength={80}
          autoFocus={!report}
          placeholder="Monthly training review"
          onChange={(e) => setName(e.target.value)}
          className="w-full bg-transparent font-display text-4xl font-bold uppercase outline-none placeholder:text-court-700 focus:text-neon"
        />
        <input
          aria-label="Description"
          value={description}
          maxLength={500}
          placeholder="What this report is for (optional)"
          onChange={(e) => setDescription(e.target.value)}
          className={`${compactFieldClass} mt-2 w-full`}
        />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <section className="space-y-2">
          <h2 className="font-display text-lg uppercase tracking-wider">Include</h2>
          <ReportOptionsFields value={options} onChange={setOptions} />
        </section>
        <section className="space-y-2">
          <h2 className="font-display text-lg uppercase tracking-wider">Default period</h2>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((r) => (
              <button
                key={r}
                type="button"
                aria-pressed={defaultRange === r}
                onClick={() => setDefaultRange(r)}
                className={`rounded-lg border px-3 py-2 text-sm ${defaultRange === r ? "border-neon bg-neon/10 text-neon" : "border-court-700 text-court-300 hover:border-court-500"}`}
              >
                {REPORT_RANGE_LABELS[r]}
              </button>
            ))}
          </div>
          <p className="text-sm text-court-500">
            Each run can pick another period, including custom dates.
          </p>
        </section>
      </div>

      <section className="space-y-3">
        <h2 className="font-display text-lg uppercase tracking-wider">
          Charts{" "}
          <span className="text-court-500">
            {charts.length}/{MAX_REPORT_CHARTS}
          </span>
        </h2>
        {charts.map((c, i) => (
          <ChartRow
            key={i}
            chart={c}
            byId={byId}
            first={i === 0}
            last={i === charts.length - 1}
            onChange={(changes) => setChart(i, changes)}
            onRemove={() => setCharts((cs) => cs.filter((_, j) => j !== i))}
            onMove={(d) => move(i, d)}
            onEditMetrics={() => setPicking(i)}
          />
        ))}
        <button
          type="button"
          disabled={charts.length >= MAX_REPORT_CHARTS}
          onClick={() => setPicking("new")}
          className="w-full rounded-xl border border-neon/50 py-3 font-display uppercase tracking-wider text-neon hover:bg-neon/10 disabled:opacity-40"
        >
          + Add chart
        </button>
      </section>

      <ErrorNote error={create.error ?? update.error} />
      <div className="flex justify-end gap-2">
        <Button
          variant="ghost"
          onClick={() => navigate(report ? `/reports/${report.id}` : "/reports")}
        >
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabled={!name.trim() || !charts.length || saving}>
          {saving ? "Saving…" : "Save report"}
        </Button>
      </div>

      <Modal
        open={picking !== null}
        onClose={() => setPicking(null)}
        label="Choose metrics"
        size="lg"
      >
        {picking !== null && (
          <AddChart
            metrics={metrics.data ?? []}
            initial={typeof picking === "number" ? charts[picking]!.metricIds : []}
            editing={typeof picking === "number"}
            onCancel={() => setPicking(null)}
            onDone={(chart) => {
              if (typeof picking === "number") setChart(picking, { metricIds: chart.metricIds });
              else setCharts((cs) => [...cs, chart]);
              setPicking(null);
            }}
          />
        )}
      </Modal>
    </form>
  );
}

function ChartRow({
  chart: c,
  byId,
  first,
  last,
  onChange,
  onRemove,
  onMove,
  onEditMetrics,
}: {
  chart: ReportChartDto;
  byId: Map<string, MetricDto>;
  first: boolean;
  last: boolean;
  onChange: (changes: Partial<ReportChartDto>) => void;
  onRemove: () => void;
  onMove: (delta: -1 | 1) => void;
  onEditMetrics: () => void;
}) {
  const names = c.metricIds.map((id) => byId.get(id)?.label ?? "Unavailable");
  return (
    <div className="space-y-3 rounded-xl border border-court-700 bg-court-900/70 p-4">
      <div className="flex items-center gap-2">
        <input
          aria-label="Chart title"
          value={c.title}
          maxLength={80}
          placeholder={names.join(" vs ")}
          onChange={(e) => onChange({ title: e.target.value })}
          className={`${compactFieldClass} min-w-0 flex-1`}
        />
        <div className="flex shrink-0 text-court-500">
          <button
            type="button"
            aria-label="Move chart up"
            disabled={first}
            onClick={() => onMove(-1)}
            className="px-1.5 hover:text-neon disabled:opacity-30"
          >
            ↑
          </button>
          <button
            type="button"
            aria-label="Move chart down"
            disabled={last}
            onClick={() => onMove(1)}
            className="px-1.5 hover:text-neon disabled:opacity-30"
          >
            ↓
          </button>
          <button
            type="button"
            aria-label="Remove chart"
            onClick={onRemove}
            className="px-1.5 hover:text-flare"
          >
            ✕
          </button>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {names.map((n, i) => (
          <span
            key={c.metricIds[i]}
            className="rounded bg-court-800 px-2 py-0.5 text-xs text-court-300"
          >
            {n}
          </span>
        ))}
        <button type="button" onClick={onEditMetrics} className="text-xs text-neon hover:underline">
          Change
        </button>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        <div className="flex gap-1">
          {CHART_BUCKETS.map((b: ChartBucket) => (
            <button
              key={b}
              type="button"
              className={chip(c.bucket === b)}
              onClick={() => onChange({ bucket: b })}
            >
              {b === "day" ? "Daily" : b === "week" ? "Weekly" : "Monthly"}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          {CHART_STYLES.map((s: ChartStyle) => (
            <button
              key={s}
              type="button"
              className={chip(c.style === s)}
              onClick={() => onChange({ style: s })}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          <button
            type="button"
            aria-pressed={c.average}
            className={chip(c.average)}
            onClick={() => onChange({ average: !c.average })}
          >
            Average
          </button>
          <button
            type="button"
            aria-pressed={c.trend}
            className={chip(c.trend)}
            onClick={() => onChange({ trend: !c.trend })}
          >
            Trend
          </button>
        </div>
      </div>
    </div>
  );
}

/** Pick metrics for a chart, or copy one of the saved charts. */
function AddChart({
  metrics,
  initial,
  editing,
  onCancel,
  onDone,
}: {
  metrics: MetricDto[];
  initial: string[];
  editing: boolean;
  onCancel: () => void;
  onDone: (chart: ReportChartDto) => void;
}) {
  const views = useChartViews();
  const [ids, setIds] = useState(initial);
  const saved = !editing && (views.data?.length ?? 0) > 0;
  return (
    <div className="flex max-h-[80dvh] flex-col gap-3">
      <h2 className="font-display text-xl uppercase tracking-wider">
        {editing ? "Change metrics" : "Add a chart"}
      </h2>
      {saved && (
        <div className="space-y-1">
          <p className="text-[11px] uppercase tracking-wider text-court-500">
            From your saved charts
          </p>
          <div className="flex flex-wrap gap-1.5">
            {views.data!.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() =>
                  onDone({
                    title: v.name,
                    metricIds: v.metricIds,
                    bucket: v.bucket,
                    style: v.style,
                    average: v.average,
                    trend: v.trend,
                  })
                }
                className="rounded-full border border-court-700 px-3 py-1 text-sm hover:border-neon hover:text-neon"
              >
                {v.name}
              </button>
            ))}
          </div>
          <p className="pt-2 text-[11px] uppercase tracking-wider text-court-500">
            Or pick metrics
          </p>
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <MetricPicker
          metrics={metrics}
          selected={ids}
          loading={false}
          onToggle={(id) =>
            setIds((prev) =>
              prev.includes(id)
                ? prev.filter((x) => x !== id)
                : [...prev, id].slice(0, MAX_CHART_METRICS),
            )
          }
        />
      </div>
      <div className="flex justify-end gap-2 border-t border-court-800 pt-3">
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          variant="primary"
          disabled={!ids.length}
          onClick={() =>
            onDone({
              title: "",
              metricIds: ids,
              bucket: "day",
              style: "line",
              average: false,
              trend: false,
            })
          }
        >
          {editing ? "Use these" : `Add chart (${ids.length})`}
        </Button>
      </div>
    </div>
  );
}
