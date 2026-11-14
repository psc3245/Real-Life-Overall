import {
  emptyBoxScore,
  finishTemplateOptions,
  formatDuration,
  hasBoxScore,
  templateChange,
  workoutVolume,
  type BoxScoreDto,
  type TemplateAction,
  type TemplateChange,
  type WorkoutDto,
  type WorkoutExerciseDto,
} from "@rlo/shared";
import { Redirect, router, Stack } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { usePreferences } from "@/api/preferences";
import { StatGrid, StatTile } from "@/components/StatTile";
import { BoxScoreFields } from "@/components/workouts/BoxScore";
import {
  useActiveWorkout,
  useDeleteWorkout,
  useExercises,
  useFinishWorkout,
  useSaveWorkout,
  useTemplates,
} from "@/api/workouts";
import { Sheet } from "@/components/Sheet";
import { Body, Button, Card, ErrorNote, Field, Loading, Muted, Screen } from "@/components/ui";
import { RestTimerBar, useRestTimer } from "@/components/workouts/RestTimer";
import { WorkoutEditor } from "@/components/workouts/WorkoutEditor";
import { colors, fonts, space } from "@/lib/theme";
import { formatElapsed, formatVolume, useUnits } from "@/lib/workouts";
import { FeatureGate } from "@/components/FeatureGate";

const AUTOSAVE_MS = 700;

/** The workout in progress. Every change autosaves; Finish keeps the checked-off sets. */
function ActiveWorkoutScreen() {
  const active = useActiveWorkout();
  if (active.isPending) return <Loading />;
  if (active.isError) {
    return (
      <Screen>
        <ErrorNote error={active.error} onRetry={() => void active.refetch()} />
      </Screen>
    );
  }
  // Finished or discarded (here or on another device): back to the training home.
  if (!active.data) return <Redirect href="/train" />;
  return <LiveWorkout key={active.data.id} workout={active.data} />;
}

interface Draft {
  name: string;
  notes: string;
  exercises: WorkoutExerciseDto[];
}

const draftOf = (w: WorkoutDto): Draft => ({
  name: w.name,
  notes: w.notes,
  exercises: w.exercises,
});
const sameDraft = (a: Draft, b: Draft) => JSON.stringify(a) === JSON.stringify(b);

