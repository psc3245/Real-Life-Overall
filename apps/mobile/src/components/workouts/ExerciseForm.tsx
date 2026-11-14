import {
  availableRecords,
  CATEGORY_LABELS,
  defaultHeadline,
  displaySetValue,
  EXERCISE_CATEGORIES,
  EXERCISE_STATS,
  formatSet,
  MAX_STATS,
  PRESET_LABELS,
  RECORD_LABELS,
  SET_FIELD_KEYS,
  setFieldHeader,
  SPORT_LABELS,
  SPORTS,
  STAT_DETAILS,
  STAT_LABELS,
  STAT_PRESET_KEYS,
  STAT_PRESETS,
  statClash,
  statFields,
  type ExerciseCategory,
  type ExerciseDto,
  type ExerciseStat,
  type RecordKey,
  type Sport,
  type WorkoutSetDto,
} from "@rlo/shared";
import { SymbolView } from "expo-symbols";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useCreateExercise, useUpdateExercise, type ExerciseInput } from "@/api/workouts";
import { Chip, FormRow } from "@/components/controls";
import { Button, ErrorNote, Field, Muted } from "@/components/ui";
import { haptics } from "@/lib/haptics";
import { colors, space } from "@/lib/theme";
import { useUnits } from "@/lib/workouts";

/** The stat picker shows one Distance chip; ft/m vs mi/km is a toggle on the picked row. */
const PICKABLE = EXERCISE_STATS.filter((s) => s !== "length");

/** A sample set for the preview, in stored units (round numbers in lb and ft). */
const SAMPLE: WorkoutSetDto = {
  kind: "normal",
  weightKg: 45.36,
  reps: 8,
  durationS: 45,
  distanceM: 30.48,
  attempts: 10,
  inclinePct: 6,
  heightCm: 61,
  level: 8,
  rpe: 7,
  done: true,
};
const SAMPLE_LONG = { ...SAMPLE, distanceM: 4828, durationS: 1500 };

/**
 * Builds an exercise from its stat line: what each set records (weight, distance, time,
 * incline…), in column order, and the record that scores it. Creates one, or edits a custom one.
 */
