import { addDays, type ExerciseDto, type WorkoutDto } from "@rlo/shared";
import { Link, Redirect, router, Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ActionSheetIOS, Alert, StyleSheet, Text, View } from "react-native";
import { useDay } from "@/api/days";
import {
  useCreateTemplate,
  useDeleteWorkout,
  useExercises,
  useSaveWorkout,
  useWorkout,
} from "@/api/workouts";
import { DateStepper, FormRow, NumberField } from "@/components/controls";
import { StatGrid, StatTile } from "@/components/StatTile";
import { Body, Button, Card, ErrorNote, Field, Loading, Muted, Screen } from "@/components/ui";
import { ExerciseSummary } from "@/components/workouts/WorkoutCard";
import { WorkoutEditor } from "@/components/workouts/WorkoutEditor";
import { longDate } from "@/lib/format";
import { colors, fonts, space, tierColor } from "@/lib/theme";
import { formatElapsed, formatVolume, useUnits } from "@/lib/workouts";
import { FeatureGate } from "@/components/FeatureGate";

/** A finished workout: summary, records, and editing. */
function WorkoutScreen() {
  const { id, finished } = useLocalSearchParams<{ id: string; finished?: string }>();
  const workout = useWorkout(id);
  if (workout.isPending) return <Loading />;
  if (workout.isError) {
    return (
      <Screen>
        <ErrorNote error={workout.error} onRetry={() => void workout.refetch()} />
      </Screen>
    );
  }
  if (!workout.data.endedAt) return <Redirect href="/workouts/active" />;
  return (
    <FinishedWorkout
      workout={workout.data}
      justFinished={finished === "1"}
      refresh={() => workout.refetch()}
    />
  );
}

function FinishedWorkout({
  workout: w,
  justFinished,
  refresh,
}: {
  workout: WorkoutDto;
  justFinished: boolean;
  refresh: () => Promise<unknown>;
}) {
  const units = useUnits();
  const library = useExercises();
  const byId = new Map((library.data ?? []).map((e) => [e.id, e]));
  const createTemplate = useCreateTemplate();
  const remove = useDeleteWorkout();
  const [editing, setEditing] = useState(false);

  const menu = () =>
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options: [
          "Edit workout",
          createTemplate.isSuccess ? "Saved as a template ✓" : "Save as template",
          "Delete workout",
          "Cancel",
        ],
        disabledButtonIndices: createTemplate.isSuccess ? [1] : [],
        destructiveButtonIndex: 2,
        cancelButtonIndex: 3,
        userInterfaceStyle: "dark",
      },
      (i) => {
        if (i === 0) setEditing(true);
        if (i === 1) createTemplate.mutate({ fromWorkoutId: w.id });
        if (i === 2) {
          Alert.alert("Delete this workout?", "It comes off that day's log.", [
            { text: "Keep", style: "cancel" },
            {
              text: "Delete",
              style: "destructive",
              onPress: () => remove.mutate(w.id, { onSuccess: () => router.back() }),
            },
          ]);
        }
      },
    );

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: editing
            ? undefined
            : () => (
                <Text onPress={menu} style={styles.headerAction} accessibilityRole="button">
                  Edit
                </Text>
              ),
        }}
      />
      <Screen eyebrow={longDate(w.localDate)} title={w.name} onRefresh={refresh}>
        {justFinished && (
          <Card style={{ borderColor: colors.neonDim }}>
            <Body style={{ color: colors.neon }}>
              Workout complete. It&apos;s on that day&apos;s log and counts toward its recap.
            </Body>
          </Card>
        )}
        <StatGrid>
          <StatTile label="Time" value={formatElapsed(w.summary.durationS)} />
          <StatTile
            label="Volume"
            value={w.summary.volumeKg > 0 ? formatVolume(w.summary.volumeKg, units) : "—"}
          />
          <StatTile label="Sets" value={w.summary.doneSets} />
        </StatGrid>

        {w.summary.prs.length > 0 && (
          <Card style={{ gap: space.xs, borderColor: tierColor(75) }}>
            <Text style={[styles.prTitle, { color: tierColor(75) }]}>★ Personal records</Text>
            {w.summary.prs.map((pr) => (
              <Link
                key={pr.exerciseId}
                href={{ pathname: "/workouts/exercises/[id]", params: { id: pr.exerciseId } }}
                style={{ color: colors.court100, fontSize: 15 }}
              >
                {pr.label}
              </Link>
            ))}
          </Card>
        )}

        {editing ? (
          <EditWorkout workout={w} library={library.data ?? []} onDone={() => setEditing(false)} />
        ) : (
          <>
            {w.notes ? <Muted>{w.notes}</Muted> : null}
            {w.exercises.map((e, i) => (
              <ExerciseSummary key={i} exercise={e} info={byId.get(e.exerciseId)} units={units} />
            ))}
            <ErrorNote error={createTemplate.error ?? remove.error} />
            {createTemplate.isSuccess && <Muted>Saved as a template.</Muted>}
          </>
        )}
      </Screen>
    </>
  );
}