function LiveWorkout({ workout }: { workout: WorkoutDto }) {
  const units = useUnits();
  const library = useExercises();
  const templates = useTemplates();
  const save = useSaveWorkout(workout.id);
  const finish = useFinishWorkout(workout.id);
  const cancel = useDeleteWorkout();
  const timer = useRestTimer();
  const [draft, setDraft] = useState<Draft>(() => draftOf(workout));
  const [dirty, setDirty] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [showNotes, setShowNotes] = useState(workout.notes !== "");
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const latest = useRef(draft);
  /** The server copy our own last save returned, so its echo isn't mistaken for a remote edit. */
  const lastSaved = useRef<Draft>(draftOf(workout));
  const saving = useRef(0);
  useEffect(() => () => clearTimeout(timerRef.current), []);

  // Another device edited this workout: adopt its copy, but only while nothing here is unsaved
  // or in flight (local edits win until they land; then the next refetch brings the merge).
  useEffect(() => {
    const server = draftOf(workout);
    if (dirty || saving.current > 0 || sameDraft(server, lastSaved.current)) return;
    if (sameDraft(server, latest.current)) return;
    lastSaved.current = server;
    latest.current = server;
    setDraft(server);
  }, [workout, dirty]);

  const chain = useRef<Promise<unknown>>(Promise.resolve());
  /** Saves run one after another so an older draft never lands after a newer one. */
  const persist = (changes: Draft) => {
    saving.current += 1;
    const run = chain.current.then(() =>
      // A blank name isn't sent; it resets on blur.
      save
        .mutateAsync({ ...changes, name: changes.name.trim() || undefined })
        .then((saved) => {
          lastSaved.current = draftOf(saved);
          if (latest.current === changes) setDirty(false);
        })
        .finally(() => (saving.current -= 1)),
    );
    chain.current = run.catch(() => undefined);
    return run;
  };
  const update = (changes: Partial<Draft>) => {
    const next = { ...latest.current, ...changes };
    latest.current = next;
    setDraft(next);
    setDirty(true);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => void persist(next), AUTOSAVE_MS);
  };
  /** Saves anything pending right away (before finishing). */
  const flush = async () => {
    clearTimeout(timerRef.current);
    if (dirty) await persist(latest.current);
    else await chain.current;
  };

  const sets = draft.exercises.flatMap((e) => e.sets);
  const doneSets = sets.filter((s) => s.done).length;
  const template = templates.data?.find((t) => t.id === workout.templateId);
  const change = template ? templateChange(template.exercises, draft.exercises) : "none";
  // The server's copy has "previous" for exercises added since the screen opened.
  const previous = save.data?.previous ?? workout.previous;

  const confirmCancel = () =>
    Alert.alert("Discard this workout?", "Nothing from it will be saved.", [
      { text: "Keep going", style: "cancel" },
      {
        text: "Discard",
        style: "destructive",
        onPress: () => {
          clearTimeout(timerRef.current);
          // Once it's gone the screen redirects back to training on its own.
          cancel.mutate(workout.id);
        },
      },
    ]);

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen
        options={{
          headerTitle: () => <Elapsed since={workout.startedAt} />,
          headerRight: () => (
            <Pressable
              accessibilityRole="button"
              hitSlop={8}
              disabled={finish.isPending}
              onPress={async () => {
                await flush().catch(() => undefined);
                setFinishing(true);
              }}
              style={styles.finish}
            >
              <Text style={styles.finishText}>Finish</Text>
            </Pressable>
          ),
        }}
      />
      <Screen>
        <View style={{ gap: space.xs }}>
          <Field
            accessibilityLabel="Workout name"
            value={draft.name}
            maxLength={80}
            onChangeText={(name) => update({ name })}
            onBlur={() => !draft.name.trim() && update({ name: workout.name })}
            style={styles.name}
          />
          <Text style={styles.status} accessibilityLiveRegion="polite">
            {save.isError ? "Not saved" : dirty || save.isPending ? "Saving…" : "Saved"}
          </Text>
          {showNotes ? (
            <Field
              accessibilityLabel="Workout notes"
              value={draft.notes}
              multiline
              maxLength={2000}
              placeholder="Notes for this workout"
              onChangeText={(notes) => update({ notes })}
              style={{ minHeight: 70 }}
            />
          ) : (
            <Pressable onPress={() => setShowNotes(true)} hitSlop={6}>
              <Muted>+ Add notes</Muted>
            </Pressable>
          )}
        </View>
        <ErrorNote error={save.error} />

        <WorkoutEditor
          exercises={draft.exercises}
          library={library.data ?? []}
          previous={previous}
          units={units}
          mode="live"
          defaultCategory={workout.kind === "sport" ? "sport" : undefined}
          onChange={(exercises) => update({ exercises })}
          onSetDone={(restS) => restS && timer.start(restS)}
        />

        <Button title="Cancel workout" variant="danger" onPress={confirmCancel} />
        <ErrorNote error={cancel.error} />
        {/* Room for the rest timer. */}
        <View style={{ height: 80 }} />
      </Screen>
      <RestTimerBar timer={timer} />

      <Sheet
        open={finishing}
        title={doneSets ? "Box score" : "Finish workout"}
        onClose={() => setFinishing(false)}
      >
        <FinishDialog
          doneSets={doneSets}
          skipped={sets.length - doneSets}
          startedAt={workout.startedAt}
          volumeKg={workoutVolume(draft.exercises)}
          prs={(save.data ?? workout).summary.prs.map((p) => p.label)}
          workoutName={draft.name.trim() || workout.name}
          templateName={template?.name ?? null}
          change={change}
          pending={finish.isPending}
          error={finish.error}
          onFinish={(options) =>
            finish.mutate(options, {
              onSuccess: (w) => {
                setFinishing(false);
                router.replace({
                  pathname: "/workouts/[id]",
                  params: { id: w.id, finished: "1" },
                });
              },
            })
          }
        />
      </Sheet>
    </View>
  );
}

function Elapsed({ since }: { since: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <Text style={styles.elapsed} accessibilityLabel="Elapsed time">
      {formatDuration((now - Date.parse(since)) / 1000)}
    </Text>
  );
}

