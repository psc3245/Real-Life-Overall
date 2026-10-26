import { rangeStart, seasonForDate, type ChartViewDto } from "@rlo/shared";
import { Link } from "react-router";
import { useMe } from "../../api/hooks";
import { useChartViews, useMetricSeries } from "../../api/metrics";
import { MetricChart } from "./MetricChart";
import { chartHref } from "./model";

/** Charts pinned from the explorer, shown on Today. Renders nothing without pins. */
export function PinnedCharts({ today }: { today: string }) {
  const views = useChartViews();
  const pinned = views.data?.filter((v) => v.pinned) ?? [];
  if (!pinned.length) return null;
  return (
    <section className="space-y-3" aria-label="Pinned charts">
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-xl uppercase tracking-wider">Pinned charts</h2>
        <Link to="/charts" className="text-sm text-court-300 hover:text-neon">
          All charts →
        </Link>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {pinned.map((v) => (
          <PinnedChart key={v.id} view={v} today={today} />
        ))}
      </div>
    </section>
  );
}

function PinnedChart({ view, today }: { view: ChartViewDto; today: string }) {
  const me = useMe();
  const from = me.data
    ? rangeStart(view.range, today, seasonForDate(today).startsOn, me.data.createdAt.slice(0, 10))
    : null;
  const series = useMetricSeries(view.metricIds, from);
  return (
    <Link
      to={`${chartHref(view.metricIds, view)}&view=${view.id}`}
      className="block space-y-2 rounded-xl border border-court-700 bg-court-900/70 p-4 hover:border-neon"
    >
      <p className="font-display uppercase tracking-wider">{view.name}</p>
      {series.data ? (
        <MetricChart
          series={series.data.series}
          config={view}
          weekStart={me.data?.weekStart ?? 1}
          height={180}
          compact
        />
      ) : (
        <p className="flex h-[180px] items-center justify-center text-sm text-court-500">
          Loading…
        </p>
      )}
    </Link>
  );
}
