import type { HistoryDto, RatedNodeDto } from "@rlo/shared";
import { useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AXIS_TEXT, CATEGORY_COLORS, GRID_COLOR, OVERALL_COLOR } from "./palette";
import { shortDate } from "../../lib/format";

/**
 * Overall over time by default; "Categories" shows each category in its fixed color. With `only`,
 * just that node's line (attribute and category pages).
 */
export function HistoryChart({
  history,
  nodes,
  only,
}: {
  history: HistoryDto;
  nodes: RatedNodeDto[];
  only?: RatedNodeDto;
}) {
  const [view, setView] = useState<"overall" | "categories">("overall");
  const [showTable, setShowTable] = useState(false);
  const root = nodes.find((n) => n.parentId === null);
  const categories = nodes.filter((n) => n.parentId === root?.id);
  const series = only
    ? [{ id: only.id, name: only.name, color: OVERALL_COLOR }]
    : view === "overall"
      ? root
        ? [{ id: root.id, name: "Overall", color: OVERALL_COLOR }]
        : []
      : categories.map((c, i) => ({
          id: c.id,
          name: c.name,
          color: CATEGORY_COLORS[i % CATEGORY_COLORS.length]!,
        }));
  const valuesFor = new Map(history.series.map((s) => [s.nodeId, s.values]));
  type Row = { date: string } & Record<string, number | null | string>;
  const rows: Row[] = history.dates.map((date, i) => ({
    date,
    ...Object.fromEntries(series.map((s) => [s.id, valuesFor.get(s.id)?.[i] ?? null])),
  }));
  const valueAt = (row: Row, id: string) => (row[id] as number | null | undefined) ?? null;
  const all = rows.flatMap((r) => series.map((s) => valueAt(r, s.id)));
  const finite = all.filter((v): v is number => v !== null);
  const lo = Math.max(0, Math.floor(Math.min(...finite, 100) - 3));
  const hi = Math.min(100, Math.ceil(Math.max(...finite, 0) + 3));

  if (history.dates.length < 2) {
    return <p className="text-sm text-court-500">History appears after your first full day.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="History view">
        {(only ? [] : (["overall", "categories"] as const)).map((v) => (
          <button
            key={v}
            type="button"
            aria-pressed={view === v}
            onClick={() => setView(v)}
            className={`rounded-full border px-3 py-1 text-sm capitalize ${view === v ? "border-neon bg-neon/15 text-neon" : "border-court-700 text-court-300 hover:border-court-500"}`}
          >
            {v}
          </button>
        ))}
        <button
          type="button"
          aria-pressed={showTable}
          onClick={() => setShowTable((s) => !s)}
          className="ml-auto text-xs uppercase tracking-wider text-court-500 hover:text-neon"
        >
          {showTable ? "Hide table" : "Show table"}
        </button>
      </div>
      <div className="h-64 w-full">
        <ResponsiveContainer>
          <LineChart data={rows} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
            <CartesianGrid stroke={GRID_COLOR} strokeDasharray="2 4" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={shortDate}
              tick={{ fill: AXIS_TEXT, fontSize: 11 }}
              stroke={GRID_COLOR}
              minTickGap={24}
            />
            <YAxis
              domain={[lo, hi]}
              tick={{ fill: AXIS_TEXT, fontSize: 11 }}
              stroke={GRID_COLOR}
              allowDecimals={false}
            />
            <Tooltip
              labelFormatter={(d) => shortDate(String(d))}
              formatter={(v) => (typeof v === "number" ? v.toFixed(1) : "–")}
              cursor={{ stroke: "var(--color-court-500)" }}
              contentStyle={{
                background: "var(--color-court-900)",
                border: "1px solid var(--color-court-700)",
                borderRadius: 8,
                color: "var(--color-court-100)",
              }}
            />
            {series.length > 1 && (
              <Legend wrapperStyle={{ fontSize: 12, color: "var(--color-court-300)" }} />
            )}
            {series.map((s) => (
              <Line
                key={s.id}
                type="monotone"
                dataKey={s.id}
                name={s.name}
                stroke={s.color}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, stroke: "var(--color-court-900)", strokeWidth: 2 }}
                connectNulls
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      {showTable && (
        <div className="max-h-56 overflow-auto rounded-lg border border-court-800">
          <table className="w-full text-sm tabular-nums">
            <thead className="sticky top-0 bg-court-900 text-left text-xs uppercase tracking-wider text-court-500">
              <tr>
                <th className="px-3 py-1.5">Date</th>
                {series.map((s) => (
                  <th key={s.id} className="px-3 py-1.5 text-right">
                    {s.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...rows].reverse().map((r) => (
                <tr key={r.date} className="border-t border-court-800">
                  <td className="px-3 py-1">{shortDate(r.date)}</td>
                  {series.map((s) => {
                    const v = valueAt(r, s.id);
                    return (
                      <td key={s.id} className="px-3 py-1 text-right">
                        {v === null ? "–" : v.toFixed(1)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
