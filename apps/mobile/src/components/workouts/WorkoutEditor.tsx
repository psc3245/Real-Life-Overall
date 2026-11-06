import {
  emptySet,
  MAX_WORKOUT_EXERCISES,
  type ExerciseDto,
  type UnitSystem,
  type WorkoutExerciseDto,
  type WorkoutSetDto,
} from "@rlo/shared";
import { useContext, useRef, useState } from "react";
import {
  Keyboard,
  PanResponder,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type GestureResponderEvent,
  type ViewInstance,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button, Card, Muted, ScrollLockContext } from "@/components/ui";
import { colors, fonts, space } from "@/lib/theme";
import { ExerciseBlock, type EditorMode } from "./ExerciseBlock";
import { ExercisePicker } from "./ExercisePicker";

/** Row height in the reorder list. */
const ROW = 48;

interface Drag {
  from: number;
  /** Where the finger was when the title was held (window y). */
  startY: number;
  /** The reorder list's top, relative to the editor. */
  top: number;
  /** How far the finger has moved since. */
  dy: number;
}

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
  onSetDone?: (restS: number | null) => void;
}) {
  const [picking, setPicking] = useState(false);
  const byId = new Map(library.map((e) => [e.id, e]));
  const lockScroll = useContext(ScrollLockContext);
  const window = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const container = useRef<ViewInstance>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  // The gesture handlers are made once, so they read the latest values through refs.
  const dragRef = useRef(drag);
  dragRef.current = drag;
  const grabbed = useRef(false);
  const latest = useRef({ exercises, onChange });
  latest.current = { exercises, onChange };

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
  const move = (i: number, delta: -1 | 1) => moveTo(exercises, onChange, i, i + delta);

  /**
   * Holding a title turns the exercises into a short list of names, placed so the held one is
   * under the finger; dragging moves it through the others and letting go drops it there.
   */
  const hold = (from: number, e: GestureResponderEvent) => {
    const startY = e.nativeEvent.pageY;
    Keyboard.dismiss();
    container.current?.measureInWindow((_x, y) => {
      const height = exercises.length * ROW;
      const wanted = startY - from * ROW - ROW / 2;
      const highest = insets.top + 60;
      const lowest = window.height - insets.bottom - space.md - height;
      const listY = Math.max(highest, Math.min(wanted, lowest));
      grabbed.current = false;
      lockScroll(true);
      setDrag({ from, startY, top: listY - y, dy: 0 });
    });
  };
  const endDrag = () => {
    const d = dragRef.current;
    if (!d) return;
    const { exercises: list, onChange: change } = latest.current;
    const to = hoverIndex(d, list.length);
    if (to !== d.from) moveTo(list, change, d.from, to);
    grabbed.current = false;
    lockScroll(false);
    setDrag(null);
  };
  const pan = useRef(
    PanResponder.create({
      // Takes over the touch from the held title as soon as it moves.
      onMoveShouldSetPanResponderCapture: () => dragRef.current !== null,
      onPanResponderGrant: () => (grabbed.current = true),
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_, g) => {
        const d = dragRef.current;
        if (d) setDrag({ ...d, dy: g.moveY - d.startY });
      },
      onPanResponderRelease: endDrag,
      onPanResponderTerminate: endDrag,
    }),
  ).current;

  return (
    <View ref={container} style={{ gap: space.md }} {...pan.panHandlers}>
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
          onHoldTitle={exercises.length > 1 ? (ev) => hold(i, ev) : undefined}
          // Let go without dragging: put the list away.
          onReleaseTitle={() => !grabbed.current && endDrag()}
          onSetDone={onSetDone}
          dimmed={drag !== null}
        />
      ))}
      {drag && (
        <ReorderList
          names={exercises.map((e) => byId.get(e.exerciseId)?.name ?? "Unknown exercise")}
          drag={drag}
        />
      )}
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

function moveTo(
  list: WorkoutExerciseDto[],
  onChange: (next: WorkoutExerciseDto[]) => void,
  from: number,
  to: number,
) {
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item!);
  onChange(next);
}

const hoverIndex = (d: Drag, count: number) =>
  Math.max(0, Math.min(count - 1, d.from + Math.round(d.dy / ROW)));

/** The names of the exercises while one is being dragged through them. */
function ReorderList({ names, drag }: { names: string[]; drag: Drag }) {
  const to = hoverIndex(drag, names.length);
  const heldTop = Math.max(0, Math.min((names.length - 1) * ROW, drag.from * ROW + drag.dy));
  let slot = 0;
  return (
    <View style={[styles.reorder, { top: drag.top, height: names.length * ROW }]}>
      {names.map((name, i) => {
        if (i === drag.from) return null;
        if (slot === to) slot += 1;
        const top = slot * ROW;
        slot += 1;
        return (
          <View key={i} style={[styles.reorderRow, { top }]}>
            <Text style={styles.reorderName} numberOfLines={1}>
              {name}
            </Text>
          </View>
        );
      })}
      <View style={[styles.reorderRow, styles.held, { top: heldTop }]}>
        <Text style={[styles.reorderName, { color: colors.neon }]} numberOfLines={1}>
          {names[drag.from]}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  reorder: { position: "absolute", left: 0, right: 0, zIndex: 10, pointerEvents: "none" },
  reorderRow: {
    position: "absolute",
    left: 0,
    right: 0,
    height: ROW - 6,
    justifyContent: "center",
    paddingHorizontal: space.md,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.court700,
    backgroundColor: colors.court900,
  },
  held: {
    borderColor: colors.neon,
    backgroundColor: colors.court800,
    shadowColor: "#000",
    shadowOpacity: 0.6,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    transform: [{ scale: 1.03 }],
  },
  reorderName: {
    color: colors.court100,
    fontFamily: fonts.display,
    fontSize: 17,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
});
