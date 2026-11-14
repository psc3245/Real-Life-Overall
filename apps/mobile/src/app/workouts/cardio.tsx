import {
  addDays,
  cardioSession,
  distanceUnit,
  formatDuration,
  formatPace,
  fromDisplayDistance,
  parseDuration,
  toDisplayDistance,
  type CardioInput,
  type WorkoutDto,
} from "@rlo/shared";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useDay } from "@/api/days";
import { useSaveCardio, useWorkout } from "@/api/workouts";
import { Chip, DateStepper, FormRow } from "@/components/controls";
import { FeatureGate } from "@/components/FeatureGate";
import { Button, Card, ErrorNote, Field, Loading, Muted, Screen } from "@/components/ui";
import { EffortPicker } from "@/components/workouts/BoxScore";
import { FT_PER_M, useCardioActivities } from "@/components/workouts/Cardio";
import { colors, space } from "@/lib/theme";
import { useUnits } from "@/lib/workouts";

/** Log a cardio session, or edit one (?id=). */
function CardioScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const today = useDay(null).data?.today;
  if (!today) return <Loading />;
  return id ? <EditCardio id={id} today={today} /> : <CardioForm today={today} />;
}

function EditCardio({ id, today }: { id: string; today: string }) {
  const existing = useWorkout(id);
  if (existing.isPending) return <Loading />;
  if (existing.isError) {
    return (
      <Screen>
        <ErrorNote error={existing.error} onRetry={() => void existing.refetch()} />
      </Screen>
    );
  }
  return <CardioForm today={today} session={existing.data} />;
}

const num = (text: string) => {
  const n = Number(text.trim());
  return text.trim() && Number.isFinite(n) && n >= 0 ? n : null;
};

