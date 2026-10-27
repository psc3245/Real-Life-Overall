import {
  CHART_BUCKETS,
  CHART_STYLES,
  MAX_CHART_METRICS,
  MAX_REPORT_CHARTS,
  REPORT_RANGE_LABELS,
  REPORT_RANGES,
  type MetricDto,
  type ReportChartDto,
  type ReportDto,
  type ReportOptions,
  type ReportRange,
} from "@rlo/shared";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useState } from "react";
import { ActionSheetIOS, Pressable, StyleSheet, Text, View } from "react-native";
import { useChartViews, useMetrics } from "@/api/metrics";
import { useCreateReport, useReport, useUpdateReport, type ReportInput } from "@/api/reports";
import { Chip, FormRow } from "@/components/controls";
import { MetricPicker } from "@/components/MetricPicker";
import { ReportOptionsRows } from "@/components/ReportOptions";
import { SettingsGroup } from "@/components/settings";
import { Button, Card, ErrorNote, Field, Label, Loading, Muted, Screen } from "@/components/ui";
import { colors, space } from "@/lib/theme";
import { FeatureGate } from "@/components/FeatureGate";

type Preset = Exclude<ReportRange, "custom">;
const PRESETS = REPORT_RANGES.filter((r): r is Preset => r !== "custom");

/** New report (no id) or edit one. */
function ReportEditScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const report = useReport(id ?? "");
  if (!id) return <ReportForm />;
  if (report.isPending) return <Loading />;
  if (report.isError) {
    return (
      <Screen>
        <ErrorNote error={report.error} />
      </Screen>
    );
  }
  return <ReportForm report={report.data} />;
}

