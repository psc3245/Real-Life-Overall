import {
  CATEGORY_LABELS,
  EXERCISE_CATEGORIES,
  SPORT_LABELS,
  statLineLabel,
  type ExerciseCategory,
  type ExerciseDto,
} from "@rlo/shared";
import { SymbolView } from "expo-symbols";
import { useState } from "react";
import { Pressable, ScrollView, SectionList, StyleSheet, Text, View } from "react-native";
import { Chip } from "@/components/controls";
import { Sheet } from "@/components/Sheet";
import { Button, Field, Muted } from "@/components/ui";
import { colors, space } from "@/lib/theme";
import { ExerciseForm } from "./ExerciseForm";

/** Filters the library by text and category; shared by the picker and the Exercises screen. */
export function filterExercises(
  exercises: ExerciseDto[],
  query: string,
  category: ExerciseCategory | null,
) {
  const q = query.trim().toLowerCase();
  return exercises.filter(
    (e) => (!category || e.category === category) && (!q || e.name.toLowerCase().includes(q)),
  );
}

/** A sideways-scrolling row of category filters. */
export function CategoryChips({
  value,
  onChange,
}: {
  value: ExerciseCategory | null;
  onChange: (c: ExerciseCategory | null) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: space.xs }}
      style={{ flexGrow: 0 }}
    >
      <Chip label="All" selected={value === null} onPress={() => onChange(null)} />
      {EXERCISE_CATEGORIES.map((c) => (
        <Chip
          key={c}
          label={CATEGORY_LABELS[c]}
          selected={value === c}
          onPress={() => onChange(value === c ? null : c)}
        />
      ))}
    </ScrollView>
  );
}

export const exerciseDetail = (e: ExerciseDto) =>
  `${e.sport ? SPORT_LABELS[e.sport] : CATEGORY_LABELS[e.category]} · ${statLineLabel(e.stats)}${e.custom ? " · custom" : ""}`;

/** Picks one or more exercises to add, or creates a custom one. */
export function ExercisePicker({
  open,
  exercises,
  initialCategory = null,
  onAdd,
  onClose,
}: {
  open: boolean;
  exercises: ExerciseDto[];
  /** Opens filtered to this category (sport practices start on Sport & skill). */
  initialCategory?: ExerciseCategory | null;
  onAdd: (ids: string[]) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<ExerciseCategory | null>(initialCategory);
  const [picked, setPicked] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const shown = filterExercises(exercises, query, category);
  // Recently used first, then alphabetical (the list arrives sorted by name).
  const recent =
    query || category
      ? []
      : [...exercises]
          .filter((e) => e.lastDone)
          .sort((a, b) => b.lastDone!.localeCompare(a.lastDone!))
          .slice(0, 5);
  const sections = [
    ...(recent.length ? [{ title: "Recent", data: recent }] : []),
    { title: recent.length ? "All exercises" : "", data: shown },
  ];
  const close = () => {
    setPicked([]);
    setQuery("");
    setCreating(false);
    onClose();
  };

  const toggle = (id: string) =>
    setPicked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  return (
    <Sheet
      open={open}
      title={creating ? "New exercise" : "Add exercises"}
      onClose={close}
      action={
        creating
          ? undefined
          : {
              label: picked.length ? `Add (${picked.length})` : "Add",
              disabled: !picked.length,
              onPress: () => {
                onAdd(picked);
                setPicked([]);
                setQuery("");
              },
            }
      }
    >
      {creating ? (
        <View style={{ flex: 1, gap: space.md }}>
          <ExerciseForm
            initialName={query}
            onSaved={(e) => {
              setCreating(false);
              setPicked((prev) => [...prev, e.id]);
              setQuery("");
            }}
          />
          <Button title="Back to the list" variant="ghost" onPress={() => setCreating(false)} />
        </View>
      ) : (
        <>
          <Field
            accessibilityLabel="Search exercises"
            value={query}
            placeholder="Search"
            onChangeText={setQuery}
            clearButtonMode="while-editing"
            autoCorrect={false}
          />
          <CategoryChips value={category} onChange={setCategory} />
          <SectionList
            sections={sections}
            keyExtractor={(e, i) => `${e.id}-${i}`}
            keyboardShouldPersistTaps="handled"
            stickySectionHeadersEnabled={false}
            renderSectionHeader={({ section }) =>
              section.title ? <Text style={styles.sectionHead}>{section.title}</Text> : null
            }
            renderItem={({ item: e }) => {
              const on = picked.includes(e.id);
              return (
                <Pressable
                  onPress={() => toggle(e.id)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  style={[styles.row, on && styles.rowOn]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.rowName, on && { color: colors.neon }]} numberOfLines={1}>
                      {e.name}
                    </Text>
                    <Muted style={{ fontSize: 12 }}>{exerciseDetail(e)}</Muted>
                  </View>
                  {on && <SymbolView name="checkmark" tintColor={colors.neon} size={16} />}
                </Pressable>
              );
            }}
            ListFooterComponent={
              <View style={{ paddingVertical: space.lg, gap: space.sm }}>
                {shown.length === 0 && <Muted style={{ textAlign: "center" }}>No matches.</Muted>}
                <Button
                  variant="ghost"
                  title={query.trim() ? `Create "${query.trim()}"` : "+ New exercise"}
                  onPress={() => setCreating(true)}
                />
              </View>
            }
          />
        </>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  sectionHead: {
    color: colors.court500,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: "uppercase",
    paddingTop: space.md,
    paddingBottom: space.xs,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingVertical: 10,
    paddingHorizontal: space.sm,
    borderRadius: 10,
  },
  rowOn: { backgroundColor: "rgba(60,242,200,0.1)" },
  rowName: { color: colors.court100, fontSize: 16 },
});
