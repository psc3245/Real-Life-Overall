import { addDays, BACKFILL_DAYS, type WorkoutExerciseDto } from "@rlo/shared";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { useCoachDraft, useResolveCoachSuggestion } from "@/api/coach";
import { useDay } from "@/api/days";
import { useExercises } from "@/api/workouts";
import { DateStepper, FormRow, NumberField } from "@/components/controls";
import { FeatureGate } from "@/components/FeatureGate";
import { Button, ErrorNote, Field, Loading, Muted, Screen } from "@/components/ui";
import { WorkoutEditor } from "@/components/workouts/WorkoutEditor";
import { space } from "@/lib/theme";
import { useUnits } from "@/lib/workouts";

/**
 * A workout the coach drafted, opened from its card to check and tweak before saving: the
 * name, day, length and every set. Saving goes through the coach, so the card shows it saved.
 * (Template drafts open in the template editor.)
 */
function WorkoutDraftScreen() {
  const params = useLocalSearchParams<{ thread?: string; message?: string; index?: string }>();
  const { isPending, draft } = useCoachDraft(params.thread, params.message, Number(params.index));
  const today = useDay(null).data?.today;
  if (isPending || !today) return <Loading />;
  if (draft?.kind !== "workout" || draft.status !== "pending") {
    return (
      <Screen>
        <Muted>This draft was already saved or discarded.</Muted>
      </Screen>
    );
  }
  return (
    <DraftForm
      messageId={params.message!}
      index={draft.index}
      today={today}
      initial={{
        name: draft.name,
        date: draft.date,
        minutes: Math.round(draft.durationS / 60),
        notes: draft.notes,
        exercises: draft.exercises,
      }}
    />
  );
}

function DraftForm({
  messageId,
  index,
  today,
  initial,
}: {
  messageId: string;
  index: number;
  today: string;
  initial: {
    name: string;
    date: string;
    minutes: number;
    notes: string;
    exercises: WorkoutExerciseDto[];
  };
}) {
  const units = useUnits();
  const library = useExercises();
  const save = useResolveCoachSuggestion();
  const [name, setName] = useState(initial.name);
  const [date, setDate] = useState(initial.date);
  const [minutes, setMinutes] = useState<number | null>(initial.minutes);
  const [exercises, setExercises] = useState(initial.exercises);
  // A logged workout keeps only the sets that were done.
  const done = exercises
    .map((e) => ({ ...e, sets: e.sets.filter((s) => s.done) }))
    .filter((e) => e.sets.length);

  const submit = () =>
    save.mutate(
      {
        messageId,
        index,
        action: "accept",
        edits: {
          name: name.trim(),
          notes: initial.notes,
          localDate: date,
          durationS: Math.max(1, Math.round(minutes ?? 1)) * 60,
          exercises: done,
        },
      },
      { onSuccess: () => router.back() },
    );

  return (
    <Screen>
      <Stack.Screen options={{ title: "Review workout" }} />
      <FormRow label="Name">
        <Field value={name} maxLength={80} placeholder="Leg Day" onChangeText={setName} />
      </FormRow>
      <FormRow label="Day">
        <DateStepper
          label="Workout day"
          value={date}
          onChange={setDate}
          min={addDays(today, -BACKFILL_DAYS)}
          max={today}
          today={today}
        />
      </FormRow>
      <FormRow label="Minutes">
        <NumberField label="Minutes" value={minutes} onChange={setMinutes} />
      </FormRow>
      <WorkoutEditor
        exercises={exercises}
        library={library.data ?? []}
        units={units}
        mode="log"
        onChange={setExercises}
      />
      <ErrorNote error={save.error} />
      <View style={{ gap: space.sm }}>
        <Button
          title={save.isPending ? "Saving…" : "Save workout"}
          disabled={!name.trim() || !minutes || done.length === 0 || save.isPending}
          onPress={submit}
        />
        <Button title="Cancel" variant="ghost" onPress={() => router.back()} />
      </View>
    </Screen>
  );
}

export default function GatedWorkoutDraftScreen() {
  return (
    <FeatureGate feature="workouts">
      <WorkoutDraftScreen />
    </FeatureGate>
  );
}
