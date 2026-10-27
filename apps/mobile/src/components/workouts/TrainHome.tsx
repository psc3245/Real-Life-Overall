import type { ExerciseDto, WorkoutTemplateDto } from "@rlo/shared";
import { router } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import {
  useActiveWorkout,
  useDeleteTemplate,
  useExercises,
  useStartWorkout,
  useTemplates,
} from "@/api/workouts";
import { NavRow, SettingsGroup } from "@/components/settings";
import { Sheet } from "@/components/Sheet";
import { Body, Button, Card, ErrorNote, Label, Muted } from "@/components/ui";
import { colors, fonts, space } from "@/lib/theme";
import { since } from "@/lib/workouts";

/** Start a workout: resume the one in progress, start empty, or start from a template. */
export function TrainHome() {
  const active = useActiveWorkout();
  const templates = useTemplates();
  const exercises = useExercises();
  const start = useStartWorkout();
  const [preview, setPreview] = useState<WorkoutTemplateDto | null>(null);
  const names = new Map((exercises.data ?? []).map((e) => [e.id, e]));

  const begin = (templateId?: string) =>
    start.mutate(templateId ? { templateId } : {}, {
      onSuccess: () => {
        setPreview(null);
        router.push("/workouts/active");
      },
    });
  const inProgress = active.data;

  return (
    <View style={{ gap: space.lg }}>
      {inProgress ? (
        <Pressable onPress={() => router.push("/workouts/active")} accessibilityRole="link">
          <Card style={styles.resume}>
            <View style={{ flex: 1 }}>
              <Text style={styles.inProgress}>In progress</Text>
              <Text style={styles.resumeName}>{inProgress.name}</Text>
            </View>
            <Text style={styles.resumeAction}>Resume →</Text>
          </Card>
        </Pressable>
      ) : (
        <Button
          title={start.isPending ? "Starting…" : "Start an empty workout"}
          disabled={start.isPending}
          onPress={() => begin()}
        />
      )}
      <ErrorNote error={start.error} />

      <View style={{ gap: space.sm }}>
        <View style={styles.head}>
          <Label>Templates{templates.data?.length ? ` (${templates.data.length})` : ""}</Label>
          <Pressable onPress={() => router.push("/workouts/template")} hitSlop={6}>
            <Text style={{ color: colors.neon, fontSize: 14 }}>+ Template</Text>
          </Pressable>
        </View>
        <ErrorNote error={templates.error} />
        {templates.data?.length === 0 && (
          <Card>
            <Muted style={{ textAlign: "center" }}>
              Templates are workouts you repeat: Push Day, Leg Day, Shooting Drills. Make one here,
              or save a finished workout as a template.
            </Muted>
          </Card>
        )}
        {templates.data?.map((t) => (
          <Pressable key={t.id} onPress={() => setPreview(t)} accessibilityRole="button">
            <Card style={{ gap: 4 }}>
              <Text style={styles.template}>{t.name}</Text>
              <Muted numberOfLines={2}>
                {t.exercises.map((e) => names.get(e.exerciseId)?.name ?? "?").join(", ") ||
                  "No exercises"}
              </Muted>
              <Muted style={{ fontSize: 12, color: colors.court500 }}>
                Last done: {since(t.lastUsedAt)}
              </Muted>
            </Card>
          </Pressable>
        ))}
      </View>

      <SettingsGroup>
        <NavRow icon="clock" label="History" href="/workouts/history" />
        <NavRow icon="dumbbell" label="Exercises" href="/workouts/exercises" />
        <NavRow icon="figure" label="Body" href="/body" last />
      </SettingsGroup>

      <Sheet
        open={preview !== null}
        title={preview?.name ?? "Template"}
        onClose={() => setPreview(null)}
      >
        {preview && (
          <TemplatePreview
            template={preview}
            names={names}
            canStart={!inProgress}
            starting={start.isPending}
            error={start.error}
            onStart={() => begin(preview.id)}
            onClose={() => setPreview(null)}
          />
        )}
      </Sheet>
    </View>
  );
}

function TemplatePreview({
  template: t,
  names,
  canStart,
  starting,
  error,
  onStart,
  onClose,
}: {
  template: WorkoutTemplateDto;
  names: Map<string, ExerciseDto>;
  canStart: boolean;
  starting: boolean;
  error: unknown;
  onStart: () => void;
  onClose: () => void;
}) {
  const remove = useDeleteTemplate();
  return (
    <View style={{ gap: space.md }}>
      <Muted style={{ fontSize: 13 }}>Last done: {since(t.lastUsedAt)}</Muted>
      {t.notes ? <Body>{t.notes}</Body> : null}
      <Card style={{ gap: space.xs }}>
        {t.exercises.map((e, i) => (
          <View key={i} style={styles.line}>
            <Body style={{ flex: 1 }}>{names.get(e.exerciseId)?.name ?? "Unknown exercise"}</Body>
            <Muted>
              {e.sets.length} set{e.sets.length === 1 ? "" : "s"}
            </Muted>
          </View>
        ))}
        {t.exercises.length === 0 && <Muted>No exercises</Muted>}
      </Card>
      {!canStart && <Muted>Finish the workout in progress to start another.</Muted>}
      <ErrorNote error={error ?? remove.error} />
      <Button
        title={starting ? "Starting…" : "Start workout"}
        disabled={!canStart || starting}
        onPress={onStart}
      />
      <Button
        title="Edit template"
        variant="ghost"
        onPress={() => {
          onClose();
          router.push({ pathname: "/workouts/template", params: { id: t.id } });
        }}
      />
      <Button
        title="Delete template"
        variant="danger"
        onPress={() =>
          Alert.alert(`Delete "${t.name}"?`, "Past workouts from it are kept.", [
            { text: "Keep", style: "cancel" },
            {
              text: "Delete",
              style: "destructive",
              onPress: () => remove.mutate(t.id, { onSuccess: onClose }),
            },
          ])
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  resume: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    borderColor: colors.neon,
    backgroundColor: "rgba(60,242,200,0.08)",
  },
  inProgress: { color: colors.neon, fontSize: 12, letterSpacing: 1, textTransform: "uppercase" },
  resumeName: {
    color: colors.court100,
    fontFamily: fonts.heavy,
    fontSize: 24,
    textTransform: "uppercase",
  },
  resumeAction: {
    color: colors.neon,
    fontFamily: fonts.display,
    fontSize: 17,
    textTransform: "uppercase",
  },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  template: {
    color: colors.court100,
    fontFamily: fonts.display,
    fontSize: 18,
    textTransform: "uppercase",
  },
  line: { flexDirection: "row", gap: space.md, alignItems: "baseline" },
});
