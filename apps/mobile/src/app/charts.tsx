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
  type ChartViewDto,
} from "@rlo/shared";
import { router, useLocalSearchParams } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useDay } from "@/api/days";
import { useMe } from "@/api/hooks";
import {
  useChartViews,
  useDeleteChartView,
  useMetrics,
  useMetricSeries,
  useSaveChartView,
  useUpdateChartView,
} from "@/api/metrics";
import { fmtChart, MetricChart } from "@/components/charts/MetricChart";
import { Chip } from "@/components/controls";
import { MetricPicker } from "@/components/MetricPicker";
import { Button, Card, ErrorNote, Field, Label, Muted, Screen } from "@/components/ui";
import { buildChart, chartParams, type SeriesStats } from "@/lib/chartModel";
import { colors, space, tierColor } from "@/lib/theme";
import { FeatureGate } from "@/components/FeatureGate";

const pick = <T extends string>(
  value: string | undefined,
  options: readonly T[],
  fallback: T,
): T => (options.includes(value as T) ? (value as T) : fallback);

type Params = {
  m?: string;
  range?: string;
  bucket?: string;
  style?: string;
  avg?: string;
  trend?: string;
  view?: string;
};

/** The chart config lives in the route params (same keys as the web's URL), so links can open a chart. */
function useChartConfig(): [ChartConfig, (next: Partial<ChartConfig>) => void, string | null] {
  const params = useLocalSearchParams<Params>();
  const config: ChartConfig = {
    metricIds: (params.m ?? "").split(",").filter(Boolean).slice(0, MAX_CHART_METRICS),
    range: pick(params.range, CHART_RANGES, "90d"),
    bucket: pick(params.bucket, CHART_BUCKETS, "day"),
    style: pick(params.style, CHART_STYLES, "line"),
    average: params.avg === "1",
    trend: params.trend === "1",
  };
  const set = (next: Partial<ChartConfig>) => {
    const merged = { ...config, ...next };
    router.setParams({
      m: "",
      range: "",
      bucket: "",
      style: "",
      avg: "",
      trend: "",
      ...chartParams(merged.metricIds, merged),
    });
  };
  return [config, set, params.view || null];
}

/** Pick any metrics, chart them together, model the trend, and save the view. */
function ChartsScreen() {
  const [config, set, viewId] = useChartConfig();
  const metrics = useMetrics();
  const me = useMe();
  const today = useDay(null).data?.today ?? null;
  const [picking, setPicking] = useState(false);
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
  const byId = new Map((metrics.data ?? []).map((m) => [m.id, m]));

  const toggle = (id: string) =>
    set({
      metricIds: config.metricIds.includes(id)
        ? config.metricIds.filter((x) => x !== id)
        : [...config.metricIds, id].slice(0, MAX_CHART_METRICS),
    });

  return (
    <Screen
      eyebrow="Everything you track"
      title="Charts"
      onRefresh={() => Promise.all([series.refetch(), metrics.refetch()])}
    >
      <View style={styles.wrap}>
        {config.metricIds.map((id) => (
          <Chip
            key={id}
            label={`${byId.get(id)?.label ?? "…"}  ✕`}
            selected
            onPress={() => toggle(id)}
          />
        ))}
        <Chip
          label={config.metricIds.length ? "+ Metric" : "+ Pick metrics"}
          selected={false}
          disabled={config.metricIds.length >= MAX_CHART_METRICS}
          onPress={() => setPicking(true)}
        />
      </View>
      <ErrorNote error={metrics.error} />

      <Card>
        {config.metricIds.length === 0 ? (
          <Muted style={{ textAlign: "center", paddingVertical: space.xxl }}>
            Pick up to {MAX_CHART_METRICS} things to chart: ratings, habits, goals, workouts,
            exercises, body or journal.
          </Muted>
        ) : series.isPending ? (
          <Muted style={{ textAlign: "center", paddingVertical: space.xxl }}>Loading…</Muted>
        ) : series.data && model ? (
          <View style={{ opacity: series.isFetching ? 0.6 : 1 }}>
            <MetricChart
              series={series.data.series}
              config={config}
              weekStart={weekStart}
              model={model}
            />
          </View>
        ) : null}
        <ErrorNote error={series.error} />
      </Card>

      <Controls config={config} set={set} />

      {model && model.stats.length > 0 && <Stats stats={model.stats} bucket={config.bucket} />}
      {model?.correlation && (
        <Card>
          <Muted>
            <Text style={{ color: colors.court100 }}>{model.correlation.a.label}</Text> and{" "}
            <Text style={{ color: colors.court100 }}>{model.correlation.b.label}</Text>:{" "}
            {describeCorrelation(model.correlation.r)} (r = {model.correlation.r.toFixed(2)} over{" "}
            {model.correlation.n} {config.bucket}s). Correlation isn&apos;t cause, but it&apos;s a
            clue.
          </Muted>
        </Card>
      )}

      <SavedViews config={config} viewId={viewId} />
      <Pressable onPress={() => router.push("/reports")} hitSlop={6}>
        <Text style={{ color: colors.court300, fontSize: 14 }}>
          Reports: run sets of charts with write-ups →
        </Text>
      </Pressable>

      <MetricPicker
        open={picking}
        metrics={metrics.data ?? []}
        selected={config.metricIds}
        onToggle={toggle}
        onClose={() => setPicking(false)}
      />
    </Screen>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: space.xs }}>
      <Label>{label}</Label>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {children}
      </ScrollView>
    </View>
  );
}

