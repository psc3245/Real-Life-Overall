import {
  distanceUnit,
  formatDuration,
  formatSet,
  HEADLINE_RECORD,
  RECORD_LABELS,
  recordChartUnit,
  recordChartValue,
  SET_KIND_TAGS,
  toDisplayDistance,
  toDisplayWeight,
  weightUnit,
  type ExerciseRecordsDto,
  type UnitSystem,
} from "@rlo/shared";
import { router, useLocalSearchParams } from "expo-router";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { useArchiveExercise, useExercise } from "@/api/workouts";
import { ChartButton } from "@/components/ChartButton";
import { TrendChart } from "@/components/charts/MetricChart";
import { StatGrid, StatTile } from "@/components/StatTile";
import { Button, Card, ErrorNote, Label, Loading, Muted, Screen, Section } from "@/components/ui";
import { exerciseDetail } from "@/components/workouts/ExercisePicker";
import { dayLabel } from "@/lib/format";
import { colors, space } from "@/lib/theme";
import { useUnits } from "@/lib/workouts";
import { FeatureGate } from "@/components/FeatureGate";

/** A record's value in the user's units. */
function formatRecord(key: keyof ExerciseRecordsDto, value: number, units: UnitSystem) {
  switch (key) {
    case "heaviestKg":
    case "best1RmKg":
    case "bestSetVolumeKg":
      return `${(Math.round(toDisplayWeight(value, units) * 10) / 10).toLocaleString()} ${weightUnit(units)}`;
    case "longestS":
      return formatDuration(value);
    case "longestM":
      return `${toDisplayDistance(value, units)} ${distanceUnit(units)}`;
    case "bestPct":
      return `${Math.round(value)}%`;
    default:
      return String(value);
  }
}

function ExerciseScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const detail = useExercise(id);
  const units = useUnits();
  const archive = useArchiveExercise();
  if (detail.isPending) return <Loading />;
  if (detail.isError) {
    return (
      <Screen>
        <ErrorNote error={detail.error} onRetry={() => void detail.refetch()} />
      </Screen>
    );
  }

  const { exercise: e, records, history } = detail.data;
  const headline = HEADLINE_RECORD[e.tracking];
  const recordKeys = (Object.keys(records) as (keyof ExerciseRecordsDto)[]).filter(
    (k) => records[k] !== null,
  );
  const points = [...history]
    .reverse()
    .filter((h) => h.best !== null)
    .map((h) => ({ date: h.localDate, value: recordChartValue(headline, h.best!, units) }));
  const unit = recordChartUnit(headline, units);

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
      eyebrow={`${exerciseDetail(e)} · done ${e.timesDone}×`}
      title={e.name}
      onRefresh={() => detail.refetch()}
    >
      <ChartButton ids={[`exercise:${e.id}`]} config={{ range: "all", trend: true }} />
      {recordKeys.length > 0 ? (
        <StatGrid>
          {recordKeys.map((k) => (
            <StatTile
              key={k}
              label={RECORD_LABELS[k]}
              value={formatRecord(k, records[k]!, units)}
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
                        <Muted>{formatSet(e.tracking, s, units)}</Muted>
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
          <Button title="Remove exercise" variant="danger" onPress={remove} />
          <ErrorNote error={archive.error} />
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
