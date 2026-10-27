import {
  emptySet,
  MAX_WORKOUT_EXERCISES,
  type ExerciseDto,
  type UnitSystem,
  type WorkoutExerciseDto,
  type WorkoutSetDto,
} from "@rlo/shared";
import { useState } from "react";
import { View } from "react-native";
import { Button, Card, Muted } from "@/components/ui";
import { space } from "@/lib/theme";
import { ExerciseBlock, type EditorMode } from "./ExerciseBlock";
import { ExercisePicker } from "./ExercisePicker";

/** The exercise list shared by live workouts, finished workouts and templates. */
export function WorkoutEditor({
  exercises,
  library,
  previous = {},
  units,
  mode,
  onChange,
  onSetDone,
}: {
  exercises: WorkoutExerciseDto[];
  library: ExerciseDto[];
  previous?: Record<string, WorkoutSetDto[]>;
  units: UnitSystem;
  mode: EditorMode;
  onChange: (next: WorkoutExerciseDto[]) => void;
  onSetDone?: () => void;
}) {
  const [picking, setPicking] = useState(false);
  const byId = new Map(library.map((e) => [e.id, e]));

  const add = (ids: string[]) => {
    setPicking(false);
    const added = ids.map((exerciseId): WorkoutExerciseDto => {
      // Start with as many sets as last time, so the "Previous" column lines up.
      const count = Math.max(1, previous[exerciseId]?.length ?? 1);
      return {
        exerciseId,
        notes: "",
        sets: Array.from({ length: count }, (_, i) => ({
          ...emptySet(previous[exerciseId]?.[i]?.kind ?? "normal"),
          done: mode === "log",
        })),
      };
    });
    onChange([...exercises, ...added].slice(0, MAX_WORKOUT_EXERCISES));
  };
  const move = (i: number, delta: -1 | 1) => {
    const next = [...exercises];
    const [item] = next.splice(i, 1);
    next.splice(i + delta, 0, item!);
    onChange(next);
  };

  return (
    <View style={{ gap: space.md }}>
      {exercises.map((e, i) => (
        <ExerciseBlock
          // Position plus id: the same exercise can appear twice.
          key={`${i}-${e.exerciseId}`}
          exercise={e}
          info={byId.get(e.exerciseId)}
          previous={previous[e.exerciseId]}
          units={units}
          mode={mode}
          first={i === 0}
          last={i === exercises.length - 1}
          onChange={(next) => onChange(exercises.map((x, j) => (j === i ? next : x)))}
          onRemove={() => onChange(exercises.filter((_, j) => j !== i))}
          onMove={(delta) => move(i, delta)}
          onSetDone={onSetDone}
        />
      ))}
      {exercises.length === 0 && (
        <Card style={{ borderStyle: "dashed" }}>
          <Muted style={{ textAlign: "center" }}>
            No exercises yet. Add lifts, runs, drills or anything else you train.
          </Muted>
        </Card>
      )}
      <Button
        title="+ Add exercises"
        variant="ghost"
        disabled={exercises.length >= MAX_WORKOUT_EXERCISES}
        onPress={() => setPicking(true)}
      />
      <ExercisePicker
        open={picking}
        exercises={library}
        onAdd={add}
        onClose={() => setPicking(false)}
      />
    </View>
  );
}
