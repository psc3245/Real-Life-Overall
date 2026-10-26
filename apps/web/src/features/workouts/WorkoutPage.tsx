import {
  formatSet,
  SET_KIND_TAGS,
  type ExerciseDto,
  type UnitSystem,
  type WorkoutDto,
  type WorkoutExerciseDto,
} from "@rlo/shared";
import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate, useParams } from "react-router";
import {
  useCreateTemplate,
  useDeleteWorkout,
  useExercises,
  useSaveWorkout,
  useWorkout,
} from "../../api/workouts";
import { Button } from "../../components/Button";
import { compactFieldClass } from "../../components/form";
import { StatTile } from "../../components/StatTile";
import { longDate } from "../../lib/format";
import { ErrorNote } from "../onboarding/ErrorNote";
import { formatElapsed, formatVolume } from "./format";
import { WorkoutEditor } from "./WorkoutEditor";
import { useUnits, WorkoutsNav } from "./WorkoutsNav";
import { DebugId, DebugJson } from "../../components/debug/Debug";

/** A finished workout: summary, records, and editing. */
export function WorkoutPage() {
  const { id = "" } = useParams();
  const workout = useWorkout(id);
  if (workout.isPending) return <p className="pt-10 text-court-500">Loading…</p>;
  if (workout.isError) return <ErrorNote error={workout.error} />;
  if (!workout.data.endedAt) return <Navigate to="/workouts/active" replace />;
  return <FinishedWorkout workout={workout.data} />;
}

