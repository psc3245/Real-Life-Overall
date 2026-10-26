import {
  REPORT_RANGE_LABELS,
  REPORT_RANGES,
  type ReportDto,
  type ReportOptions,
  type ReportRange,
  type ReportRunDto,
} from "@rlo/shared";
import { useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { useMe } from "../../api/hooks";
import {
  useDeleteReport,
  useDeleteReportRun,
  useReport,
  useReportRun,
  useReportRuns,
  useRunReport,
} from "../../api/reports";
import { Button } from "../../components/Button";
import { DebugJson } from "../../components/debug/Debug";
import { compactFieldClass } from "../../components/form";
import { instantDate, shortDate } from "../../lib/format";
import { MetricChart } from "../charts/MetricChart";
import { ErrorNote } from "../onboarding/ErrorNote";
import { ReportOptionsFields } from "./ReportOptionsFields";

/** One report: run it over a period, read the result, and revisit earlier runs. */
export function ReportPage() {
  const { id = "" } = useParams();
  const report = useReport(id);
  if (report.isPending) return <p className="pt-10 text-court-500">Loading…</p>;
  if (report.isError) return <ErrorNote error={report.error} />;
  return <Report key={report.data.id} report={report.data} />;
}

function Report({ report }: { report: ReportDto }) {
  const [params, setParams] = useSearchParams();
  const runs = useReportRuns(report.id);
  const runId = params.get("run") ?? report.lastRun?.id ?? null;
  const run = useReportRun(runId);
  const removeRun = useDeleteReportRun(report.id);
  const remove = useDeleteReport();
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="space-y-6 pt-4">
      <header className="flex flex-wrap items-end justify-between gap-4 print:hidden">
        <div>
          <Link to="/reports" className="text-sm text-court-300 hover:text-neon">
            ← Reports
          </Link>
          <h1 className="font-display text-4xl font-bold uppercase md:text-5xl">{report.name}</h1>
          {report.description && <p className="text-court-300">{report.description}</p>}
        </div>
        <div className="flex items-center gap-2">
          <Link
            to={`/reports/${report.id}/edit`}
            className="text-sm text-court-300 hover:text-neon"
          >
            Edit report
          </Link>
          {confirming ? (
            <span className="flex items-center gap-1 text-sm text-court-300">
              Delete it and every run?
              <Button
                variant="danger"
                disabled={remove.isPending}
                onClick={() => remove.mutate(report.id, { onSuccess: () => navigate("/reports") })}
              >
                Yes, delete
              </Button>
              <Button variant="ghost" onClick={() => setConfirming(false)}>
                Keep
              </Button>
            </span>
          ) : (
            <Button variant="danger" onClick={() => setConfirming(true)}>
              Delete
            </Button>
          )}
        </div>
      </header>

      <RunBar report={report} onRan={(r) => setParams({ run: r.id })} />

      <div className="grid gap-6 lg:grid-cols-[1fr_14rem]">
        <div className="min-w-0">
          {!runId && (
            <p className="rounded-xl border border-dashed border-court-700 p-8 text-center text-court-500">
              Not run yet. Pick a period above and run it.
            </p>
          )}
          {runId && run.isPending && <p className="text-court-500">Loading…</p>}
          <ErrorNote error={run.error} />
          {run.data && <RunView run={run.data} />}
        </div>
        <aside className="space-y-2 print:hidden">
          <h2 className="font-display text-sm uppercase tracking-wider">Runs</h2>
          {runs.data?.length === 0 && <p className="text-xs text-court-500">None yet.</p>}
          <ul className="space-y-1">
            {runs.data?.map((r) => (
              <li key={r.id} className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setParams({ run: r.id })}
                  className={`min-w-0 flex-1 rounded px-2 py-1 text-left text-sm ${r.id === runId ? "bg-neon/10 text-neon" : "hover:bg-court-800"}`}
                >
                  <span className="block">
                    {shortDate(r.from)} – {shortDate(r.to)}
                  </span>
                  <span className="block text-[11px] text-court-500">
                    run {instantDate(r.createdAt)}
                  </span>
                </button>
                <button
                  type="button"
                  aria-label="Delete run"
                  onClick={() =>
                    removeRun.mutate(r.id, {
                      onSuccess: () => r.id === runId && setParams({}),
                    })
                  }
                  className="rounded px-1.5 text-court-500 hover:text-flare"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  );
}

function RunBar({ report, onRan }: { report: ReportDto; onRan: (run: ReportRunDto) => void }) {
  const runReport = useRunReport(report.id);
  const [range, setRange] = useState<ReportRange>(report.defaultRange);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [options, setOptions] = useState<ReportOptions>(report.options);
  const custom = range === "custom";
  const ready = !custom || (from && to && from <= to);
  const ai = options.writeUp || options.suggestions;

  return (
    <section
      aria-label="Run report"
      className="space-y-3 rounded-xl border border-court-700 bg-court-900/70 p-4 print:hidden"
    >
      <div className="flex flex-wrap items-center gap-2">
        <select
          aria-label="Period"
          value={range}
          onChange={(e) => setRange(e.target.value as ReportRange)}
          className={compactFieldClass}
        >
          {REPORT_RANGES.map((r) => (
            <option key={r} value={r}>
              {REPORT_RANGE_LABELS[r]}
            </option>
          ))}
        </select>
        {custom && (
          <>
            <input
              type="date"
              aria-label="From"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className={compactFieldClass}
            />
            <span className="text-court-500">to</span>
            <input
              type="date"
              aria-label="To"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className={compactFieldClass}
            />
          </>
        )}
        <Button
          variant="primary"
          className="ml-auto"
          disabled={!ready || runReport.isPending}
          onClick={() =>
            runReport.mutate({ range, ...(custom && { from, to }), options }, { onSuccess: onRan })
          }
        >
          {runReport.isPending ? (ai ? "Running and writing it up…" : "Running…") : "Run report"}
        </Button>
      </div>
      <ReportOptionsFields value={options} onChange={setOptions} compact />
      <ErrorNote error={runReport.error} />
    </section>
  );
}

/** A run: the period, the AI write-up and suggestions, then every chart with its summaries. */
function RunView({ run }: { run: ReportRunDto }) {
  const me = useMe();
  const weekStart = me.data?.weekStart ?? 1;
  return (
    <article className="space-y-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-neon">{run.reportName}</p>
          <h2 className="font-display text-3xl uppercase">
            {shortDate(run.from)} – {shortDate(run.to)}, {run.to.slice(0, 4)}
          </h2>
          <p className="text-xs text-court-500">Run {new Date(run.createdAt).toLocaleString()}</p>
        </div>
        <Button className="print:hidden" onClick={() => window.print()}>
          Print / PDF
        </Button>
      </div>

      {run.aiError && (
        <p className="rounded-lg border border-tier-orange/40 bg-tier-orange/5 px-3 py-2 text-sm text-tier-orange">
          The write-up couldn't be generated this time ({run.aiError}). The charts and summaries are
          complete; run it again to retry.
        </p>
      )}
      {run.writeUp && (
        <section className="rounded-xl border border-neon/40 bg-court-900 p-5">
          <h3 className="mb-2 font-display text-lg uppercase tracking-wider text-neon">Write-up</h3>
          <p className="leading-relaxed text-court-100">{run.writeUp}</p>
        </section>
      )}
      {run.suggestions && run.suggestions.length > 0 && (
        <section className="rounded-xl border border-court-700 bg-court-900/70 p-5">
          <h3 className="mb-2 font-display text-lg uppercase tracking-wider">Suggestions</h3>
          <ol className="list-decimal space-y-1.5 pl-5 text-court-100">
            {run.suggestions.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
        </section>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        {run.charts.map((c, i) => (
          <section
            key={i}
            className="space-y-3 rounded-xl border border-court-700 bg-court-900/70 p-4 break-inside-avoid"
          >
            <h3 className="font-display text-lg uppercase tracking-wider">{c.chart.title}</h3>
            <MetricChart series={c.series} config={c.chart} weekStart={weekStart} height={240} />
            {c.summaries && (
              <ul className="space-y-1 text-sm text-court-300">
                {c.summaries.map((s, j) => (
                  <li key={j}>{s}</li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
      <DebugJson label="report run" data={run} />
    </article>
  );
}