function ReportForm({ report }: { report?: ReportDto }) {
  const metrics = useMetrics();
  const views = useChartViews();
  const create = useCreateReport();
  const update = useUpdateReport();
  const [name, setName] = useState(report?.name ?? "");
  const [description, setDescription] = useState(report?.description ?? "");
  const [defaultRange, setDefaultRange] = useState<Preset>(report?.defaultRange ?? "30d");
  const [options, setOptions] = useState<ReportOptions>(
    report?.options ?? { summaries: true, writeUp: true, suggestions: true },
  );
  const [charts, setCharts] = useState<ReportChartDto[]>(report?.charts ?? []);
  /** "new" or the index of the chart whose metrics are being edited. */
  const [picking, setPicking] = useState<"new" | number | null>(null);
  const [ids, setIds] = useState<string[]>([]);
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
  const openPicker = (target: "new" | number) => {
    setIds(typeof target === "number" ? charts[target]!.metricIds : []);
    setPicking(target);
  };
  /** Copy a saved chart, or pick metrics from scratch. */
  const addChart = () => {
    const saved = views.data ?? [];
    if (!saved.length) return openPicker("new");
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: "Add a chart",
        options: ["Pick metrics…", ...saved.map((v) => `Saved: ${v.name}`), "Cancel"],
        cancelButtonIndex: saved.length + 1,
        userInterfaceStyle: "dark",
      },
      (i) => {
        if (i === 0) openPicker("new");
        else if (i <= saved.length) {
          const v = saved[i - 1]!;
          setCharts((cs) => [
            ...cs,
            {
              title: v.name,
              metricIds: v.metricIds,
              bucket: v.bucket,
              style: v.style,
              average: v.average,
              trend: v.trend,
            },
          ]);
        }
      },
    );
  };

  const submit = () => {
    const input: ReportInput = { name: name.trim(), description, defaultRange, options, charts };
    const done = {
      onSuccess: (r: ReportDto) =>
        report
          ? router.back()
          : router.replace({ pathname: "/reports/[id]", params: { id: r.id } }),
    };
    if (report) update.mutate({ id: report.id, ...input }, done);
    else create.mutate(input, done);
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: report ? "Edit report" : "New report" }} />
      <FormRow label="Name">
        <Field
          value={name}
          maxLength={80}
          autoFocus={!report}
          placeholder="Monthly training review"
          onChangeText={setName}
        />
      </FormRow>
      <FormRow label="Description">
        <Field
          value={description}
          maxLength={500}
          placeholder="What this report is for (optional)"
          onChangeText={setDescription}
        />
      </FormRow>

      <SettingsGroup title="Include">
        <ReportOptionsRows value={options} onChange={setOptions} />
      </SettingsGroup>

      <FormRow label="Default period">
        <View style={styles.wrap}>
          {PRESETS.map((r) => (
            <Chip
              key={r}
              label={REPORT_RANGE_LABELS[r]}
              selected={defaultRange === r}
              onPress={() => setDefaultRange(r)}
            />
          ))}
        </View>
        <Muted style={{ fontSize: 13 }}>
          Each run can pick another period, including custom dates.
        </Muted>
      </FormRow>

      <Label>
        Charts {charts.length}/{MAX_REPORT_CHARTS}
      </Label>
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
          onEditMetrics={() => openPicker(i)}
        />
      ))}
      <Button
        title="+ Add chart"
        variant="ghost"
        disabled={charts.length >= MAX_REPORT_CHARTS}
        onPress={addChart}
      />

      <ErrorNote error={create.error ?? update.error} />
      <Button
        title={saving ? "Saving…" : "Save report"}
        disabled={!name.trim() || !charts.length || saving}
        onPress={submit}
      />
      <Button title="Cancel" variant="ghost" onPress={() => router.back()} />

      <MetricPicker
        open={picking !== null}
        metrics={metrics.data ?? []}
        selected={ids}
        onToggle={(id) =>
          setIds((prev) =>
            prev.includes(id)
              ? prev.filter((x) => x !== id)
              : [...prev, id].slice(0, MAX_CHART_METRICS),
          )
        }
        onClose={() => setPicking(null)}
        done={{
          label: typeof picking === "number" ? "Use" : "Add",
          disabled: !ids.length,
          onPress: () => {
            if (typeof picking === "number") setChart(picking, { metricIds: ids });
            else
              setCharts((cs) => [
                ...cs,
                {
                  title: "",
                  metricIds: ids,
                  bucket: "day",
                  style: "line",
                  average: false,
                  trend: false,
                },
              ]);
            setPicking(null);
          },
        }}
      />
    </Screen>
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
  const menu = () => {
    const actions = [
      { label: "Change metrics", run: onEditMetrics },
      ...(first ? [] : [{ label: "Move up", run: () => onMove(-1) }]),
      ...(last ? [] : [{ label: "Move down", run: () => onMove(1) }]),
      { label: "Remove chart", run: onRemove },
    ];
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options: [...actions.map((a) => a.label), "Cancel"],
        destructiveButtonIndex: actions.length - 1,
        cancelButtonIndex: actions.length,
        userInterfaceStyle: "dark",
      },
      (i) => actions[i]?.run(),
    );
  };
  return (
    <Card style={{ gap: space.sm }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
        <Field
          accessibilityLabel="Chart title"
          value={c.title}
          maxLength={80}
          placeholder={names.join(" vs ")}
          onChangeText={(title) => onChange({ title })}
          style={{ flex: 1 }}
        />
        <Pressable onPress={menu} hitSlop={8} accessibilityLabel="Chart options">
          <SymbolView name="ellipsis.circle" tintColor={colors.court300} size={22} />
        </Pressable>
      </View>
      <Pressable onPress={onEditMetrics} style={styles.wrap}>
        {names.map((n, i) => (
          <Text key={c.metricIds[i]} style={styles.metric}>
            {n}
          </Text>
        ))}
      </Pressable>
      <View style={styles.wrap}>
        {CHART_BUCKETS.map((b) => (
          <Chip
            key={b}
            label={b === "day" ? "Daily" : b === "week" ? "Weekly" : "Monthly"}
            selected={c.bucket === b}
            onPress={() => onChange({ bucket: b })}
          />
        ))}
      </View>
      <View style={styles.wrap}>
        {CHART_STYLES.map((s) => (
          <Chip
            key={s}
            label={s[0]!.toUpperCase() + s.slice(1)}
            selected={c.style === s}
            onPress={() => onChange({ style: s })}
          />
        ))}
        <Chip
          label="Average"
          selected={c.average}
          onPress={() => onChange({ average: !c.average })}
        />
        <Chip label="Trend" selected={c.trend} onPress={() => onChange({ trend: !c.trend })} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: space.xs },
  metric: {
    color: colors.court300,
    backgroundColor: colors.court800,
    borderRadius: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    fontSize: 13,
    overflow: "hidden",
  },
});

export default function GatedReportEditScreen() {
  return (
    <FeatureGate feature="reports">
      <ReportEditScreen />
    </FeatureGate>
  );
}