function FinishedWorkout({ workout: w }: { workout: WorkoutDto }) {
  const units = useUnits();
  const library = useExercises();
  const byId = new Map((library.data ?? []).map((e) => [e.id, e]));
  const location = useLocation();
  const justFinished = (location.state as { justFinished?: boolean } | null)?.justFinished;
  const [editing, setEditing] = useState(false);

  return (
    <div className="space-y-6 pt-4">
      <header className="space-y-4">
        <WorkoutsNav />
        {justFinished && (
          <p className="rounded-xl border border-neon/50 bg-neon/10 px-4 py-3 text-neon">
            Workout complete. It's on that day's log and counts toward its recap.
          </p>
        )}
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-neon">{longDate(w.localDate)}</p>
          <h1 className="font-display text-4xl font-bold uppercase md:text-5xl">
            {w.name}
            <DebugId id={w.id} />
          </h1>
        </div>
      </header>

      <dl className="grid grid-cols-3 gap-3">
        <StatTile label="Time" value={formatElapsed(w.summary.durationS)} />
        <StatTile
          label="Volume"
          value={w.summary.volumeKg > 0 ? formatVolume(w.summary.volumeKg, units) : "—"}
        />
        <StatTile label="Sets" value={w.summary.doneSets} />
      </dl>

      {w.summary.prs.length > 0 && (
        <section className="space-y-2 rounded-xl border border-tier-yellow/40 bg-tier-yellow/5 p-4">
          <h2 className="font-display text-lg uppercase tracking-wider text-tier-yellow">
            ★ Personal records
          </h2>
          <ul className="space-y-1 text-sm">
            {w.summary.prs.map((pr) => (
              <li key={pr.exerciseId}>
                <Link to={`/workouts/exercises/${pr.exerciseId}`} className="hover:text-neon">
                  {pr.label}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {editing ? (
        <EditWorkout workout={w} library={library.data ?? []} onDone={() => setEditing(false)} />
      ) : (
        <>
          {w.notes && <p className="whitespace-pre-wrap text-court-300">{w.notes}</p>}
          <div className="space-y-3">
            {w.exercises.map((e, i) => (
              <ExerciseSummary key={i} exercise={e} info={byId.get(e.exerciseId)} units={units} />
            ))}
          </div>
          <Actions workout={w} onEdit={() => setEditing(true)} />
          <DebugJson label="workout (WorkoutDto)" data={w} />
        </>
      )}
    </div>
  );
}

function ExerciseSummary({
  exercise: e,
  info,
  units,
}: {
  exercise: WorkoutExerciseDto;
  info?: ExerciseDto;
  units: UnitSystem;
}) {
  let working = 0;
  return (
    <section className="rounded-xl border border-court-700 bg-court-900/70 p-4">
      {info ? (
        <Link
          to={`/workouts/exercises/${info.id}`}
          className="font-display text-lg uppercase tracking-wide text-neon hover:underline"
        >
          {info.name}
        </Link>
      ) : (
        <p className="font-display text-lg uppercase text-court-300">Unknown exercise</p>
      )}
      {e.notes && <p className="text-sm text-court-500">{e.notes}</p>}
      <ol className="mt-2 space-y-0.5 text-sm tabular-nums">
        {e.sets.map((s, i) => {
          if (s.kind !== "warmup") working += 1;
          return (
            <li key={i} className="flex gap-3">
              <span className="w-6 text-center font-semibold text-court-500">
                {s.kind === "normal" ? working : SET_KIND_TAGS[s.kind]}
              </span>
              <span>{info ? formatSet(info.tracking, s, units) : "—"}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function Actions({ workout: w, onEdit }: { workout: WorkoutDto; onEdit: () => void }) {
  const createTemplate = useCreateTemplate();
  const remove = useDeleteWorkout();
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);
  return (
    <div className="space-y-3 border-t border-court-800 pt-4">
      <div className="flex flex-wrap gap-2">
        <Button onClick={onEdit}>Edit workout</Button>
        <Button
          disabled={createTemplate.isPending || createTemplate.isSuccess}
          onClick={() => createTemplate.mutate({ fromWorkoutId: w.id })}
        >
          {createTemplate.isSuccess ? "Saved as a template ✓" : "Save as template"}
        </Button>
        {confirming ? (
          <span className="flex items-center gap-1 text-sm text-court-300">
            Delete this workout?
            <Button
              variant="danger"
              disabled={remove.isPending}
              onClick={() =>
                remove.mutate(w.id, { onSuccess: () => navigate("/workouts/history") })
              }
            >
              Yes, delete
            </Button>
            <Button variant="ghost" onClick={() => setConfirming(false)}>
              Keep
            </Button>
          </span>
        ) : (
          <Button variant="danger" onClick={() => setConfirming(true)}>
            Delete
          </Button>
        )}
      </div>
      <ErrorNote error={createTemplate.error ?? remove.error} />
    </div>
  );
}

function EditWorkout({
  workout: w,
  library,
  onDone,
}: {
  workout: WorkoutDto;
  library: ExerciseDto[];
  onDone: () => void;
}) {
  const units = useUnits();
  const save = useSaveWorkout(w.id);
  const [name, setName] = useState(w.name);
  const [notes, setNotes] = useState(w.notes);
  const [localDate, setLocalDate] = useState(w.localDate);
  const [minutes, setMinutes] = useState(Math.max(1, Math.round(w.summary.durationS / 60)));
  const [exercises, setExercises] = useState(w.exercises);
  const label = "block text-xs uppercase tracking-wider text-court-300";

  return (
    <form
      aria-label="Edit workout"
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate(
          {
            name: name.trim() || w.name,
            notes,
            localDate,
            durationS: Math.max(60, minutes * 60),
            // Every set of a finished workout counts as done.
            exercises: exercises
              .map((x) => ({ ...x, sets: x.sets.map((s) => ({ ...s, done: true })) }))
              .filter((x) => x.sets.length > 0),
          },
          { onSuccess: onDone },
        );
      }}
    >
      <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
        <label className="space-y-1">
          <span className={label}>Name</span>
          <input
            value={name}
            maxLength={80}
            onChange={(e) => setName(e.target.value)}
            className={`${compactFieldClass} w-full`}
          />
        </label>
        <label className="space-y-1">
          <span className={label}>Day</span>
          <input
            type="date"
            value={localDate}
            required
            onChange={(e) => setLocalDate(e.target.value)}
            className={compactFieldClass}
          />
        </label>
        <label className="space-y-1">
          <span className={label}>Minutes</span>
          <input
            type="number"
            min={1}
            value={minutes}
            onChange={(e) => setMinutes(Number(e.target.value) || 1)}
            className={`${compactFieldClass} w-24`}
          />
        </label>
      </div>
      <label className="block space-y-1">
        <span className={label}>Notes</span>
        <textarea
          value={notes}
          rows={2}
          maxLength={2000}
          onChange={(e) => setNotes(e.target.value)}
          className={`${compactFieldClass} w-full`}
        />
      </label>
      <WorkoutEditor
        exercises={exercises}
        library={library}
        units={units}
        mode="log"
        previous={w.previous}
        onChange={setExercises}
      />
      <ErrorNote error={save.error} />
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabled={save.isPending}>
          {save.isPending ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
