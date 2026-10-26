import { REPORT_RANGE_LABELS } from "@rlo/shared";
import { Link } from "react-router";
import { useReports } from "../../api/reports";
import { DebugJson } from "../../components/debug/Debug";
import { instantDate } from "../../lib/format";
import { ErrorNote } from "../onboarding/ErrorNote";

/** Saved reports: collections of charts you can re-run over any period. */
export function ReportsPage() {
  const reports = useReports();
  return (
    <div className="space-y-6 pt-4">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-neon">Charts, run on demand</p>
          <h1 className="font-display text-4xl font-bold uppercase md:text-5xl">Reports</h1>
        </div>
        <Link
          to="/reports/new"
          className="rounded-lg bg-neon px-4 py-2 font-display text-sm font-semibold uppercase tracking-wider text-court-950 hover:brightness-110"
        >
          + New report
        </Link>
      </header>
      {reports.isPending && <p className="text-court-500">Loading…</p>}
      <ErrorNote error={reports.error} />
      {reports.data?.length === 0 && (
        <div className="rounded-xl border border-dashed border-court-700 p-8 text-center text-court-300">
          <p>No reports yet.</p>
          <p className="mt-1 text-sm text-court-500">
            A report is a set of charts (say training volume, Fitness, weight and your run habit)
            that you can run for any week, month or season, with summaries, a write-up and
            suggestions.
          </p>
        </div>
      )}
      <div className="grid gap-3 md:grid-cols-2">
        {reports.data?.map((r) => (
          <Link
            key={r.id}
            to={`/reports/${r.id}`}
            className="space-y-2 rounded-xl border border-court-700 bg-court-900/70 p-4 hover:border-neon"
          >
            <p className="font-display text-lg uppercase tracking-wide">{r.name}</p>
            {r.description && <p className="text-sm text-court-300">{r.description}</p>}
            <p className="text-xs text-court-500">
              {r.charts.length} chart{r.charts.length === 1 ? "" : "s"} ·{" "}
              {REPORT_RANGE_LABELS[r.defaultRange]}
              {r.options.summaries && " · summaries"}
              {r.options.writeUp && " · write-up"}
              {r.options.suggestions && " · suggestions"}
            </p>
            <p className="text-xs text-court-500">
              {r.lastRun
                ? `Last run ${instantDate(r.lastRun.createdAt)} (${r.lastRun.from} to ${r.lastRun.to})`
                : "Never run"}
            </p>
          </Link>
        ))}
      </div>
      <DebugJson label="reports" data={reports.data} />
    </div>
  );
}
