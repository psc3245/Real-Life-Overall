import {
  distanceUnit,
  formatDuration,
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
import { Pressable, StyleSheet, Text, View, type GestureResponderEvent } from "react-native";
import { Field } from "@/components/ui";
import { colors, fonts, space, tierColor } from "@/lib/theme";
import { PopMenu, usePopAnchor, type PopOption } from "./PopMenu";
import { REST_CHOICES } from "./RestTimer";
import { displayValue, SetCell } from "./SetCell";
import { SwipeRow } from "./SwipeRow";

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
  onHoldTitle,
  onReleaseTitle,
  onSetDone,
  dimmed,
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
  /** The title was held: start dragging this exercise to a new place. */
  onHoldTitle?: (e: GestureResponderEvent) => void;
  onReleaseTitle?: () => void;
  /** Another exercise is being dragged over this one. */
  dimmed?: boolean;
  /** live mode: a set was just checked off (starts this exercise's rest timer, if it has one). */
  onSetDone?: (restS: number | null) => void;
}) {
  const [showNotes, setShowNotes] = useState(exercise.notes !== "");
  const menu = usePopAnchor();
  const [menuPage, setMenuPage] = useState<"main" | "rest">("main");
  const restS = exercise.restS ?? null;
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
    if (done) onSetDone?.(restS);
  };

  // Finished workouts don't rest, so their menu has no rest timer.
  const mainOptions: PopOption[] = [
    { label: showNotes ? "Hide note" : "Add a note", onPress: () => setShowNotes((v) => !v) },
    ...(mode === "log"
      ? []
      : [
          {
            label: `Rest timer: ${restS ? formatDuration(restS) : "Off"}`,
            onPress: () => setMenuPage("rest"),
            keepOpen: true,
          },
        ]),
    ...(info ? [{ label: "History and records", onPress: () => openExercise(info.id) }] : []),
    { label: "Remove exercise", onPress: onRemove, destructive: true },
  ];
  const restOptions: PopOption[] = [null, ...REST_CHOICES].map((r) => ({
    label: r ? formatDuration(r) : "Off",
    selected: r === restS,
    onPress: () => onChange({ ...exercise, restS: r }),
  }));

  let working = 0;
  const showPrevious = mode !== "plan";

  return (
    <View style={[styles.block, dimmed && { opacity: 0.15 }]} accessibilityLabel={name}>
      <View style={styles.head}>
        <Pressable
          style={{ flex: 1 }}
          onPress={() => info && openExercise(info.id)}
          onLongPress={onHoldTitle}
          onPressOut={onReleaseTitle}
          delayLongPress={300}
          accessibilityRole="link"
          accessibilityHint="Hold to reorder"
          accessibilityActions={[
            ...(first ? [] : [{ name: "moveUp", label: "Move up" }]),
            ...(last ? [] : [{ name: "moveDown", label: "Move down" }]),
          ]}
          onAccessibilityAction={(e) => {
            if (e.nativeEvent.actionName === "moveUp") onMove(-1);
            if (e.nativeEvent.actionName === "moveDown") onMove(1);
          }}
        >
          <Text style={[styles.name, !info && { color: colors.court300 }]} numberOfLines={1}>
            {name}
          </Text>
        </Pressable>
        {restS !== null && mode !== "log" && (
          <Text style={styles.rest} accessibilityLabel={`Rest ${formatDuration(restS)}`}>
            {formatDuration(restS)}
          </Text>
        )}
        <Pressable
          ref={menu.ref}
          onPress={() => {
            setMenuPage("main");
            menu.open();
          }}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={`${name} options`}
        >
          <SymbolView name="ellipsis.circle" tintColor={colors.court300} size={22} />
        </Pressable>
        <PopMenu
          anchor={menu.anchor}
          title={menuPage === "rest" ? "Rest after each set" : undefined}
          options={menuPage === "rest" ? restOptions : mainOptions}
          columns={menuPage === "rest" ? 3 : 1}
          onClose={menu.close}
        />
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
          <SwipeRow
            key={i}
            label={`set ${i + 1}`}
            onDelete={() => removeSet(i)}
            style={[styles.row, styles.setRow, done && styles.doneRow]}
          >
            <SetNumber
              index={i}
              kind={s.kind}
              text={s.kind === "normal" ? String(working) : SET_KIND_TAGS[s.kind]}
              onKind={(kind) => setAt(i, { kind })}
            />
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
          </SwipeRow>
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

/** A set's number; tapping it pops up the set kinds. */
function SetNumber({
  index,
  kind,
  text,
  onKind,
}: {
  index: number;
  kind: WorkoutSetDto["kind"];
  text: string;
  onKind: (kind: WorkoutSetDto["kind"]) => void;
}) {
  const menu = usePopAnchor();
  return (
    <>
      <Pressable
        ref={menu.ref}
        onPress={menu.open}
        accessibilityRole="button"
        accessibilityLabel={`Set ${index + 1}: ${SET_KIND_LABELS[kind]}. Change kind`}
        style={[styles.setCol, styles.setNumber]}
      >
        <Text style={[styles.setText, { color: kindColor(kind) }]}>{text}</Text>
      </Pressable>
      <PopMenu
        anchor={menu.anchor}
        title={`Set ${index + 1}`}
        options={SET_KINDS.map((k) => ({
          label: SET_KIND_LABELS[k],
          color: kindColor(k),
          selected: k === kind,
          onPress: () => onKind(k),
        }))}
        onClose={menu.close}
      />
    </>
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
  rest: { color: colors.court300, fontSize: 13, fontVariant: ["tabular-nums"] },
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
