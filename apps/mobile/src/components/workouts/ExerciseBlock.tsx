import {
  distanceUnit,
  emptySet,
  formatSet,
  MAX_SETS_PER_EXERCISE,
  SET_KIND_LABELS,
  SET_KIND_TAGS,
  SET_KINDS,
  TRACKING_FIELDS,
  weightUnit,
  type ExerciseDto,
  type SetField,
  type UnitSystem,
  type WorkoutExerciseDto,
  type WorkoutSetDto,
} from "@rlo/shared";
import { router } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useState } from "react";
import { ActionSheetIOS, Pressable, StyleSheet, Text, View } from "react-native";
import { Field } from "@/components/ui";
import { colors, fonts, space, tierColor } from "@/lib/theme";
import { displayValue, SetCell } from "./SetCell";

/**
 * live: a workout in progress (sets are checked off). log: a finished workout being edited
 * (every set counts as done). plan: a template (sets are targets).
 */
export type EditorMode = "live" | "log" | "plan";

const FIELD_KEY: Record<SetField, keyof WorkoutSetDto> = {
  weight: "weightKg",
  reps: "reps",
  duration: "durationS",
  distance: "distanceM",
  attempts: "attempts",
};

function fieldHeader(field: SetField, units: UnitSystem, makes: boolean) {
  switch (field) {
    case "weight":
      return weightUnit(units);
    case "reps":
      return makes ? "Makes" : "Reps";
    case "duration":
      return "Time";
    case "distance":
      return distanceUnit(units);
    case "attempts":
      return "Att.";
  }
}

const kindColor = (kind: WorkoutSetDto["kind"]) =>
  kind === "warmup"
    ? tierColor(65)
    : kind === "drop"
      ? "#9085e9"
      : kind === "failure"
        ? colors.flare
        : colors.court100;

