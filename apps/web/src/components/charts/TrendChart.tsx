import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { shortDate } from "../../lib/format";
import { AXIS_TEXT, GRID_COLOR, OVERALL_COLOR } from "./palette";

/** One value over dates (exercise progress, body weight). */
export function TrendChart({
  points,
  label,
  format = (v) => String(v),
}: {
  points: { date: string; value: number }[];
  label: string;
  format?: (value: number) => string;
}) {
  if (points.length < 2) {
    return <p className="text-sm text-court-500">The chart appears after two entries.</p>;
  }
  const values = points.map((p) => p.value);
  const pad = Math.max(1, (Math.max(...values) - Math.min(...values)) * 0.15);
  return (
    <div className="h-56" role="img" aria-label={`${label} over time`}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 8, right: 12, bottom: 0, left: -8 }}>
          <CartesianGrid stroke={GRID_COLOR} strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={shortDate}
            tick={{ fill: AXIS_TEXT, fontSize: 11 }}
            stroke={GRID_COLOR}
            minTickGap={24}
          />
          <YAxis
            domain={[Math.floor(Math.min(...values) - pad), Math.ceil(Math.max(...values) + pad)]}
            tickFormatter={format}
            tick={{ fill: AXIS_TEXT, fontSize: 11 }}
            stroke={GRID_COLOR}
            width={56}
          />
          <Tooltip
            contentStyle={{
              background: "var(--color-court-900)",
              border: "1px solid var(--color-court-700)",
              borderRadius: 8,
            }}
            labelFormatter={(d) => shortDate(String(d))}
            formatter={(v) => [format(Number(v)), label]}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke={OVERALL_COLOR}
            strokeWidth={2}
            dot={{ r: 3, fill: OVERALL_COLOR }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