function FinishDialog({
  doneSets,
  skipped,
  startedAt,
  volumeKg,
  prs,
  workoutName,
  templateName,
  change,
  pending,
  error,
  onFinish,
}: {
  doneSets: number;
  skipped: number;
  startedAt: string;
  volumeKg: number;
  prs: string[];
  workoutName: string;
  templateName: string | null;
  change: TemplateChange;
  pending: boolean;
  error: unknown;
  onFinish: (options: {
    template: TemplateAction;
    templateName?: string;
    boxScore?: BoxScoreDto;
  }) => void;
}) {
  const units = useUnits();
  const options = doneSets > 0 ? finishTemplateOptions(templateName, change) : [];
  const [action, setAction] = useState<TemplateAction>("none");
  const [name, setName] = useState(workoutName);
  const asked = usePreferences().boxScore;
  const [box, setBox] = useState<BoxScoreDto>(emptyBoxScore);
  const [elapsedS] = useState(() => (Date.now() - Date.parse(startedAt)) / 1000);
  return (
    <ScrollView
      contentContainerStyle={{ gap: space.lg, paddingBottom: space.xl }}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
    >
      {doneSets === 0 ? (
        <Body>Check off at least one set first. Tap ✓ on each set you did.</Body>
      ) : (
        <>
          <StatGrid>
            <StatTile label="Time" value={formatElapsed(elapsedS)} />
            <StatTile label="Sets" value={doneSets} />
            {volumeKg > 0 && <StatTile label="Volume" value={formatVolume(volumeKg, units)} />}
          </StatGrid>
          {prs.map((pr) => (
            <Muted key={pr} style={{ color: colors.neon }}>
              ★ {pr}
            </Muted>
          ))}
          {skipped > 0 && (
            <Muted>
              {skipped} unchecked set{skipped === 1 ? "" : "s"} will be left out.
            </Muted>
          )}
          {asked.length > 0 && (
            <Card style={{ gap: space.md }}>
              {/* A link would open Settings under this sheet, so it just says where. */}
              <Muted style={{ fontSize: 12 }}>
                All optional: from your watch or how it felt. Change what's asked in Settings.
              </Muted>
              <BoxScoreFields value={box} fields={asked} onChange={setBox} />
            </Card>
          )}
        </>
      )}
      {options.length > 0 && (
        <View
          style={{ gap: space.sm }}
          accessibilityRole="radiogroup"
          accessibilityLabel="Template"
        >
          <Muted style={styles.optionsLabel}>
            {templateName ? `You changed "${templateName}"` : "Make it a template?"}
          </Muted>
          {options.map((o) => {
            const selected = o.value === action;
            return (
              <Pressable
                key={o.value}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                onPress={() => setAction(o.value)}
              >
                <Card style={[styles.option, selected && styles.optionOn]}>
                  <View style={[styles.radio, selected && styles.radioOn]} />
                  <View style={{ flex: 1 }}>
                    <Body style={{ fontWeight: "600" }}>{o.label}</Body>
                    <Muted style={{ fontSize: 13 }}>{o.detail}</Muted>
                  </View>
                </Card>
              </Pressable>
            );
          })}
          {action === "new" && (
            <Field
              accessibilityLabel="Template name"
              value={name}
              maxLength={80}
              placeholder="Template name"
              onChangeText={setName}
            />
          )}
        </View>
      )}
      <ErrorNote error={error} />
      <Button
        title={pending ? "Finishing…" : "Finish"}
        disabled={doneSets === 0 || pending || (action === "new" && !name.trim())}
        onPress={() =>
          onFinish({
            template: action,
            ...(action === "new" && { templateName: name.trim() }),
            ...(hasBoxScore(box) && { boxScore: box }),
          })
        }
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  elapsed: { color: colors.neon, fontFamily: fonts.heavy, fontSize: 22 },
  finish: {
    backgroundColor: colors.neon,
    borderRadius: 8,
    paddingHorizontal: space.md,
    paddingVertical: 6,
  },
  finishText: {
    color: colors.court950,
    fontFamily: fonts.display,
    fontSize: 16,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  name: {
    backgroundColor: "transparent",
    borderWidth: 0,
    paddingHorizontal: 0,
    fontFamily: fonts.heavy,
    fontSize: 30,
    textTransform: "uppercase",
  },
  status: { color: colors.court500, fontSize: 11, letterSpacing: 1, textTransform: "uppercase" },
  optionsLabel: { fontSize: 12, letterSpacing: 1, textTransform: "uppercase" },
  option: { flexDirection: "row", alignItems: "center", gap: space.md },
  optionOn: { borderColor: colors.neon },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: colors.court500,
  },
  radioOn: { borderColor: colors.neon, backgroundColor: colors.neon },
});

export default function GatedActiveWorkoutScreen() {
  return (
    <FeatureGate feature="workouts">
      <ActiveWorkoutScreen />
    </FeatureGate>
  );
}
