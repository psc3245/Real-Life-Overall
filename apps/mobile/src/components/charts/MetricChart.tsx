import type { ChartConfig, MetricSeriesDto } from "@rlo/shared";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Line, Path, Rect, Text as SvgText } from "react-native-svg";
import { buildChart, type ChartModel } from "@/lib/chartModel";
import { shortDate } from "@/lib/format";
import { colors, space } from "@/lib/theme";
import { Muted } from "../ui";
import { AXIS_TEXT, GRID_COLOR } from "./palette";

const PAD = { top: 10, right: 10, bottom: 22, left: 40 };

export const fmtChart = (v: number) =>
  Math.abs(v) >= 1000 ? Math.round(v).toLocaleString() : String(Math.round(v * 100) / 100);

/** Widens lo..hi to two round steps so the three axis ticks read as clean numbers. */
function roundRange(lo: number, hi: number) {
  const raw = (hi - lo) / 2;
  const mag = 10 ** Math.floor(Math.log10(raw));
  for (const m of [1, 2, 2.5, 5, 10, 20]) {
    const step = m * mag;
    const start = Math.floor(lo / step) * step;
    if (start + 2 * step >= hi) return { lo: start, hi: start + 2 * step };
  }
  return { lo, hi };
}

/**
 * Any set of metrics as one chart (the web's MetricChart): a scale per unit, plus optional
 * average and trend lines. Touch and drag to read values.
 */
