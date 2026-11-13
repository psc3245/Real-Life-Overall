import type { LiveWorkoutKind, WorkoutTemplateDto } from "@rlo/shared";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { useCoachDraft, useResolveCoachSuggestion } from "@/api/coach";
import { useCreateTemplate, useExercises, useTemplates, useUpdateTemplate } from "@/api/workouts";
import { FormRow } from "@/components/controls";
import { Button, ErrorNote, Field, Loading, Muted, Screen } from "@/components/ui";
import { WorkoutEditor } from "@/components/workouts/WorkoutEditor";
import { space } from "@/lib/theme";
import { useUnits } from "@/lib/workouts";
import { FeatureGate } from "@/components/FeatureGate";

/**
 * Creates a template (no id), edits one, or reviews one the coach drafted (`thread`,
 * `message`, `index`), saving it through the coach so its card shows it saved.
 */
function TemplateScreen() {
  const params = useLocalSearchParams<{
    id?: string;
    /** New practice plans pass "sport". */
    kind?: string;
    thread?: string;
    message?: string;
    index?: string;
  }>();
  const { id } = params;
  const templates = useTemplates();
  const coachDraft = useCoachDraft(params.thread, params.message, Number(params.index));
  if (params.message) {
    if (coachDraft.isPending) return <Loading />;
    const d = coachDraft.draft;
    if (d?.kind !== "template" || d.status !== "pending") {
      return (
        <Screen>
          <Muted>This draft was already saved or discarded.</Muted>
        </Screen>
      );
    }
    return <TemplateForm draft={{ ...d, messageId: params.message }} />;
  }
  if (!id) return <TemplateForm kind={params.kind === "sport" ? "sport" : "strength"} />;
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
  return <TemplateForm template={template} kind={template.kind ?? "strength"} />;
}

function TemplateForm({
  template,
  draft,
  kind = "strength",
}: {
  template?: WorkoutTemplateDto;
  kind?: LiveWorkoutKind;
  /** A coach draft to review: saved through the coach instead of created directly. */
  draft?: Pick<WorkoutTemplateDto, "name" | "notes" | "exercises"> & {
    messageId: string;
    index: number;
  };
}) {
  const units = useUnits();
  const library = useExercises();
  const create = useCreateTemplate();
  const update = useUpdateTemplate();
  const accept = useResolveCoachSuggestion();
  const start = template ?? draft;
  const [name, setName] = useState(start?.name ?? "");
  const [notes, setNotes] = useState(start?.notes ?? "");
  const [exercises, setExercises] = useState(start?.exercises ?? []);
  const saving = create.isPending || update.isPending || accept.isPending;

  const submit = () => {
    const body = { name: name.trim(), notes, exercises };
    const done = { onSuccess: () => router.back() };
    if (draft) {
      accept.mutate(
        { messageId: draft.messageId, index: draft.index, action: "accept", edits: body },
        done,
      );
    } else if (template) update.mutate({ id: template.id, ...body }, done);
    else create.mutate({ ...body, kind }, done);
  };

  return (
    <Screen>
      <Stack.Screen
        options={{
          title: draft
            ? "Review template"
            : `${template ? "Edit" : "New"} ${kind === "sport" ? "practice plan" : "template"}`,
        }}
      />
      <FormRow label="Name">
        <Field
          value={name}
          autoFocus={!template}
          maxLength={80}
          placeholder={kind === "sport" ? "Shooting Workout" : "Push Day"}
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
        defaultCategory={kind === "sport" ? "sport" : undefined}
        onChange={setExercises}
      />
      <ErrorNote error={accept.error ?? create.error ?? update.error} />
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
