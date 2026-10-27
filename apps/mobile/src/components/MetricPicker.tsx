import { MAX_CHART_METRICS, METRIC_GROUP_LABELS, METRIC_GROUPS, type MetricDto } from "@rlo/shared";
import { SymbolView } from "expo-symbols";
import { useState } from "react";
import { Pressable, SectionList, StyleSheet, Text, View } from "react-native";
import { colors, space } from "@/lib/theme";
import { Sheet } from "./Sheet";
import { Field, Muted } from "./ui";

/** Grouped, searchable checklist of every metric (charts and reports). */
export function MetricPicker({
  open,
  metrics,
  selected,
  onToggle,
  onClose,
  done,
}: {
  open: boolean;
  metrics: MetricDto[];
  selected: string[];
  onToggle: (id: string) => void;
  onClose: () => void;
  /** Shown as the sheet's action; defaults to closing. */
  done?: { label: string; onPress: () => void; disabled?: boolean };
}) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const shown = metrics.filter(
    (m) => !q || m.label.toLowerCase().includes(q) || (m.detail ?? "").toLowerCase().includes(q),
  );
  const full = selected.length >= MAX_CHART_METRICS;
  const sections = METRIC_GROUPS.map((g) => ({
    title: METRIC_GROUP_LABELS[g],
    data: shown.filter((m) => m.group === g),
  })).filter((s) => s.data.length);

  return (
    <Sheet
      open={open}
      title={`Metrics ${selected.length}/${MAX_CHART_METRICS}`}
      onClose={onClose}
      action={done ?? { label: "Done", onPress: onClose }}
    >
      <Field
        accessibilityLabel="Search metrics"
        value={query}
        placeholder="Search"
        onChangeText={setQuery}
        clearButtonMode="while-editing"
        autoCorrect={false}
      />
      <SectionList
        sections={sections}
        keyExtractor={(m) => m.id}
        keyboardShouldPersistTaps="handled"
        stickySectionHeadersEnabled={false}
        renderSectionHeader={({ section }) => <Text style={styles.group}>{section.title}</Text>}
        renderItem={({ item: m }) => {
          const on = selected.includes(m.id);
          return (
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on, disabled: !on && full }}
              disabled={!on && full}
              onPress={() => onToggle(m.id)}
              style={[styles.metric, on && styles.metricOn, !on && full && { opacity: 0.4 }]}
            >
              <SymbolView
                name={on ? "checkmark.square.fill" : "square"}
                tintColor={on ? colors.neon : colors.court500}
                size={20}
              />
              <View style={{ flex: 1 }}>
                <Text style={{ color: on ? colors.neon : colors.court100, fontSize: 15 }}>
                  {m.label}
                </Text>
                {m.detail ? <Muted style={{ fontSize: 12 }}>{m.detail}</Muted> : null}
              </View>
            </Pressable>
          );
        }}
      />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  group: {
    color: colors.court500,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: "uppercase",
    paddingTop: space.md,
    paddingBottom: space.xs,
  },
  metric: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingVertical: 9,
    paddingHorizontal: space.sm,
    borderRadius: 10,
  },
  metricOn: { backgroundColor: "rgba(60,242,200,0.08)" },
});