function EditWorkout({
  workout: w,
  library,
  onDone,
}: {
  workout: WorkoutDto;
  library: ExerciseDto[];
  onDone: () => void;
}) {
  const units = useUnits();
  const today = useDay(null).data?.today;
  const save = useSaveWorkout(w.id);
  const [name, setName] = useState(w.name);
  const [notes, setNotes] = useState(w.notes);
  const [localDate, setLocalDate] = useState(w.localDate);
  const [minutes, setMinutes] = useState<number | null>(
    Math.max(1, Math.round(w.summary.durationS / 60)),
  );
  const [exercises, setExercises] = useState(w.exercises);

  return (
    <View style={{ gap: space.md }}>
      <FormRow label="Name">
        <Field value={name} maxLength={80} onChangeText={setName} />
      </FormRow>
      <View style={{ flexDirection: "row", gap: space.lg, alignItems: "flex-end" }}>
        <FormRow label="Day">
          <DateStepper
            label="Day"
            value={localDate}
            onChange={setLocalDate}
            max={today}
            min={today ? addDays(today, -365 * 5) : undefined}
            today={today}
          />
        </FormRow>
        <FormRow label="Minutes">
          <NumberField label="Minutes" value={minutes} onChange={setMinutes} width={80} />
        </FormRow>
      </View>
      <FormRow label="Notes">
        <Field
          value={notes}
          multiline
          maxLength={2000}
          onChangeText={setNotes}
          style={{ minHeight: 70 }}
        />
      </FormRow>
      <WorkoutEditor
        exercises={exercises}
        library={library}
        units={units}
        mode="log"
        previous={w.previous}
        onChange={setExercises}
      />
      <ErrorNote error={save.error} />
      <Button
        title={save.isPending ? "Saving…" : "Save changes"}
        disabled={save.isPending}
        onPress={() =>
          save.mutate(
            {
              name: name.trim() || w.name,
              notes,
              localDate,
              durationS: Math.max(60, Math.round((minutes ?? 1) * 60)),
              // Every set of a finished workout counts as done.
              exercises: exercises
                .map((x) => ({ ...x, sets: x.sets.map((s) => ({ ...s, done: true })) }))
                .filter((x) => x.sets.length > 0),
            },
            { onSuccess: onDone },
          )
        }
      />
      <Button title="Cancel" variant="ghost" onPress={onDone} />
    </View>
  );
}

const styles = StyleSheet.create({
  headerAction: { color: colors.neon, fontSize: 17 },
  prTitle: {
    fontFamily: fonts.display,
    fontSize: 17,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
});

export default function GatedWorkoutScreen() {
  return (
    <FeatureGate feature="workouts">
      <WorkoutScreen />
    </FeatureGate>
  );
}
