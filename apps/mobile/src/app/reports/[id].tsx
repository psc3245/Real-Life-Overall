import {
  REPORT_RANGE_LABELS,
  REPORT_RANGES,
  type ReportDto,
  type ReportOptions,
  type ReportRange,
  type ReportRunDto,
} from "@rlo/shared";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import {
  ActionSheetIOS,
  Alert,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useDay } from "@/api/days";
import { useMe } from "@/api/hooks";
import {
  useDeleteReport,
  useDeleteReportRun,
  useReport,
  useReportRun,
  useReportRuns,
  useRunReport,
} from "@/api/reports";
import { MetricChart } from "@/components/charts/MetricChart";
import { Chip, DateStepper, FormRow } from "@/components/controls";
import { ReportOptionsRows } from "@/components/ReportOptions";
import { SettingsGroup } from "@/components/settings";
import {
  Body,
  Button,
  Card,
  ErrorNote,
  Label,
  Loading,
  Muted,
  Screen,
  Section,
} from "@/components/ui";
import { instantDate, shortDate } from "@/lib/format";
import { colors, fonts, space, tierColor } from "@/lib/theme";
import { FeatureGate } from "@/components/FeatureGate";

/** One report: run it over a period, read the result, and revisit earlier runs. */
function ReportScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const report = useReport(id);
  if (report.isPending) return <Loading />;
  if (report.isError) {
    return (
      <Screen>
        <ErrorNote error={report.error} onRetry={() => void report.refetch()} />
      </Screen>
    );
  }
  return <Report key={report.data.id} report={report.data} />;
}

function Report({ report }: { report: ReportDto }) {
  const [picked, setPicked] = useState<string | null>(null);
  const runs = useReportRuns(report.id);
  const runId = picked ?? report.lastRun?.id ?? null;
  const run = useReportRun(runId);
  const removeRun = useDeleteReportRun(report.id);
  const remove = useDeleteReport();

  const menu = () =>
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options: ["Edit report", "Delete report", "Cancel"],
        destructiveButtonIndex: 1,
        cancelButtonIndex: 2,
        userInterfaceStyle: "dark",
      },
      (i) => {
        if (i === 0) router.push({ pathname: "/reports/edit", params: { id: report.id } });
        if (i === 1)
          Alert.alert("Delete it and every run?", report.name, [
            { text: "Keep", style: "cancel" },
            {
              text: "Delete",
              style: "destructive",
              onPress: () => remove.mutate(report.id, { onSuccess: () => router.back() }),
            },
          ]);
      },
    );

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Text
              onPress={menu}
              style={{ color: colors.neon, fontSize: 17 }}
              accessibilityRole="button"
            >
              Edit
            </Text>
          ),
        }}
      />
      <Screen title={report.name} onRefresh={() => runs.refetch()}>
        {report.description ? <Muted>{report.description}</Muted> : null}
        <RunBar report={report} onRan={(r) => setPicked(r.id)} />
        <ErrorNote error={remove.error} />

        {(runs.data?.length ?? 0) > 0 && (
          <View style={{ gap: space.xs }}>
            <Label>Runs</Label>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: space.xs }}
            >
              {runs.data!.map((r) => (
                <Pressable
                  key={r.id}
                  onPress={() => setPicked(r.id)}
                  onLongPress={() =>
                    Alert.alert("Delete this run?", `${shortDate(r.from)} – ${shortDate(r.to)}`, [
                      { text: "Keep", style: "cancel" },
                      {
                        text: "Delete",
                        style: "destructive",
                        onPress: () =>
                          removeRun.mutate(r.id, {
                            onSuccess: () => r.id === runId && setPicked(null),
                          }),
                      },
                    ])
                  }
                  style={[styles.run, r.id === runId && styles.runOn]}
                >
                  <Text
                    style={{ color: r.id === runId ? colors.neon : colors.court100, fontSize: 14 }}
                  >
                    {shortDate(r.from)} – {shortDate(r.to)}
                  </Text>
                  <Text style={{ color: colors.court500, fontSize: 11 }}>
                    run {instantDate(r.createdAt)}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
            <Muted style={{ fontSize: 11, color: colors.court500 }}>
              Press and hold a run to delete it.
            </Muted>
          </View>
        )}

        {!runId && (
          <Card>
            <Muted style={{ textAlign: "center" }}>
              Not run yet. Pick a period above and run it.
            </Muted>
          </Card>
        )}
        {runId && run.isPending && <Loading />}
        <ErrorNote error={run.error ?? removeRun.error} />
        {run.data && <RunView run={run.data} />}
      </Screen>
    </>
  );
}