function Controls({
  config,
  set,
}: {
  config: ChartConfig;
  set: (c: Partial<ChartConfig>) => void;
}) {
  return (
    <View style={{ gap: space.md }}>
      <Row label="Range">
        {CHART_RANGES.map((r) => (
          <Chip
            key={r}
            label={CHART_RANGE_LABELS[r]}
            selected={config.range === r}
            onPress={() => set({ range: r })}
          />
        ))}
      </Row>
      <Row label="Group by">
        {CHART_BUCKETS.map((b) => (
          <Chip
            key={b}
            label={b === "day" ? "Daily" : b === "week" ? "Weekly" : "Monthly"}
            selected={config.bucket === b}
            onPress={() => set({ bucket: b })}
          />
        ))}
      </Row>
      <Row label="Style">
        {CHART_STYLES.map((s) => (
          <Chip
            key={s}
            label={s[0]!.toUpperCase() + s.slice(1)}
            selected={config.style === s}
            onPress={() => set({ style: s })}
          />
        ))}
        <Chip
          label="7-pt average"
          selected={config.average}
          onPress={() => set({ average: !config.average })}
        />
        <Chip
          label="Trend + projection"
          selected={config.trend}
          onPress={() => set({ trend: !config.trend })}
        />
      </Row>
    </View>
  );
}

const fmt = (n: number | null, unit = "") =>
  n === null ? "—" : `${fmtChart(n)}${unit ? ` ${unit}` : ""}`;