function CardioForm({ today, session }: { today: string; session?: WorkoutDto }) {
  const units = useUnits();
  const activities = useCardioActivities();
  const save = useSaveCardio(session?.id);
  const initial = session ? cardioSession(session) : null;
  const details = session?.boxScore;

  const [activity, setActivity] = useState(initial?.activityId ?? "running");
  const [name, setName] = useState(session?.name ?? "");
  const [date, setDate] = useState(session?.localDate ?? today);
  const [duration, setDuration] = useState(initial ? formatDuration(initial.durationS) : "");
  const [distance, setDistance] = useState(
    initial?.distanceM ? String(toDisplayDistance(initial.distanceM, units)) : "",
  );
  const [elevation, setElevation] = useState(
    details?.elevationM
      ? String(
          Math.round(units === "imperial" ? details.elevationM * FT_PER_M : details.elevationM),
        )
      : "",
  );
  const [heartRate, setHeartRate] = useState(details?.avgHeartRate?.toString() ?? "");
  const [maxHeartRate, setMaxHeartRate] = useState(details?.maxHeartRate?.toString() ?? "");
  const [calories, setCalories] = useState(details?.calories?.toString() ?? "");
  const [effort, setEffort] = useState<number | null>(details?.effort ?? null);
  const [notes, setNotes] = useState(session?.notes ?? "");

  const info = activities.find((a) => a.id === activity);
  const tracksDistance = info ? info.stats.includes("distance") : true;
  const durationS = parseDuration(duration);
  const distanceM =
    tracksDistance && num(distance) ? fromDisplayDistance(num(distance)!, units) : null;
  const pace = formatPace(activity, distanceM, durationS, units);
  const valid = Boolean(info && durationS && durationS > 0);

  const submit = () => {
    if (!valid) return;
    const elev = num(elevation);
    const input: CardioInput = {
      activity,
      ...(name.trim() && { name: name.trim() }),
      notes,
      localDate: date,
      durationS: durationS!,
      distanceM,
      elevationM: elev === null ? null : units === "imperial" ? elev / FT_PER_M : elev,
      avgHeartRate: num(heartRate) === null ? null : Math.round(num(heartRate)!),
      maxHeartRate: num(maxHeartRate) === null ? null : Math.round(num(maxHeartRate)!),
      calories: num(calories) === null ? null : Math.round(num(calories)!),
      effort,
    };
    save.mutate(input, { onSuccess: () => router.back() });
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: session ? "Edit cardio" : "Log cardio" }} />
      <FormRow label="Activity">
        <View style={styles.chips}>
          {activities.map((a) => (
            <Chip
              key={a.id}
              label={a.name}
              selected={a.id === activity}
              onPress={() => setActivity(a.id)}
            />
          ))}
        </View>
        <Muted style={{ fontSize: 12 }}>
          Missing one? Add it under Exercises with the Cardio category.
        </Muted>
      </FormRow>
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <FormRow label="Time">
            <Field
              accessibilityLabel="Time"
              value={duration}
              placeholder="h:mm:ss or min"
              keyboardType="numbers-and-punctuation"
              onChangeText={setDuration}
            />
          </FormRow>
        </View>
        {tracksDistance && (
          <View style={{ flex: 1 }}>
            <FormRow label={`Distance (${distanceUnit(units)})`}>
              <Field
                accessibilityLabel="Distance"
                value={distance}
                placeholder="Optional"
                keyboardType="decimal-pad"
                onChangeText={setDistance}
              />
            </FormRow>
          </View>
        )}
      </View>
      <Card>
        {pace ? (
          <Text style={styles.pace}>
            Pace <Text style={{ color: colors.neon, fontWeight: "600" }}>{pace}</Text>
          </Text>
        ) : (
          <Muted>Add a time and distance to see your pace.</Muted>
        )}
      </Card>
      <FormRow label="Day">
        <DateStepper
          label="Session day"
          value={date}
          onChange={setDate}
          min={addDays(today, -365 * 5)}
          max={today}
          today={today}
        />
      </FormRow>
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <FormRow label="Avg HR">
            <Field
              accessibilityLabel="Average heart rate"
              value={heartRate}
              placeholder="bpm"
              keyboardType="number-pad"
              onChangeText={setHeartRate}
            />
          </FormRow>
        </View>
        <View style={{ flex: 1 }}>
          <FormRow label="Max HR">
            <Field
              accessibilityLabel="Max heart rate"
              value={maxHeartRate}
              placeholder="bpm"
              keyboardType="number-pad"
              onChangeText={setMaxHeartRate}
            />
          </FormRow>
        </View>
      </View>
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <FormRow label="Calories">
            <Field
              accessibilityLabel="Calories"
              value={calories}
              placeholder="kcal"
              keyboardType="number-pad"
              onChangeText={setCalories}
            />
          </FormRow>
        </View>
        <View style={{ flex: 1 }}>
          <FormRow label={`Climb (${units === "imperial" ? "ft" : "m"})`}>
            <Field
              accessibilityLabel="Elevation gain"
              value={elevation}
              placeholder="—"
              keyboardType="number-pad"
              onChangeText={setElevation}
            />
          </FormRow>
        </View>
      </View>
      <EffortPicker value={effort} onChange={setEffort} />
      <FormRow label="Name">
        <Field
          value={name}
          maxLength={80}
          placeholder={info?.name ?? "Cardio"}
          onChangeText={setName}
        />
      </FormRow>
      <FormRow label="Notes">
        <Field
          value={notes}
          maxLength={2000}
          multiline
          placeholder="Route, weather, how it felt"
          onChangeText={setNotes}
          style={{ minHeight: 64 }}
        />
      </FormRow>
      <ErrorNote error={save.error} />
      <View style={{ gap: space.sm }}>
        <Button
          title={save.isPending ? "Saving…" : session ? "Save changes" : "Log session"}
          disabled={!valid || save.isPending}
          onPress={submit}
        />
        <Button title="Cancel" variant="ghost" onPress={() => router.back()} />
      </View>
    </Screen>
  );
}

export default function GatedCardioScreen() {
  return (
    <FeatureGate feature="workouts">
      <CardioScreen />
    </FeatureGate>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.xs },
  row: { flexDirection: "row", gap: space.sm },
  pace: { color: colors.court300, fontSize: 15, fontVariant: ["tabular-nums"] },
});