export function ExerciseForm({
  initialName = "",
  exercise,
  onSaved,
}: {
  initialName?: string;
  /** A custom exercise to edit; omitted to create one. */
  exercise?: ExerciseDto;
  onSaved: (e: ExerciseDto) => void;
}) {
  const create = useCreateExercise();
  const update = useUpdateExercise(exercise?.id ?? "");
  const save = exercise ? update : create;
  const units = useUnits();
  const [name, setName] = useState(exercise?.name ?? initialName);
  const [category, setCategory] = useState<ExerciseCategory>(exercise?.category ?? "other");
  const [sport, setSport] = useState<Sport | null>(exercise?.sport ?? null);
  const [stats, setStats] = useState<ExerciseStat[]>(exercise?.stats ?? ["weight", "reps"]);
  const [picked, setPicked] = useState<RecordKey | null>(exercise?.headline ?? null);
  const [note, setNote] = useState("");

  const options = availableRecords(stats);
  const headline = picked && options.includes(picked) ? picked : defaultHeadline(stats);
  const fields = statFields(stats);
  const sample = stats.includes("distance") ? SAMPLE_LONG : SAMPLE;
  const has = (s: ExerciseStat) =>
    stats.includes(s) || (s === "distance" && stats.includes("length"));

  const add = (stat: ExerciseStat) => {
    setNote("");
    if (stats.length >= MAX_STATS) return setNote(`Up to ${MAX_STATS} stats per exercise.`);
    // Lifts, carries and jumps measure short distances; cardio defaults to miles or km.
    const next = stat === "distance" && category !== "cardio" ? "length" : stat;
    const clash = statClash(stats, next);
    if (clash) {
      return setNote(`${STAT_LABELS[next]} and ${STAT_LABELS[clash]} share a column; pick one.`);
    }
    setStats([...stats, next]);
    haptics.tap();
  };
  const remove = (i: number) => {
    setNote("");
    setStats(stats.filter((_, j) => j !== i));
    haptics.remove();
  };
  const move = (i: number, delta: -1 | 1) => {
    const next = [...stats];
    [next[i], next[i + delta]] = [next[i + delta]!, next[i]!];
    setStats(next);
    haptics.tap();
  };
  const toggleScale = (i: number) =>
    setStats(stats.map((s, j) => (j === i ? (s === "length" ? "distance" : "length") : s)));
  const usePreset = (key: keyof typeof STAT_PRESETS) => {
    setNote("");
    setStats([...STAT_PRESETS[key]]);
    setPicked(null);
  };
  const submit = () => {
    if (!stats.length) return setNote("Pick at least one stat.");
    const input: ExerciseInput = {
      name: name.trim(),
      category,
      stats,
      headline,
      sport: category === "sport" ? sport : null,
    };
    save.mutate(input, { onSuccess: onSaved });
  };

  return (
    <ScrollView
      contentContainerStyle={{ gap: space.lg, paddingBottom: space.xl }}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
    >
      <FormRow label="Name">
        <Field
          value={name}
          autoFocus={!exercise}
          maxLength={60}
          placeholder="Hill farmer's walk"
          onChangeText={setName}
        />
      </FormRow>
      <FormRow label="Category">
        <View style={styles.wrap}>
          {EXERCISE_CATEGORIES.map((c) => (
            <Chip
              key={c}
              label={CATEGORY_LABELS[c]}
              selected={category === c}
              onPress={() => setCategory(c)}
            />
          ))}
        </View>
      </FormRow>
      {category === "sport" && (
        <FormRow label="Sport">
          <View style={styles.wrap}>
            <Chip label="Any sport" selected={sport === null} onPress={() => setSport(null)} />
            {SPORTS.map((s) => (
              <Chip
                key={s}
                label={SPORT_LABELS[s]}
                selected={sport === s}
                onPress={() => setSport(s)}
              />
            ))}
          </View>
        </FormRow>
      )}

      <FormRow label={`Stat line · up to ${MAX_STATS}`}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: space.xs, alignItems: "center" }}
        >
          <Muted style={{ fontSize: 12 }}>Start from</Muted>
          {STAT_PRESET_KEYS.map((k) => (
            <Chip key={k} label={PRESET_LABELS[k]} selected={false} onPress={() => usePreset(k)} />
          ))}
        </ScrollView>
        <View style={{ gap: space.xs, marginTop: space.xs }}>
          {stats.map((s, i) => (
            <View key={s} style={styles.statRow}>
              <Text style={styles.statIndex}>{i + 1}</Text>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.statName}>{s === "length" ? "Distance" : STAT_LABELS[s]}</Text>
                <Muted style={{ fontSize: 12 }} numberOfLines={1}>
                  {s === "length"
                    ? "Short: feet or meters"
                    : s === "distance"
                      ? "Long: miles or km"
                      : STAT_DETAILS[s]}
                </Muted>
              </View>
              {(s === "length" || s === "distance") && (
                <Pressable
                  onPress={() => toggleScale(i)}
                  accessibilityRole="button"
                  accessibilityLabel="Switch between short and long distances"
                  style={styles.scale}
                >
                  <Text style={styles.scaleText}>
                    {setFieldHeader(s, units, false)} · {s === "length" ? "short" : "long"}
                  </Text>
                </Pressable>
              )}
              <IconButton
                name="chevron.up"
                label={`Move ${STAT_LABELS[s]} up`}
                disabled={i === 0}
                onPress={() => move(i, -1)}
              />
              <IconButton
                name="chevron.down"
                label={`Move ${STAT_LABELS[s]} down`}
                disabled={i === stats.length - 1}
                onPress={() => move(i, 1)}
              />
              <IconButton
                name="xmark"
                label={`Remove ${STAT_LABELS[s]}`}
                onPress={() => remove(i)}
              />
            </View>
          ))}
          {stats.length === 0 && <Muted style={styles.empty}>Add a stat below</Muted>}
        </View>
        {stats.length < MAX_STATS && (
          <View style={[styles.wrap, { marginTop: space.xs }]}>
            {PICKABLE.filter((s) => !has(s)).map((s) => (
              <Chip key={s} label={`+ ${STAT_LABELS[s]}`} selected={false} onPress={() => add(s)} />
            ))}
          </View>
        )}
        {note ? <Text style={styles.note}>{note}</Text> : null}
      </FormRow>

      {stats.length > 0 && (
        <FormRow label="Preview">
          <View style={styles.preview}>
            <View style={{ flexDirection: "row", gap: space.xs }}>
              <Text style={[styles.previewHead, { width: 30 }]}>Set</Text>
              {fields.map((f) => (
                <Text key={f} style={[styles.previewHead, { flex: 1 }]} numberOfLines={1}>
                  {setFieldHeader(f, units, stats.includes("makes"))}
                </Text>
              ))}
            </View>
            <View style={{ flexDirection: "row", gap: space.xs }}>
              <Text style={[styles.previewCell, { width: 30 }]}>1</Text>
              {fields.map((f) => (
                <Text key={f} style={[styles.previewCell, { flex: 1 }]} numberOfLines={1}>
                  {displaySetValue(f, (sample[SET_FIELD_KEYS[f]] as number | null) ?? null, units)}
                </Text>
              ))}
            </View>
            <Muted style={{ fontSize: 12 }}>
              In history: {formatSet({ stats }, sample, units)}
            </Muted>
          </View>
        </FormRow>
      )}

      {stats.length > 0 && (
        <FormRow label="Scored by">
          <View style={styles.wrap}>
            {options.map((k) => (
              <Chip
                key={k}
                label={k === "fastestS" ? `${RECORD_LABELS[k]} (lower wins)` : RECORD_LABELS[k]}
                selected={headline === k}
                onPress={() => setPicked(k)}
              />
            ))}
          </View>
          <Muted style={{ fontSize: 12 }}>
            Sets its personal record, chart and each session's best set.
          </Muted>
        </FormRow>
      )}

      <ErrorNote error={save.error} />
      <Button
        title={save.isPending ? "Saving…" : exercise ? "Save changes" : "Create exercise"}
        disabled={!name.trim() || !stats.length || save.isPending}
        onPress={submit}
      />
    </ScrollView>
  );
}