function RunBar({ report, onRan }: { report: ReportDto; onRan: (run: ReportRunDto) => void }) {
  const runReport = useRunReport(report.id);
  const today = useDay(null).data?.today;
  const [range, setRange] = useState<ReportRange>(report.defaultRange);
  const [from, setFrom] = useState(today ?? "");
  const [to, setTo] = useState(today ?? "");
  const [options, setOptions] = useState<ReportOptions>(report.options);
  const custom = range === "custom";
  const ready = !custom || (from && to && from <= to);
  const ai = options.writeUp || options.suggestions;

  return (
    <View style={{ gap: space.md }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: space.xs }}
      >
        {REPORT_RANGES.map((r) => (
          <Chip
            key={r}
            label={REPORT_RANGE_LABELS[r]}
            selected={range === r}
            onPress={() => setRange(r)}
          />
        ))}
      </ScrollView>
      {custom && today && (
        <View style={{ gap: space.sm }}>
          <FormRow label="From">
            <DateStepper
              label="From"
              value={from || today}
              onChange={setFrom}
              max={today}
              today={today}
            />
          </FormRow>
          <FormRow label="To">
            <DateStepper
              label="To"
              value={to || today}
              onChange={setTo}
              min={from}
              max={today}
              today={today}
            />
          </FormRow>
        </View>
      )}
      <SettingsGroup>
        <ReportOptionsRows value={options} onChange={setOptions} />
      </SettingsGroup>
      <Button
        title={
          runReport.isPending ? (ai ? "Running and writing it up…" : "Running…") : "Run report"
        }
        disabled={!ready || runReport.isPending}
        onPress={() =>
          runReport.mutate({ range, ...(custom && { from, to }), options }, { onSuccess: onRan })
        }
      />
      <ErrorNote error={runReport.error} />
    </View>
  );
}

/** A run: the period, the AI write-up and suggestions, then every chart with its summaries. */
function RunView({ run }: { run: ReportRunDto }) {
  const me = useMe();
  const weekStart = me.data?.weekStart ?? 1;
  const share = () =>
    void Share.share({
      title: run.reportName,
      message: [
        `${run.reportName}: ${shortDate(run.from)} – ${shortDate(run.to)}, ${run.to.slice(0, 4)}`,
        run.writeUp,
        ...(run.suggestions ?? []).map((s, i) => `${i + 1}. ${s}`),
        ...run.charts.flatMap((c) => [c.chart.title, ...(c.summaries ?? [])]),
      ]
        .filter(Boolean)
        .join("\n\n"),
    });
  return (
    <View style={{ gap: space.lg }}>
      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: space.md }}>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>{run.reportName}</Text>
          <Text style={styles.period}>
            {shortDate(run.from)} – {shortDate(run.to)}, {run.to.slice(0, 4)}
          </Text>
          <Muted style={{ fontSize: 12 }}>Run {new Date(run.createdAt).toLocaleString()}</Muted>
        </View>
        <Pressable onPress={share} hitSlop={8} accessibilityRole="button">
          <Text style={{ color: colors.neon, fontSize: 15 }}>Share</Text>
        </Pressable>
      </View>

      {run.aiError && (
        <Card style={{ borderColor: tierColor(65) }}>
          <Muted style={{ color: tierColor(65) }}>
            The write-up couldn&apos;t be generated this time ({run.aiError}). The charts and
            summaries are complete; run it again to retry.
          </Muted>
        </Card>
      )}
      {run.writeUp && (
        <Card style={{ gap: space.sm, borderColor: colors.neonDim }}>
          <Text style={[styles.cardTitle, { color: colors.neon }]}>Write-up</Text>
          <Body>{run.writeUp}</Body>
        </Card>
      )}
      {run.suggestions && run.suggestions.length > 0 && (
        <Section title="Suggestions">
          {run.suggestions.map((s, i) => (
            <Body key={s}>
              <Text style={{ color: colors.neon }}>{i + 1}. </Text>
              {s}
            </Body>
          ))}
        </Section>
      )}

      {run.charts.map((c, i) => (
        <Section key={i} title={c.chart.title || "Chart"}>
          <MetricChart series={c.series} config={c.chart} weekStart={weekStart} height={220} />
          {c.summaries?.map((s, j) => (
            <Muted key={j} style={{ fontSize: 14 }}>
              {s}
            </Muted>
          ))}
        </Section>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  run: {
    borderWidth: 1,
    borderColor: colors.court700,
    borderRadius: 10,
    paddingHorizontal: space.md,
    paddingVertical: 6,
  },
  runOn: { borderColor: colors.neon, backgroundColor: "rgba(60,242,200,0.08)" },
  eyebrow: { color: colors.neon, fontSize: 12, letterSpacing: 2, textTransform: "uppercase" },
  period: {
    color: colors.court100,
    fontFamily: fonts.heavy,
    fontSize: 24,
    textTransform: "uppercase",
  },
  cardTitle: {
    fontFamily: fonts.display,
    fontSize: 17,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
});

export default function GatedReportScreen() {
  return (
    <FeatureGate feature="reports">
      <ReportScreen />
    </FeatureGate>
  );
}
