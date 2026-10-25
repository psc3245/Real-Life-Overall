import {
  emptySet,
  type ExerciseDto,
  type WorkoutExerciseDto,
  type WorkoutSetDto,
} from "@rlo/shared";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { ExerciseBlock, type EditorMode } from "./ExerciseBlock";

const bench: ExerciseDto = {
  id: "bench-press-barbell",
  name: "Bench Press (Barbell)",
  category: "chest",
  tracking: "weight_reps",
  custom: false,
  timesDone: 1,
  lastDone: "2026-10-20",
};
const set = (over: Partial<WorkoutSetDto> = {}): WorkoutSetDto => ({ ...emptySet(), ...over });

function renderBlock(exercise: WorkoutExerciseDto, mode: EditorMode = "live") {
  const onChange = vi.fn();
  const onSetDone = vi.fn();
  render(
    <MemoryRouter>
      <ExerciseBlock
        exercise={exercise}
        info={bench}
        previous={[set({ weightKg: 61.235, reps: 8, done: true })]}
        units="imperial"
        mode={mode}
        first
        last
        onChange={onChange}
        onRemove={vi.fn()}
        onMove={vi.fn()}
        onSetDone={onSetDone}
      />
    </MemoryRouter>,
  );
  return { onChange, onSetDone };
}

describe("ExerciseBlock", () => {
  it("shows last time's set and fills empty fields from it when checked off", () => {
    const { onChange, onSetDone } = renderBlock({
      exerciseId: bench.id,
      notes: "",
      sets: [set()],
    });
    expect(screen.getByText("135 lb × 8")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox", { name: "Set 1 done" }));
    expect(onSetDone).toHaveBeenCalled();
    const next = onChange.mock.lastCall![0] as WorkoutExerciseDto;
    expect(next.sets[0]).toMatchObject({ done: true, weightKg: 61.235, reps: 8 });
  });

  it("converts typed weights to kg and cycles set kinds", () => {
    const { onChange } = renderBlock({ exerciseId: bench.id, notes: "", sets: [set()] });
    fireEvent.change(screen.getByLabelText("Set 1 lb"), { target: { value: "225" } });
    const typed = onChange.mock.lastCall![0] as WorkoutExerciseDto;
    expect(typed.sets[0]!.weightKg).toBeCloseTo(102.06, 2);

    fireEvent.click(screen.getByRole("cell", { name: "Set 1: Normal" }));
    expect((onChange.mock.lastCall![0] as WorkoutExerciseDto).sets[0]!.kind).toBe("warmup");
  });

  it("adds sets that copy the last one, without check boxes in templates", () => {
    const { onChange } = renderBlock(
      { exerciseId: bench.id, notes: "", sets: [set({ weightKg: 100, reps: 5 })] },
      "plan",
    );
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(screen.queryByText("Previous")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "+ Add set" }));
    const next = onChange.mock.lastCall![0] as WorkoutExerciseDto;
    expect(next.sets).toHaveLength(2);
    expect(next.sets[1]).toMatchObject({ weightKg: 100, reps: 5, done: false });
  });
});