function IconButton({
  name,
  label,
  disabled,
  onPress,
}: {
  name: "chevron.up" | "chevron.down" | "xmark";
  label: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{ padding: 4, opacity: disabled ? 0.3 : 1 }}
    >
      <SymbolView
        name={name}
        size={14}
        tintColor={name === "xmark" ? colors.flare : colors.court300}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: space.xs },
  statRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    borderWidth: 1,
    borderColor: colors.court700,
    backgroundColor: colors.court900,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: space.sm,
  },
  statIndex: { width: 16, textAlign: "center", color: colors.court500, fontSize: 12 },
  statName: { color: colors.court100, fontSize: 15 },
  scale: {
    borderWidth: 1,
    borderColor: colors.court700,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  scaleText: { color: colors.court300, fontSize: 12 },
  empty: {
    textAlign: "center",
    padding: space.md,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.court700,
    borderRadius: 10,
  },
  note: { color: "#ff9f1c", fontSize: 12, marginTop: space.xs },
  previewCell: {
    color: colors.court300,
    fontSize: 14,
    textAlign: "center",
    backgroundColor: colors.court800,
    borderRadius: 6,
    paddingVertical: 4,
    overflow: "hidden",
    fontVariant: ["tabular-nums"],
  },
  preview: { backgroundColor: colors.court900, borderRadius: 10, padding: space.sm, gap: 4 },
  previewHead: {
    color: colors.court500,
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 1,
    textTransform: "uppercase",
    textAlign: "center",
  },
});
