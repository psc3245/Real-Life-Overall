import type { HistoryDto, RatedNodeDto } from "@rlo/shared";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Line, Path, Text as SvgText } from "react-native-svg";
import { shortDate } from "@/lib/format";
import { colors, space } from "@/lib/theme";
import { Chip } from "../controls";
import { Muted } from "../ui";
import { AXIS_TEXT, CATEGORY_COLORS, GRID_COLOR, OVERALL_COLOR } from "./palette";

const HEIGHT = 220;
const PAD = { top: 10, right: 8, bottom: 22, left: 30 };

/**
 * Overall over time by default; "Categories" shows each category in its fixed color. With `only`,
 * just that node's line. Touch and drag to read values.
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
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState<number | null>(null);
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
  const { dates } = history;

  if (dates.length < 2) return <Muted>History appears after your first full day.</Muted>;

  const finite = series.flatMap((s) =>
    (valuesFor.get(s.id) ?? []).filter((v): v is number => v !== null),
  );
  const lo = Math.max(0, Math.floor(Math.min(...finite, 100) - 3));
  const hi = Math.min(100, Math.ceil(Math.max(...finite, 0) + 3));
  const plotW = Math.max(1, width - PAD.left - PAD.right);
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (i / (dates.length - 1)) * plotW;
  const y = (v: number) => PAD.top + (1 - (v - lo) / Math.max(1, hi - lo)) * plotH;
  const ticks = [lo, Math.round((lo + hi) / 2), hi];

  const path = (values: (number | null)[]) => {
    let d = "";
    values.forEach((v, i) => {
      if (v === null) return;
      d += `${d ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
    });
    return d;
  };

  const pick = (locationX: number) => {
    const i = Math.round(((locationX - PAD.left) / plotW) * (dates.length - 1));
    setActive(Math.min(dates.length - 1, Math.max(0, i)));
  };

  return (
    <View style={{ gap: space.md }}>
      <View style={styles.controls}>
        {!only &&
          (["overall", "categories"] as const).map((v) => (
            <Chip
              key={v}
              label={v === "overall" ? "Overall" : "Categories"}
              selected={view === v}
              onPress={() => setView(v)}
            />
          ))}
        <Pressable onPress={() => setShowTable((s) => !s)} style={{ marginLeft: "auto" }}>
          <Text style={styles.toggle}>{showTable ? "Hide table" : "Show table"}</Text>
        </Pressable>
      </View>

      {active !== null && (
        <View style={styles.readout}>
          <Text style={styles.readoutDate}>{shortDate(dates[active]!)}</Text>
          {series.map((s) => {
            const v = valuesFor.get(s.id)?.[active] ?? null;
            return (
              <Text key={s.id} style={{ color: s.color, fontSize: 13 }}>
                {s.name} {v === null ? "–" : v.toFixed(1)}
              </Text>
            );
          })}
        </View>
      )}

      <View
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={(e) => pick(e.nativeEvent.locationX)}
        onResponderMove={(e) => pick(e.nativeEvent.locationX)}
        onResponderRelease={() => setActive(null)}
        accessible
        accessibilityLabel={`History chart, ${series.map((s) => s.name).join(", ")}`}
      >
        {width > 0 && (
          <Svg width={width} height={HEIGHT}>
            {ticks.map((t) => (
              <Line
                key={t}
                x1={PAD.left}
                x2={width - PAD.right}
                y1={y(t)}
                y2={y(t)}
                stroke={GRID_COLOR}
                strokeDasharray="2 4"
              />
            ))}
            {ticks.map((t) => (
              <SvgText
                key={`l${t}`}
                x={PAD.left - 6}
                y={y(t) + 4}
                fontSize={11}
                fill={AXIS_TEXT}
                textAnchor="end"
              >
                {t}
              </SvgText>
            ))}
            {[0, Math.floor((dates.length - 1) / 2), dates.length - 1].map((i, k) => (
              <SvgText
                key={`d${i}`}
                x={x(i)}
                y={HEIGHT - 6}
                fontSize={11}
                fill={AXIS_TEXT}
                textAnchor={k === 0 ? "start" : k === 2 ? "end" : "middle"}
              >
                {shortDate(dates[i]!)}
              </SvgText>
            ))}
            {series.map((s) => (
              <Path
                key={s.id}
                d={path(valuesFor.get(s.id) ?? [])}
                stroke={s.color}
                strokeWidth={2}
                fill="none"
                strokeLinejoin="round"
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
                {series.map((s) => {
                  const v = valuesFor.get(s.id)?.[active] ?? null;
                  return v === null ? null : (
                    <Circle
                      key={s.id}
                      cx={x(active)}
                      cy={y(v)}
                      r={4}
                      fill={s.color}
                      stroke={colors.court900}
                      strokeWidth={2}
                    />
                  );
                })}
              </>
            )}
          </Svg>
        )}
      </View>

      {series.length > 1 && (
        <View style={styles.legend}>
          {series.map((s) => (
            <View key={s.id} style={styles.legendItem}>
              <View style={[styles.swatch, { backgroundColor: s.color }]} />
              <Text style={styles.legendText}>{s.name}</Text>
            </View>
          ))}
        </View>
      )}

      {showTable && (
        <View style={styles.table}>
          <View style={[styles.tableRow, styles.tableHead]}>
            <Text style={[styles.cell, styles.headText]}>Date</Text>
            {series.map((s) => (
              <Text key={s.id} style={[styles.cell, styles.headText, styles.num]} numberOfLines={1}>
                {s.name}
              </Text>
            ))}
          </View>
          {[...dates.keys()]
            .reverse()
            .slice(0, 60)
            .map((i) => (
              <View key={dates[i]} style={styles.tableRow}>
                <Text style={styles.cell}>{shortDate(dates[i]!)}</Text>
                {series.map((s) => {
                  const v = valuesFor.get(s.id)?.[i] ?? null;
                  return (
                    <Text key={s.id} style={[styles.cell, styles.num]}>
                      {v === null ? "–" : v.toFixed(1)}
                    </Text>
                  );
                })}
              </View>
            ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  controls: { flexDirection: "row", alignItems: "center", gap: space.sm },
  toggle: { color: colors.court500, fontSize: 12, letterSpacing: 1, textTransform: "uppercase" },
  readout: { flexDirection: "row", flexWrap: "wrap", columnGap: space.md, alignItems: "baseline" },
  readoutDate: { color: colors.court100, fontSize: 13, fontWeight: "600" },
  legend: { flexDirection: "row", flexWrap: "wrap", gap: space.md },
  legendItem: { flexDirection: "row", alignItems: "center", gap: space.xs },
  swatch: { width: 10, height: 10, borderRadius: 2 },
  legendText: { color: colors.court300, fontSize: 12 },
  table: { borderWidth: 1, borderColor: colors.court800, borderRadius: 8 },
  tableRow: {
    flexDirection: "row",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.court800,
  },
  tableHead: { borderTopWidth: 0, backgroundColor: colors.court900 },
  cell: {
    flex: 1,
    color: colors.court100,
    fontSize: 13,
    paddingHorizontal: space.sm,
    paddingVertical: 4,
  },
  headText: { color: colors.court500, fontSize: 11, textTransform: "uppercase" },
  num: { textAlign: "right" },
});
