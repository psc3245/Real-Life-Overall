import type { ExerciseCategory } from "@rlo/shared";
import { router } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useExercises } from "@/api/workouts";
import { Sheet } from "@/components/Sheet";
import { Button, Card, ErrorNote, Field, Loading, Muted, Screen } from "@/components/ui";
import {
  CategoryChips,
  exerciseDetail,
  filterExercises,
  NewExerciseForm,
} from "@/components/workouts/ExercisePicker";
import { colors, space } from "@/lib/theme";
import { since } from "@/lib/workouts";
import { FeatureGate } from "@/components/FeatureGate";

/** The exercise library: built-ins plus custom ones, with how often each was done. */
function ExercisesScreen() {
  const exercises = useExercises();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<ExerciseCategory | null>(null);
  const [creating, setCreating] = useState(false);
  const shown = filterExercises(exercises.data ?? [], query, category);

  if (exercises.isPending) return <Loading title="Exercises" />;
  return (
    <Screen eyebrow="Training" title="Exercises" onRefresh={() => exercises.refetch()}>
      <Button title="+ New exercise" variant="ghost" onPress={() => setCreating(true)} />
      <Field
        accessibilityLabel="Search exercises"
        value={query}
        placeholder="Search"
        onChangeText={setQuery}
        clearButtonMode="while-editing"
        autoCorrect={false}
      />
      <CategoryChips value={category} onChange={setCategory} />
      <ErrorNote error={exercises.error} />
      <Card style={{ padding: 0 }}>
        {shown.map((e, i) => (
          <Pressable
            key={e.id}
            onPress={() =>
              router.push({ pathname: "/workouts/exercises/[id]", params: { id: e.id } })
            }
            style={({ pressed }) => [
              styles.row,
              i > 0 && styles.border,
              pressed && { opacity: 0.6 },
            ]}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.name} numberOfLines={1}>
                {e.name}
              </Text>
              <Muted style={{ fontSize: 12 }}>{exerciseDetail(e)}</Muted>
            </View>
            {e.timesDone > 0 && (
              <View style={{ alignItems: "flex-end" }}>
                <Text style={{ color: colors.court300, fontSize: 13 }}>{e.timesDone}×</Text>
                <Muted style={{ fontSize: 12 }}>{since(e.lastDone)}</Muted>
              </View>
            )}
            <SymbolView name="chevron.right" tintColor={colors.court500} size={13} />
          </Pressable>
        ))}
        {shown.length === 0 && (
          <Muted style={{ textAlign: "center", padding: space.lg }}>No matches.</Muted>
        )}
      </Card>
      <Sheet open={creating} title="New exercise" onClose={() => setCreating(false)}>
        <NewExerciseForm initialName={query} onCreated={() => setCreating(false)} />
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  border: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.court800 },
  name: { color: colors.court100, fontSize: 16 },
});

export default function GatedExercisesScreen() {
  return (
    <FeatureGate feature="workouts">
      <ExercisesScreen />
    </FeatureGate>
  );
}
