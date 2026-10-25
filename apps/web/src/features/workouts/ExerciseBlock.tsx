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
import { useState } from "react";
import { Link } from "react-router";
import { displayValue, SetCell } from "./SetInputs";

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

const KIND_STYLE: Record<WorkoutSetDto["kind"], string> = {
  normal: "text-court-100",
  warmup: "text-tier-orange",
  drop: "text-[#9085e9]",
  failure: "text-flare",
};

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
  const cycleKind = (i: number) => {
    const kind = exercise.sets[i]!.kind;
    setAt(i, { kind: SET_KINDS[(SET_KINDS.indexOf(kind) + 1) % SET_KINDS.length]! });
  };
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

  let working = 0;
  const showPrevious = mode !== "plan";
  const columns = [
    "2.25rem",
    showPrevious && "minmax(4.5rem,1fr)",
    ...fields.map(() => "minmax(3.5rem,7rem)"),
    mode === "live" && "2.5rem",
    "1.75rem",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <section
      aria-label={name}
      className="space-y-2 rounded-xl border border-court-700 bg-court-900/70 p-3 sm:p-4"
    >
      <div className="flex items-center justify-between gap-2">
        {info ? (
          <Link
            to={`/workouts/exercises/${info.id}`}
            className="min-w-0 truncate font-display text-lg uppercase tracking-wide text-neon hover:underline"
          >
            {name}
          </Link>
        ) : (
          <span className="font-display text-lg uppercase text-court-300">{name}</span>
        )}
        <div className="flex shrink-0 items-center gap-1 text-court-500">
          <button
            type="button"
            onClick={() => setShowNotes((v) => !v)}
            className="rounded px-1.5 text-xs uppercase tracking-wider hover:text-neon"
          >
            Note
          </button>
          <button
            type="button"
            aria-label={`Move ${name} up`}
            disabled={first}
            onClick={() => onMove(-1)}
            className="rounded px-1.5 hover:text-neon disabled:opacity-30"
          >
            ↑
          </button>
          <button
            type="button"
            aria-label={`Move ${name} down`}
            disabled={last}
            onClick={() => onMove(1)}
            className="rounded px-1.5 hover:text-neon disabled:opacity-30"
          >
            ↓
          </button>
          <button
            type="button"
            aria-label={`Remove ${name}`}
            onClick={onRemove}
            className="rounded px-1.5 hover:text-flare"
          >
            ✕
          </button>
        </div>
      </div>
      {showNotes && (
        <input
          aria-label={`${name} notes`}
          value={exercise.notes}
          maxLength={500}
          placeholder="Notes (seat height, grip, how it felt…)"
          onChange={(e) => onChange({ ...exercise, notes: e.target.value })}
          className="w-full rounded-md border border-court-700 bg-court-950 px-3 py-1.5 text-sm outline-none focus:border-neon"
        />
      )}

      <div role="table" aria-label={`${name} sets`} className="space-y-1 text-sm">
        <div
          role="row"
          className="grid items-center gap-1.5 px-1 text-[11px] font-semibold uppercase tracking-wider text-court-500"
          style={{ gridTemplateColumns: columns }}
        >
          <span role="columnheader" className="text-center">
            Set
          </span>
          {showPrevious && <span role="columnheader">Previous</span>}
          {fields.map((f) => (
            <span key={f} role="columnheader" className="text-center">
              {fieldHeader(f, units, makes)}
            </span>
          ))}
          {mode === "live" && (
            <span role="columnheader" className="text-center">
              ✓
            </span>
          )}
          <span />
        </div>
        {exercise.sets.map((s, i) => {
          if (s.kind !== "warmup") working += 1;
          const prev = previous?.[i];
          const done = mode === "live" && s.done;
          return (
            <div
              key={i}
              role="row"
              className={`grid items-center gap-1.5 rounded-lg px-1 py-0.5 transition ${done ? "bg-neon/12" : ""}`}
              style={{ gridTemplateColumns: columns }}
            >
              <button
                type="button"
                role="cell"
                title={`${SET_KIND_LABELS[s.kind]} (click to change)`}
                aria-label={`Set ${i + 1}: ${SET_KIND_LABELS[s.kind]}`}
                onClick={() => cycleKind(i)}
                className={`rounded-md bg-court-800 py-1.5 text-center font-semibold ${KIND_STYLE[s.kind]}`}
              >
                {s.kind === "normal" ? working : SET_KIND_TAGS[s.kind]}
              </button>
              {showPrevious && (
                <button
                  type="button"
                  role="cell"
                  disabled={!prev}
                  title={prev ? "Use these numbers" : undefined}
                  onClick={() => setAt(i, fromPrevious(i, false))}
                  className="truncate text-left text-court-500 enabled:hover:text-court-100"
                >
                  {prev ? formatSet(tracking, prev, units) : "—"}
                </button>
              )}
              {fields.map((f) => (
                <span key={f} role="cell">
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
                </span>
              ))}
              {mode === "live" && (
                <span role="cell" className="flex justify-center">
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={s.done}
                    aria-label={`Set ${i + 1} done`}
                    onClick={() => toggleDone(i)}
                    className={`flex h-8 w-8 items-center justify-center rounded-md text-base font-bold transition ${s.done ? "bg-neon text-court-950" : "bg-court-800 text-court-500 hover:text-neon"}`}
                  >
                    ✓
                  </button>
                </span>
              )}
              <button
                type="button"
                role="cell"
                aria-label={`Delete set ${i + 1}`}
                onClick={() => removeSet(i)}
                className="text-court-500 hover:text-flare"
              >
                ✕
              </button>
            </div>
          );
        })}
      </div>
      <button
        type="button"
        onClick={addSet}
        disabled={exercise.sets.length >= MAX_SETS_PER_EXERCISE}
        className="w-full rounded-lg bg-court-800 py-1.5 text-sm font-medium text-court-100 hover:bg-court-700 disabled:opacity-40"
      >
        + Add set
      </button>
    </section>
  );
}
