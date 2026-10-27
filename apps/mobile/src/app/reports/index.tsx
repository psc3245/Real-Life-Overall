import { REPORT_RANGE_LABELS } from "@rlo/shared";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text } from "react-native";
import { useReports } from "@/api/reports";
import { Button, Card, ErrorNote, Loading, Muted, Screen } from "@/components/ui";
import { instantDate } from "@/lib/format";
import { colors, fonts, space } from "@/lib/theme";
import { FeatureGate } from "@/components/FeatureGate";

/** Saved reports: collections of charts you can re-run over any period. */
function ReportsScreen() {
  const reports = useReports();
  if (reports.isPending) return <Loading title="Reports" />;
  return (
    <Screen eyebrow="Charts, run on demand" title="Reports" onRefresh={() => reports.refetch()}>
      <Button title="+ New report" onPress={() => router.push("/reports/edit")} />
      <ErrorNote error={reports.error} />
      {reports.data?.length === 0 && (
        <Card style={{ gap: space.xs }}>
          <Muted style={{ textAlign: "center" }}>No reports yet.</Muted>
          <Muted style={{ textAlign: "center", fontSize: 13, color: colors.court500 }}>
            A report is a set of charts (say training volume, Fitness, weight and your run habit)
            that you can run for any week, month or season, with summaries, a write-up and
            suggestions.
          </Muted>
        </Card>
      )}
      {reports.data?.map((r) => (
        <Pressable
          key={r.id}
          onPress={() => router.push({ pathname: "/reports/[id]", params: { id: r.id } })}
        >
          <Card style={{ gap: 4 }}>
            <Text style={styles.name}>{r.name}</Text>
            {r.description ? <Muted>{r.description}</Muted> : null}
            <Muted style={styles.meta}>
              {r.charts.length} chart{r.charts.length === 1 ? "" : "s"} ·{" "}
              {REPORT_RANGE_LABELS[r.defaultRange]}
              {r.options.summaries && " · summaries"}
              {r.options.writeUp && " · write-up"}
              {r.options.suggestions && " · suggestions"}
            </Muted>
            <Muted style={styles.meta}>
              {r.lastRun
                ? `Last run ${instantDate(r.lastRun.createdAt)} (${r.lastRun.from} to ${r.lastRun.to})`
                : "Never run"}
            </Muted>
          </Card>
        </Pressable>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  name: {
    color: colors.court100,
    fontFamily: fonts.display,
    fontSize: 18,
    textTransform: "uppercase",
  },
  meta: { fontSize: 12, color: colors.court500 },
});

export default function GatedReportsScreen() {
  return (
    <FeatureGate feature="reports">
      <ReportsScreen />
    </FeatureGate>
  );
}