export function ExerciseBlock({
  exercise,
  info,
  previous,
  units,
  mode,
  first,
  last,
  onChange,
  onRemove,
  onMove,
  onSetDone,
}: {
  exercise: WorkoutExerciseDto;
  info: ExerciseDto | undefined;
  previous?: WorkoutSetDto[];
  units: UnitSystem;
  mode: EditorMode;
  first: boolean;
  last: boolean;
  onChange: (next: WorkoutExerciseDto) => void;
  onRemove: () => void;
  onMove: (delta: -1 | 1) => void;
  /** live mode: a set was just checked off (starts the rest timer). */
  onSetDone?: () => void;
}) {
  const [showNotes, setShowNotes] = useState(exercise.notes !== "");
  const tracking = info?.tracking ?? "weight_reps";
  const fields = TRACKING_FIELDS[tracking];
  const makes = tracking === "makes_attempts";
  const name = info?.name ?? "Unknown exercise";

  const setAt = (i: number, changes: Partial<WorkoutSetDto>) =>
    onChange({
      ...exercise,
      sets: exercise.sets.map((s, j) => (j === i ? { ...s, ...changes } : s)),
    });
  const addSet = () => {
    const prior = exercise.sets.at(-1);
    const next: WorkoutSetDto = prior
      ? { ...prior, kind: prior.kind === "warmup" ? "normal" : prior.kind, done: mode === "log" }
      : { ...emptySet(), done: mode === "log" };
    onChange({ ...exercise, sets: [...exercise.sets, next] });
  };
  const removeSet = (i: number) =>
    onChange({ ...exercise, sets: exercise.sets.filter((_, j) => j !== i) });
  /** Copies a previous set's numbers into a set (empty fields only when checking off). */
  const fromPrevious = (i: number, onlyEmpty: boolean): Partial<WorkoutSetDto> => {
    const prev = previous?.[i];
    if (!prev) return {};
    const out: Partial<WorkoutSetDto> = {};
    for (const f of fields) {
      const key = FIELD_KEY[f];
      if (!onlyEmpty || exercise.sets[i]![key] === null) Object.assign(out, { [key]: prev[key] });
    }
    return out;
  };
  const toggleDone = (i: number) => {
    const done = !exercise.sets[i]!.done;
    setAt(i, { done, ...(done && fromPrevious(i, true)) });
    if (done) onSetDone?.();
  };

  /** Tapping a set's number picks its kind or deletes it. */
  const setMenu = (i: number) => {
    const options = [...SET_KINDS.map((k) => SET_KIND_LABELS[k]), "Delete set", "Cancel"];
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: `Set ${i + 1}`,
        options,
        destructiveButtonIndex: SET_KINDS.length,
        cancelButtonIndex: SET_KINDS.length + 1,
        userInterfaceStyle: "dark",
      },
      (index) => {
        if (index < SET_KINDS.length) setAt(i, { kind: SET_KINDS[index]! });
        else if (index === SET_KINDS.length) removeSet(i);
      },
    );
  };
  const exerciseMenu = () => {
    const actions = [
      { label: showNotes ? "Hide note" : "Add a note", run: () => setShowNotes((v) => !v) },
      ...(first ? [] : [{ label: "Move up", run: () => onMove(-1) }]),
      ...(last ? [] : [{ label: "Move down", run: () => onMove(1) }]),
      ...(info ? [{ label: "History and records", run: () => openExercise(info.id) }] : []),
      { label: "Remove exercise", run: onRemove },
    ];
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: name,
        options: [...actions.map((a) => a.label), "Cancel"],
        destructiveButtonIndex: actions.length - 1,
        cancelButtonIndex: actions.length,
        userInterfaceStyle: "dark",
      },
      (index) => actions[index]?.run(),
    );
  };

  let working = 0;
  const showPrevious = mode !== "plan";

  return (
    <View style={styles.block} accessibilityLabel={name}>
      <View style={styles.head}>
        <Pressable
          style={{ flex: 1 }}
          disabled={!info}
          onPress={() => info && openExercise(info.id)}
          accessibilityRole="link"
        >
          <Text style={[styles.name, !info && { color: colors.court300 }]} numberOfLines={1}>
            {name}
          </Text>
        </Pressable>
        <Pressable
          onPress={exerciseMenu}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={`${name} options`}
        >
          <SymbolView name="ellipsis.circle" tintColor={colors.court300} size={22} />
        </Pressable>
      </View>
      {showNotes && (
        <Field
          accessibilityLabel={`${name} notes`}
          value={exercise.notes}
          maxLength={500}
          placeholder="Notes (seat height, grip, how it felt…)"
          onChangeText={(notes) => onChange({ ...exercise, notes })}
          style={{ fontSize: 14, paddingVertical: 8 }}
        />
      )}

      <View style={styles.row}>
        <Text style={[styles.header, styles.setCol]}>Set</Text>
        {showPrevious && <Text style={[styles.header, styles.prevCol]}>Previous</Text>}
        {fields.map((f) => (
          <Text key={f} style={[styles.header, styles.fieldCol]}>
            {fieldHeader(f, units, makes)}
          </Text>
        ))}
        {mode === "live" && <Text style={[styles.header, styles.doneCol]}>✓</Text>}
      </View>
      {exercise.sets.map((s, i) => {
        if (s.kind !== "warmup") working += 1;
        const prev = previous?.[i];
        const done = mode === "live" && s.done;
        return (
          <View key={i} style={[styles.row, styles.setRow, done && styles.doneRow]}>
            <Pressable
              onPress={() => setMenu(i)}
              accessibilityRole="button"
              accessibilityLabel={`Set ${i + 1}: ${SET_KIND_LABELS[s.kind]}. Change or delete`}
              style={[styles.setCol, styles.setNumber]}
            >
              <Text style={[styles.setText, { color: kindColor(s.kind) }]}>
                {s.kind === "normal" ? working : SET_KIND_TAGS[s.kind]}
              </Text>
            </Pressable>
            {showPrevious && (
              <Pressable
                disabled={!prev}
                onPress={() => setAt(i, fromPrevious(i, false))}
                accessibilityHint={prev ? "Use these numbers" : undefined}
                style={styles.prevCol}
              >
                <Text style={styles.prevText} numberOfLines={1}>
                  {prev ? formatSet(tracking, prev, units) : "—"}
                </Text>
              </Pressable>
            )}
            {fields.map((f) => (
              <View key={f} style={styles.fieldCol}>
                <SetCell
                  field={f}
                  value={s[FIELD_KEY[f]] as number | null}
                  units={units}
                  label={`Set ${i + 1} ${fieldHeader(f, units, makes)}`}
                  placeholder={
                    prev ? displayValue(f, prev[FIELD_KEY[f]] as number | null, units) : undefined
                  }
                  onChange={(v) => setAt(i, { [FIELD_KEY[f]]: v })}
                />
              </View>
            ))}
            {mode === "live" && (
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: s.done }}
                accessibilityLabel={`Set ${i + 1} done`}
                onPress={() => toggleDone(i)}
                style={[styles.doneCol, styles.check, s.done && styles.checkOn]}
              >
                <SymbolView
                  name="checkmark"
                  tintColor={s.done ? colors.court950 : colors.court500}
                  size={16}
                  weight="bold"
                />
              </Pressable>
            )}
          </View>
        );
      })}
      <Pressable
        onPress={addSet}
        disabled={exercise.sets.length >= MAX_SETS_PER_EXERCISE}
        style={({ pressed }) => [styles.addSet, pressed && { opacity: 0.6 }]}
        accessibilityRole="button"
      >
        <Text style={styles.addSetText}>+ Add set</Text>
      </Pressable>
    </View>
  );
}

const openExercise = (id: string) =>
  router.push({ pathname: "/workouts/exercises/[id]", params: { id } });

const styles = StyleSheet.create({
  block: {
    gap: space.sm,
    backgroundColor: colors.court900,
    borderColor: colors.court700,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: space.md,
  },
  head: { flexDirection: "row", alignItems: "center", gap: space.sm },
  name: {
    color: colors.neon,
    fontFamily: fonts.display,
    fontSize: 18,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  row: { flexDirection: "row", alignItems: "center", gap: 6 },
  setRow: { borderRadius: 8, paddingVertical: 2, paddingHorizontal: 2 },
  doneRow: { backgroundColor: "rgba(60,242,200,0.12)" },
  header: {
    color: colors.court500,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
    textAlign: "center",
  },
  setCol: { width: 34 },
  prevCol: { flex: 1.2, minWidth: 0 },
  fieldCol: { flex: 1, minWidth: 0, flexDirection: "row" },
  doneCol: { width: 38 },
  setNumber: {
    backgroundColor: colors.court800,
    borderRadius: 7,
    paddingVertical: 7,
    alignItems: "center",
  },
  setText: { fontWeight: "700", fontSize: 15 },
  prevText: { color: colors.court500, fontSize: 13 },
  check: {
    height: 34,
    borderRadius: 7,
    backgroundColor: colors.court800,
    alignItems: "center",
    justifyContent: "center",
  },
  checkOn: { backgroundColor: colors.neon },
  addSet: {
    backgroundColor: colors.court800,
    borderRadius: 9,
    paddingVertical: 9,
    alignItems: "center",
  },
  addSetText: { color: colors.court100, fontSize: 15, fontWeight: "500" },
});
