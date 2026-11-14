import {
  formatSet,
  RECORD_KEYS,
  RECORD_LABELS,
  recordChartUnit,
  recordChartValue,
  SET_KIND_TAGS,
} from "@rlo/shared";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { useArchiveExercise, useExercise } from "@/api/workouts";
import { ChartButton } from "@/components/ChartButton";
import { TrendChart } from "@/components/charts/MetricChart";
import { StatGrid, StatTile } from "@/components/StatTile";
import { Button, Card, ErrorNote, Label, Loading, Muted, Screen, Section } from "@/components/ui";
import { Sheet } from "@/components/Sheet";
import { ExerciseForm } from "@/components/workouts/ExerciseForm";
import { exerciseDetail } from "@/components/workouts/ExercisePicker";
import { dayLabel } from "@/lib/format";
import { colors, space } from "@/lib/theme";
import { useUnits } from "@/lib/workouts";
import { formatRecord } from "@/lib/workouts";
import { FeatureGate } from "@/components/FeatureGate";

/** A record's value in the user's units. */
function ExerciseScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const detail = useExercise(id);
  const units = useUnits();
  const archive = useArchiveExercise();
  const [editing, setEditing] = useState(false);
  if (detail.isPending) return <Loading />;
  if (detail.isError) {
    return (
      <Screen>
        <ErrorNote error={detail.error} onRetry={() => void detail.refetch()} />
      </Screen>
    );
  }

  const { exercise: e, records, history } = detail.data;
  const headline = e.headline;
  // The headline record first, then the rest in their usual order.
  const recordKeys = [headline, ...RECORD_KEYS.filter((k) => k !== headline)].filter(
    (k) => records[k] != null,
  );
  const points = [...history]
    .reverse()
    .filter((h) => h.best !== null)
    .map((h) => ({
      date: h.localDate,
      value: recordChartValue(headline, h.best!, units, e.stats),
    }));
  const unit = recordChartUnit(headline, units, e.stats);

  const remove = () =>
    Alert.alert("Remove from your library?", "Past workouts keep it.", [
      { text: "Keep", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => archive.mutate(e.id, { onSuccess: () => router.back() }),
      },
    ]);

  return (
    <Screen
      eyebrow={`${exerciseDetail(e)} · scored by ${RECORD_LABELS[headline].toLowerCase()} · done ${e.timesDone}×`}
      title={e.name}
      onRefresh={() => detail.refetch()}
    >
      {/* The chart catalog only lists exercises from finished workouts. */}
      {e.timesDone > 0 && (
        <ChartButton ids={[`exercise:${e.id}`]} config={{ range: "all", trend: true }} />
      )}
      {recordKeys.length > 0 ? (
        <StatGrid>
          {recordKeys.map((k) => (
            <StatTile
              key={k}
              label={RECORD_LABELS[k]}
              value={formatRecord(k, records[k]!, units, e.stats)}
            />
          ))}
        </StatGrid>
      ) : (
        <Card>
          <Muted style={{ textAlign: "center" }}>
            No sets logged yet. Records and charts show up after your first workout with it.
          </Muted>
        </Card>
      )}

      {points.length > 0 && (
        <Section title={RECORD_LABELS[headline]}>
          <TrendChart
            points={points}
            label={RECORD_LABELS[headline]}
            unit={unit === "reps" ? "" : unit}
          />
        </Section>
      )}

      {history.length > 0 && (
        <View style={{ gap: space.sm }}>
          <Label>History</Label>
          {history.map((h) => {
            let working = 0;
            return (
              <Pressable
                key={`${h.workoutId}-${h.localDate}`}
                onPress={() =>
                  router.push({ pathname: "/workouts/[id]", params: { id: h.workoutId } })
                }
              >
                <Card style={{ gap: 2 }}>
                  <View style={styles.historyHead}>
                    <Text style={styles.workout}>{h.workoutName}</Text>
                    <Muted style={{ fontSize: 13 }}>{dayLabel(h.localDate)}</Muted>
                  </View>
                  {h.sets.map((s, i) => {
                    if (s.kind !== "warmup") working += 1;
                    return (
                      <View key={i} style={{ flexDirection: "row", gap: space.md }}>
                        <Text style={styles.setNo}>
                          {s.kind === "normal" ? working : SET_KIND_TAGS[s.kind]}
                        </Text>
                        <Muted>{formatSet(e, s, units)}</Muted>
                      </View>
                    );
                  })}
                </Card>
              </Pressable>
            );
          })}
        </View>
      )}

      {e.custom && (
        <>
          <Button title="Edit exercise" variant="ghost" onPress={() => setEditing(true)} />
          <Button title="Remove exercise" variant="danger" onPress={remove} />
          <ErrorNote error={archive.error} />
          <Sheet open={editing} title="Edit exercise" onClose={() => setEditing(false)}>
            {e.timesDone > 0 && (
              <Muted style={{ fontSize: 12 }}>
                Logged sets keep their numbers; a stat you remove just stops showing.
              </Muted>
            )}
            <ExerciseForm exercise={e} onSaved={() => setEditing(false)} />
          </Sheet>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  historyHead: { flexDirection: "row", justifyContent: "space-between", gap: space.md },
  workout: { color: colors.court100, fontSize: 16, fontWeight: "600", flex: 1 },
  setNo: { width: 22, textAlign: "center", color: colors.court500 },
});

export default function GatedExerciseScreen() {
  return (
    <FeatureGate feature="workouts">
      <ExerciseScreen />
    </FeatureGate>
  );
}