function Stats({ stats, bucket }: { stats: SeriesStats[]; bucket: ChartBucket }) {
  return (
    <View style={{ gap: space.sm }}>
      {stats.map((s) => (
        <Card key={s.metric.id} style={{ gap: space.xs }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
            <View style={[styles.swatch, { backgroundColor: s.color }]} />
            <Text style={{ color: colors.court100, fontSize: 15, fontWeight: "600", flex: 1 }}>
              {s.metric.label}
            </Text>
          </View>
          <View style={styles.statGrid}>
            <Stat label="Latest" value={fmt(s.latest, s.metric.unit)} />
            <Stat label="Avg" value={fmt(s.mean)} />
            <Stat label="Min–max" value={`${fmt(s.min)}–${fmt(s.max)}`} />
            <Stat
              label={s.total !== null ? "Total" : "Change"}
              value={
                s.total !== null
                  ? fmt(s.total, s.metric.unit)
                  : s.change !== null
                    ? `${s.change > 0 ? "+" : ""}${fmt(s.change)}`
                    : "—"
              }
            />
            <Stat
              label={`Trend / ${bucket}`}
              value={s.slope === null ? "—" : `${s.slope > 0 ? "+" : ""}${fmt(s.slope)}`}
              color={
                s.slope === null || s.slope === 0
                  ? undefined
                  : s.slope > 0
                    ? tierColor(85)
                    : colors.flare
              }
              detail={s.r2 !== null ? `r² ${s.r2}` : undefined}
            />
          </View>
        </Card>
      ))}
    </View>
  );
}

function Stat({
  label,
  value,
  color,
  detail,
}: {
  label: string;
  value: string;
  color?: string;
  detail?: string;
}) {
  return (
    <View style={{ minWidth: "30%", flexGrow: 1 }}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text
        style={{ color: color ?? colors.court100, fontSize: 15, fontVariant: ["tabular-nums"] }}
      >
        {value}
        {detail ? <Text style={{ color: colors.court500, fontSize: 11 }}> {detail}</Text> : null}
      </Text>
    </View>
  );
}

function SavedViews({ config, viewId }: { config: ChartConfig; viewId: string | null }) {
  const views = useChartViews();
  const save = useSaveChartView();
  const update = useUpdateChartView();
  const remove = useDeleteChartView();
  const [name, setName] = useState("");
  const current = views.data?.find((v) => v.id === viewId);
  const open = (v: ChartViewDto) =>
    router.setParams({
      ...chartParams(v.metricIds, v),
      avg: v.average ? "1" : "",
      trend: v.trend ? "1" : "",
      view: v.id,
    });

  return (
    <View style={{ gap: space.sm }}>
      <Label>Saved charts</Label>
      <Card style={{ padding: 0 }}>
        {views.data?.length === 0 && (
          <Muted style={{ padding: space.lg }}>Save a chart to reopen it or pin it to Today.</Muted>
        )}
        {views.data?.map((v, i) => (
          <View key={v.id} style={[styles.view, i > 0 && styles.border]}>
            <Pressable style={{ flex: 1 }} onPress={() => open(v)}>
              <Text
                numberOfLines={1}
                style={{ color: v.id === viewId ? colors.neon : colors.court100, fontSize: 16 }}
              >
                {v.name}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={v.pinned ? "Unpin from Today" : "Pin to Today"}
              accessibilityState={{ selected: v.pinned }}
              hitSlop={8}
              onPress={() => update.mutate({ id: v.id, pinned: !v.pinned })}
            >
              <SymbolView
                name={v.pinned ? "pin.fill" : "pin"}
                tintColor={v.pinned ? colors.neon : colors.court500}
                size={18}
              />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Delete ${v.name}`}
              hitSlop={8}
              onPress={() =>
                Alert.alert(`Delete "${v.name}"?`, undefined, [
                  { text: "Keep", style: "cancel" },
                  { text: "Delete", style: "destructive", onPress: () => remove.mutate(v.id) },
                ])
              }
            >
              <SymbolView name="trash" tintColor={colors.court500} size={17} />
            </Pressable>
          </View>
        ))}
      </Card>
      {config.metricIds.length > 0 && (
        <View style={{ flexDirection: "row", gap: space.sm }}>
          <Field
            accessibilityLabel="Chart name"
            value={name}
            maxLength={60}
            placeholder="Name this chart"
            onChangeText={setName}
            style={{ flex: 1 }}
          />
          <Button
            title="Save"
            disabled={!name.trim() || save.isPending}
            onPress={() =>
              save.mutate(
                { ...config, name: name.trim() },
                {
                  onSuccess: (v) => {
                    setName("");
                    open(v);
                  },
                },
              )
            }
          />
        </View>
      )}
      {current && (
        <Button
          title={`Update "${current.name}"`}
          variant="ghost"
          disabled={update.isPending}
          onPress={() => update.mutate({ id: current.id, ...config })}
        />
      )}
      <ErrorNote error={save.error ?? update.error ?? remove.error} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: space.xs },
  row: { gap: space.xs },
  swatch: { width: 10, height: 10, borderRadius: 2 },
  statGrid: { flexDirection: "row", flexWrap: "wrap", rowGap: space.sm, columnGap: space.md },
  statLabel: { color: colors.court500, fontSize: 11, letterSpacing: 1, textTransform: "uppercase" },
  view: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.lg,
    paddingHorizontal: space.lg,
    paddingVertical: 12,
  },
  border: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.court800 },
});

export default function GatedChartsScreen() {
  return (
    <FeatureGate feature="charts">
      <ChartsScreen />
    </FeatureGate>
  );
}
