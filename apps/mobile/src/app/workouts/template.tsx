import type { WorkoutTemplateDto } from "@rlo/shared";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { useCreateTemplate, useExercises, useTemplates, useUpdateTemplate } from "@/api/workouts";
import { FormRow } from "@/components/controls";
import { Button, ErrorNote, Field, Loading, Muted, Screen } from "@/components/ui";
import { WorkoutEditor } from "@/components/workouts/WorkoutEditor";
import { space } from "@/lib/theme";
import { useUnits } from "@/lib/workouts";
import { FeatureGate } from "@/components/FeatureGate";

/** Creates a template (no id) or edits one. */
function TemplateScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const templates = useTemplates();
  if (!id) return <TemplateForm />;
  if (templates.isPending) return <Loading />;
  if (templates.isError) {
    return (
      <Screen>
        <ErrorNote error={templates.error} />
      </Screen>
    );
  }
  const template = templates.data.find((t) => t.id === id);
  if (!template) {
    return (
      <Screen>
        <Muted>Template not found.</Muted>
      </Screen>
    );
  }
  return <TemplateForm template={template} />;
}

function TemplateForm({ template }: { template?: WorkoutTemplateDto }) {
  const units = useUnits();
  const library = useExercises();
  const create = useCreateTemplate();
  const update = useUpdateTemplate();
  const [name, setName] = useState(template?.name ?? "");
  const [notes, setNotes] = useState(template?.notes ?? "");
  const [exercises, setExercises] = useState(template?.exercises ?? []);
  const saving = create.isPending || update.isPending;

  const submit = () => {
    const body = { name: name.trim(), notes, exercises };
    const done = { onSuccess: () => router.back() };
    if (template) update.mutate({ id: template.id, ...body }, done);
    else create.mutate(body, done);
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: template ? "Edit template" : "New template" }} />
      <FormRow label="Name">
        <Field
          value={name}
          autoFocus={!template}
          maxLength={80}
          placeholder="Push Day"
          onChangeText={setName}
        />
      </FormRow>
      <FormRow label="Notes">
        <Field
          value={notes}
          multiline
          maxLength={2000}
          placeholder="Warm-up routine, rest times, focus…"
          onChangeText={setNotes}
          style={{ minHeight: 70 }}
        />
      </FormRow>
      <Muted>Sets here are targets. Starting the template fills them in, ready to check off.</Muted>
      <WorkoutEditor
        exercises={exercises}
        library={library.data ?? []}
        units={units}
        mode="plan"
        onChange={setExercises}
      />
      <ErrorNote error={create.error ?? update.error} />
      <View style={{ gap: space.sm }}>
        <Button
          title={saving ? "Saving…" : "Save template"}
          disabled={!name.trim() || saving}
          onPress={submit}
        />
        <Button title="Cancel" variant="ghost" onPress={() => router.back()} />
      </View>
    </Screen>
  );
}

export default function GatedTemplateScreen() {
  return (
    <FeatureGate feature="workouts">
      <TemplateScreen />
    </FeatureGate>
  );
}