export function MetricChart({
  series,
  config,
  weekStart,
  height = 240,
  compact = false,
  model: given,
}: {
  series: MetricSeriesDto[];
  config: Pick<ChartConfig, "bucket" | "style" | "average" | "trend">;
  weekStart: number;
  height?: number;
  /** Hides the legend (dashboard cards). */
  compact?: boolean;
  model?: ChartModel;
}) {
  const model = given ?? buildChart(series, config, weekStart);
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState<number | null>(null);
  const rows = model.rows;
  if (rows.length === 0) {
    return (
      <View style={{ height, alignItems: "center", justifyContent: "center" }}>
        <Muted>Nothing logged in this range yet.</Muted>
      </View>
    );
  }

  // One scale per unit axis, padded a little.
  const scales = new Map(
    model.axes.map((a) => {
      const keys = model.lines.filter((l) => l.axis === a.id).map((l) => l.key);
      const values: number[] = [];
      for (const r of rows) {
        for (const k of keys) {
          for (const key of [k, `${k}~avg`, `${k}~trend`]) {
            const v = r[key];
            if (typeof v === "number") values.push(v);
          }
        }
      }
      for (const l of model.lines) {
        if (l.axis === a.id && l.metric.target !== null) values.push(l.metric.target);
      }
      let lo = Math.min(...values);
      let hi = Math.max(...values);
      if (config.style !== "line") lo = Math.min(0, lo);
      const pad = Math.max((hi - lo) * 0.08, hi === lo ? 1 : 0);
      if (config.style === "line") lo -= pad;
      hi += pad;
      return [a.id, roundRange(lo, hi)] as const;
    }),
  );

  const plotW = Math.max(1, width - PAD.left - PAD.right);
  const plotH = height - PAD.top - PAD.bottom;
  const n = rows.length;
  const x = (i: number) => PAD.left + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const y = (axis: string, v: number) => {
    const s = scales.get(axis)!;
    return PAD.top + (1 - (v - s.lo) / Math.max(1e-9, s.hi - s.lo)) * plotH;
  };
  const first = scales.get(model.axes[0]!.id)!;
  const ticks = [first.lo, (first.lo + first.hi) / 2, first.hi];

  const path = (key: string, axis: string) => {
    let d = "";
    rows.forEach((r, i) => {
      const v = r[key];
      if (typeof v !== "number") return;
      d += `${d ? "L" : "M"}${x(i).toFixed(1)},${y(axis, v).toFixed(1)}`;
    });
    return d;
  };
  const barSlot = plotW / Math.max(1, n);
  const barW = Math.max(2, Math.min(18, (barSlot * 0.8) / model.lines.length));

  const pick = (locationX: number) => {
    const i = Math.round(((locationX - PAD.left) / plotW) * (n - 1));
    setActive(Math.min(n - 1, Math.max(0, i)));
  };
  const single = model.lines.length === 1;

  return (
    <View style={{ gap: space.sm }}>
      {active !== null && (
        <View style={styles.readout}>
          <Text style={styles.readoutDate}>{shortDate(String(rows[active]!.date))}</Text>
          {model.lines.map((l) => {
            const v = rows[active]![l.key];
            return (
              <Text key={l.key} style={{ color: l.color, fontSize: 13 }}>
                {single ? "" : `${l.metric.label} `}
                {typeof v === "number" ? `${fmtChart(v)} ${l.metric.unit}` : "–"}
              </Text>
            );
          })}
        </View>
      )}
      <View
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderTerminationRequest={() => false}
        onResponderGrant={(e) => pick(e.nativeEvent.locationX)}
        onResponderMove={(e) => pick(e.nativeEvent.locationX)}
        onResponderRelease={() => setActive(null)}
        accessible
        accessibilityRole="image"
        accessibilityLabel={model.lines.map((l) => l.metric.label).join(", ")}
      >
        {width > 0 && (
          <Svg width={width} height={height}>
            {ticks.map((t, i) => (
              <Line
                key={`g${i}`}
                x1={PAD.left}
                x2={width - PAD.right}
                y1={y(model.axes[0]!.id, t)}
                y2={y(model.axes[0]!.id, t)}
                stroke={GRID_COLOR}
                strokeDasharray="2 4"
              />
            ))}
            {ticks.map((t, i) => (
              <SvgText
                key={`t${i}`}
                x={PAD.left - 6}
                y={y(model.axes[0]!.id, t) + 4}
                fontSize={10}
                fill={AXIS_TEXT}
                textAnchor="end"
              >
                {fmtChart(t)}
              </SvgText>
            ))}
            {(n > 2 ? [0, Math.floor((n - 1) / 2), n - 1] : [...Array(n).keys()]).map(
              (i, k, all) => (
                <SvgText
                  key={`d${i}`}
                  x={x(i)}
                  y={height - 6}
                  fontSize={10}
                  fill={AXIS_TEXT}
                  textAnchor={
                    all.length > 1 && k === 0
                      ? "start"
                      : k === all.length - 1 && all.length > 1
                        ? "end"
                        : "middle"
                  }
                >
                  {shortDate(String(rows[i]!.date))}
                </SvgText>
              ),
            )}
            {model.lines
              .filter((l) => l.metric.target !== null && (single || !compact))
              .map((l) => (
                <Line
                  key={`${l.key}~target`}
                  x1={PAD.left}
                  x2={width - PAD.right}
                  y1={y(l.axis, l.metric.target!)}
                  y2={y(l.axis, l.metric.target!)}
                  stroke={l.color}
                  strokeDasharray="2 4"
                />
              ))}
            {model.lines.map((l, li) => {
              if (config.style === "bar") {
                const s = scales.get(l.axis)!;
                const base = y(l.axis, Math.max(0, s.lo));
                return rows.map((r, i) => {
                  const v = r[l.key];
                  if (typeof v !== "number") return null;
                  const top = y(l.axis, v);
                  const left = x(i) - (barW * model.lines.length) / 2 + li * barW;
                  return (
                    <Rect
                      key={`${l.key}-${i}`}
                      x={left}
                      y={Math.min(top, base)}
                      width={barW - 1}
                      height={Math.max(1, Math.abs(base - top))}
                      rx={2}
                      fill={l.color}
                    />
                  );
                });
              }
              const d = path(l.key, l.axis);
              return (
                <Path
                  key={l.key}
                  d={
                    config.style === "area" && d
                      ? `${d}L${x(lastIndex(rows, l.key)).toFixed(1)},${PAD.top + plotH}L${x(firstIndex(rows, l.key)).toFixed(1)},${PAD.top + plotH}Z`
                      : d
                  }
                  stroke={l.color}
                  strokeWidth={2}
                  fill={config.style === "area" ? l.color : "none"}
                  fillOpacity={config.style === "area" ? 0.15 : 0}
                  strokeLinejoin="round"
                />
              );
            })}
            {config.style === "line" &&
              n <= 40 &&
              model.lines.map((l) =>
                rows.map((r, i) =>
                  typeof r[l.key] === "number" ? (
                    <Circle
                      key={`${l.key}-p${i}`}
                      cx={x(i)}
                      cy={y(l.axis, r[l.key] as number)}
                      r={2.5}
                      fill={l.color}
                    />
                  ) : null,
                ),
              )}
            {config.average &&
              model.lines.map((l) => (
                <Path
                  key={`${l.key}~avg`}
                  d={path(`${l.key}~avg`, l.axis)}
                  stroke={l.color}
                  strokeOpacity={0.6}
                  strokeWidth={1.5}
                  fill="none"
                />
              ))}
            {config.trend &&
              model.lines.map((l) => (
                <Path
                  key={`${l.key}~trend`}
                  d={path(`${l.key}~trend`, l.axis)}
                  stroke={l.color}
                  strokeDasharray="6 4"
                  strokeWidth={1.5}
                  fill="none"
                />
              ))}
            {active !== null && (
              <>
                <Line
                  x1={x(active)}
                  x2={x(active)}
                  y1={PAD.top}
                  y2={PAD.top + plotH}
                  stroke={colors.court500}
                />
                {model.lines.map((l) => {
                  const v = rows[active]![l.key];
                  return typeof v === "number" ? (
                    <Circle
                      key={l.key}
                      cx={x(active)}
                      cy={y(l.axis, v)}
                      r={4}
                      fill={l.color}
                      stroke={colors.court900}
                      strokeWidth={2}
                    />
                  ) : null;
                })}
              </>
            )}
          </Svg>
        )}
      </View>
      {!compact && !single && (
        <View style={styles.legend}>
          {model.lines.map((l) => (
            <View key={l.key} style={styles.legendItem}>
              <View style={[styles.swatch, { backgroundColor: l.color }]} />
              <Text style={styles.legendText}>{l.metric.label}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function firstIndex(rows: ChartModel["rows"], key: string) {
  return Math.max(
    0,
    rows.findIndex((r) => typeof r[key] === "number"),
  );
}

function lastIndex(rows: ChartModel["rows"], key: string) {
  for (let i = rows.length - 1; i >= 0; i--) if (typeof rows[i]![key] === "number") return i;
  return 0;
}

/** One value over dates (exercise progress, body weight). */
export function TrendChart({
  points,
  label,
  unit = "",
}: {
  points: { date: string; value: number }[];
  label: string;
  unit?: string;
}) {
  if (points.length < 2) return <Muted>The chart appears after two entries.</Muted>;
  const series: MetricSeriesDto[] = [
    {
      metric: {
        id: label,
        group: "body",
        label,
        unit,
        kind: "level",
        target: null,
        detail: null,
      },
      points,
    },
  ];
  return (
    <MetricChart
      series={series}
      config={{ bucket: "day", style: "line", average: false, trend: false }}
      weekStart={1}
      height={200}
    />
  );
}

const styles = StyleSheet.create({
  readout: { flexDirection: "row", flexWrap: "wrap", columnGap: space.md, alignItems: "baseline" },
  readoutDate: { color: colors.court100, fontSize: 13, fontWeight: "600" },
  legend: { flexDirection: "row", flexWrap: "wrap", gap: space.md },
  legendItem: { flexDirection: "row", alignItems: "center", gap: space.xs },
  swatch: { width: 10, height: 10, borderRadius: 2 },
  legendText: { color: colors.court300, fontSize: 12 },
});
