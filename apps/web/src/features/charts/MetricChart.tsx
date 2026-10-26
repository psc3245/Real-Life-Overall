import type { ChartConfig, MetricSeriesDto } from "@rlo/shared";
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AXIS_TEXT, GRID_COLOR } from "../../components/charts/palette";
import { shortDate } from "../../lib/format";
import { buildChart, type ChartModel } from "./model";

const fmt = (v: number) =>
  Math.abs(v) >= 1000 ? v.toLocaleString() : String(Math.round(v * 100) / 100);

/** Any set of metrics as one chart: a scale per unit, plus optional average and trend lines. */
export function MetricChart({
  series,
  config,
  weekStart,
  height = 320,
  compact = false,
  model: given,
}: {
  series: MetricSeriesDto[];
  config: Pick<ChartConfig, "bucket" | "style" | "average" | "trend">;
  weekStart: number;
  height?: number;
  /** Hides the legend and the second axis (dashboard cards). */
  compact?: boolean;
  /** Pass a model already built from the same inputs to avoid recomputing it. */
  model?: ChartModel;
}) {
  const model = given ?? buildChart(series, config, weekStart);
  if (model.rows.length === 0) {
    return (
      <p className="flex items-center justify-center text-sm text-court-500" style={{ height }}>
        Nothing logged in this range yet.
      </p>
    );
  }
  const single = model.lines.length === 1;
  const label = (key: string) => model.lines.find((l) => l.key === key.split("~")[0])?.metric;

  return (
    <div
      style={{ height }}
      role="img"
      aria-label={model.lines.map((l) => l.metric.label).join(", ")}
    >
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={model.rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={GRID_COLOR} strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={(d: string) => shortDate(d)}
            tick={{ fill: AXIS_TEXT, fontSize: 11 }}
            stroke={GRID_COLOR}
            minTickGap={28}
          />
          {model.axes.map((a, i) => (
            <YAxis
              key={a.id}
              yAxisId={a.id}
              orientation={i % 2 === 0 ? "left" : "right"}
              hide={i > 1 || (compact && i > 0)}
              tickFormatter={fmt}
              tick={{ fill: AXIS_TEXT, fontSize: 11 }}
              stroke={GRID_COLOR}
              width={48}
              domain={["auto", "auto"]}
              label={
                compact || i > 1
                  ? undefined
                  : {
                      value: a.unit,
                      angle: -90,
                      position: i === 0 ? "insideLeft" : "insideRight",
                      fill: AXIS_TEXT,
                      fontSize: 11,
                    }
              }
            />
          ))}
          <Tooltip
            contentStyle={{
              background: "var(--color-court-900)",
              border: "1px solid var(--color-court-700)",
              borderRadius: 8,
              fontSize: 12,
            }}
            labelFormatter={(d) => shortDate(String(d))}
            formatter={(value, key) => {
              const m = label(String(key));
              const suffix = String(key).includes("~avg")
                ? " (avg)"
                : String(key).includes("~trend")
                  ? " (trend)"
                  : "";
              return [`${fmt(Number(value))} ${m?.unit ?? ""}`, `${m?.label ?? key}${suffix}`];
            }}
          />
          {!compact && !single && (
            <Legend
              formatter={(key: string) => label(key)?.label ?? key}
              wrapperStyle={{ fontSize: 12 }}
            />
          )}
          {model.lines.map((l) => {
            const common = {
              dataKey: l.key,
              yAxisId: l.axis,
              stroke: l.color,
              isAnimationActive: false,
              connectNulls: true,
            };
            if (config.style === "bar") {
              return (
                <Bar key={l.key} {...common} fill={l.color} radius={[3, 3, 0, 0]} maxBarSize={18} />
              );
            }
            if (config.style === "area") {
              return (
                <Area
                  key={l.key}
                  {...common}
                  type="monotone"
                  fill={l.color}
                  fillOpacity={0.15}
                  strokeWidth={2}
                />
              );
            }
            return (
              <Line
                key={l.key}
                {...common}
                type="monotone"
                strokeWidth={2}
                dot={model.rows.length <= 40 ? { r: 2.5, fill: l.color } : false}
              />
            );
          })}
          {config.average &&
            model.lines.map((l) => (
              <Line
                key={`${l.key}~avg`}
                dataKey={`${l.key}~avg`}
                yAxisId={l.axis}
                stroke={l.color}
                strokeOpacity={0.6}
                strokeWidth={1.5}
                dot={false}
                legendType="none"
                isAnimationActive={false}
                connectNulls
              />
            ))}
          {config.trend &&
            model.lines.map((l) => (
              <Line
                key={`${l.key}~trend`}
                dataKey={`${l.key}~trend`}
                yAxisId={l.axis}
                stroke={l.color}
                strokeDasharray="6 4"
                strokeWidth={1.5}
                dot={false}
                legendType="none"
                isAnimationActive={false}
                connectNulls
              />
            ))}
          {model.lines
            .filter((l) => l.metric.target !== null && (single || !compact))
            .map((l) => (
              <ReferenceLine
                key={`${l.key}~target`}
                y={l.metric.target!}
                yAxisId={l.axis}
                stroke={l.color}
                strokeDasharray="2 4"
                label={{
                  value: `target ${fmt(l.metric.target!)}`,
                  fill: AXIS_TEXT,
                  fontSize: 10,
                  position: "insideTopRight",
                }}
              />
            ))}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
