import { formatDuration, type WorkoutDto, type WorkoutExerciseDto } from "@rlo/shared";
import { useEffect, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router";
import {
  useActiveWorkout,
  useDeleteWorkout,
  useExercises,
  useFinishWorkout,
  useSaveWorkout,
  useTemplates,
} from "../../api/workouts";
import { Button } from "../../components/Button";
import { Modal } from "../../components/Modal";
import { ErrorNote } from "../onboarding/ErrorNote";
import { RestTimerBar, useRestTimer } from "./RestTimer";
import { WorkoutEditor } from "./WorkoutEditor";
import { useUnits } from "./WorkoutsNav";

const AUTOSAVE_MS = 700;

/** The workout in progress. Every change autosaves; Finish keeps the checked-off sets. */
export function ActiveWorkoutPage() {
  const active = useActiveWorkout();
  if (active.isPending) return <p className="pt-10 text-court-500">Loading…</p>;
  if (active.isError) return <ErrorNote error={active.error} />;
  if (!active.data) return <Navigate to="/workouts" replace />;
  return <LiveWorkout key={active.data.id} workout={active.data} />;
}

interface Draft {
  name: string;
  notes: string;
  exercises: WorkoutExerciseDto[];
}

function LiveWorkout({ workout }: { workout: WorkoutDto }) {
  const units = useUnits();
  const library = useExercises();
  const templates = useTemplates();
  const save = useSaveWorkout(workout.id);
  const finish = useFinishWorkout(workout.id);
  const cancel = useDeleteWorkout();
  const navigate = useNavigate();
  const timer = useRestTimer();
  const [draft, setDraft] = useState<Draft>({
    name: workout.name,
    notes: workout.notes,
    exercises: workout.exercises,
  });
  const [dirty, setDirty] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [showNotes, setShowNotes] = useState(workout.notes !== "");
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const latest = useRef(draft);
  useEffect(() => () => clearTimeout(timerRef.current), []);

  const chain = useRef<Promise<unknown>>(Promise.resolve());
  /** Saves run one after another so an older draft never lands after a newer one. */
  const persist = (changes: Draft) => {
    const run = chain.current.then(() =>
      // A blank name isn't sent; it resets on blur.
      save.mutateAsync({ ...changes, name: changes.name.trim() || undefined }).then(() => {
        if (latest.current === changes) setDirty(false);
      }),
    );
    chain.current = run.catch(() => undefined);
    return run;
  };
  const update = (changes: Partial<Draft>) => {
    const next = { ...latest.current, ...changes };
    latest.current = next;
    setDraft(next);
    setDirty(true);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => void persist(next), AUTOSAVE_MS);
  };
  /** Saves anything pending right away (before finishing). */
  const flush = async () => {
    clearTimeout(timerRef.current);
    if (dirty) await persist(latest.current);
    else await chain.current;
  };

  const sets = draft.exercises.flatMap((e) => e.sets);
  const doneSets = sets.filter((s) => s.done).length;
  const template = templates.data?.find((t) => t.id === workout.templateId);
  // The server's copy has "previous" for exercises added since the page loaded.
  const previous = save.data?.previous ?? workout.previous;

  return (
    <div className="space-y-6 pt-4 pb-24">
      <header className="sticky top-0 z-10 -mx-4 flex items-center justify-between gap-3 border-b border-court-800 bg-court-950/90 px-4 py-3 backdrop-blur">
        <div className="min-w-0">
          <Elapsed since={workout.startedAt} />
          <p aria-live="polite" className="text-xs uppercase tracking-wider text-court-500">
            {save.isError ? "Not saved" : dirty || save.isPending ? "Saving…" : "Saved"}
          </p>
        </div>
        <Button
          variant="primary"
          disabled={finish.isPending}
          onClick={async () => {
            await flush().catch(() => undefined);
            setFinishing(true);
          }}
        >
          Finish
        </Button>
      </header>

      <div className="space-y-2">
        <input
          aria-label="Workout name"
          value={draft.name}
          maxLength={80}
          onChange={(e) => update({ name: e.target.value })}
          onBlur={() => !draft.name.trim() && update({ name: workout.name })}
          className="w-full bg-transparent font-display text-3xl font-bold uppercase outline-none focus:text-neon md:text-4xl"
        />
        {showNotes ? (
          <textarea
            aria-label="Workout notes"
            value={draft.notes}
            rows={2}
            maxLength={2000}
            placeholder="Notes for this workout"
            onChange={(e) => update({ notes: e.target.value })}
            className="w-full rounded-lg border border-court-700 bg-court-900/70 p-3 text-sm outline-none focus:border-neon"
          />
        ) : (
          <button
            type="button"
            onClick={() => setShowNotes(true)}
            className="text-sm text-court-500 hover:text-neon"
          >
            + Add notes
          </button>
        )}
      </div>
      <ErrorNote error={save.error} />

      <WorkoutEditor
        exercises={draft.exercises}
        library={library.data ?? []}
        previous={previous}
        units={units}
        mode="live"
        onChange={(exercises) => update({ exercises })}
        onSetDone={timer.start}
      />

      <div className="pt-4 text-center">
        {confirmCancel ? (
          <span className="flex flex-wrap items-center justify-center gap-2 text-sm text-court-300">
            Discard this workout?
            <Button
              variant="danger"
              disabled={cancel.isPending}
              onClick={() => {
                clearTimeout(timerRef.current);
                cancel.mutate(workout.id, { onSuccess: () => navigate("/workouts") });
              }}
            >
              Yes, discard
            </Button>
            <Button variant="ghost" onClick={() => setConfirmCancel(false)}>
              Keep going
            </Button>
          </span>
        ) : (
          <Button variant="danger" onClick={() => setConfirmCancel(true)}>
            Cancel workout
          </Button>
        )}
        <ErrorNote error={cancel.error} />
      </div>

      <RestTimerBar timer={timer} />

      <Modal open={finishing} onClose={() => setFinishing(false)} label="Finish workout">
        <FinishDialog
          doneSets={doneSets}
          skipped={sets.length - doneSets}
          templateName={template?.name ?? null}
          pending={finish.isPending}
          error={finish.error}
          onCancel={() => setFinishing(false)}
          onFinish={(updateTemplate) =>
            finish.mutate(
              { updateTemplate },
              {
                onSuccess: (w) => navigate(`/workouts/${w.id}`, { state: { justFinished: true } }),
              },
            )
          }
        />
      </Modal>
    </div>
  );
}

function Elapsed({ since }: { since: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <p className="font-display text-2xl tabular-nums text-neon" aria-label="Elapsed time">
      {formatDuration((now - Date.parse(since)) / 1000)}
    </p>
  );
}

function FinishDialog({
  doneSets,
  skipped,
  templateName,
  pending,
  error,
  onCancel,
  onFinish,
}: {
  doneSets: number;
  skipped: number;
  templateName: string | null;
  pending: boolean;
  error: unknown;
  onCancel: () => void;
  onFinish: (updateTemplate: boolean) => void;
}) {
  const [updateTemplate, setUpdateTemplate] = useState(false);
  return (
    <div className="space-y-4">
      <h2 className="font-display text-2xl uppercase">Finish workout?</h2>
      {doneSets === 0 ? (
        <p className="text-sm text-court-300">
          Check off at least one set first. Tap ✓ on each set you did.
        </p>
      ) : (
        <p className="text-sm text-court-300">
          {doneSets} set{doneSets === 1 ? "" : "s"} done.
          {skipped > 0 && ` ${skipped} unchecked set${skipped === 1 ? "" : "s"} will be left out.`}
        </p>
      )}
      {templateName && doneSets > 0 && (
        <label className="flex cursor-pointer gap-3 rounded-lg border border-court-700 px-4 py-3">
          <input
            type="checkbox"
            checked={updateTemplate}
            onChange={(e) => setUpdateTemplate(e.target.checked)}
            className="mt-1 accent-[var(--color-neon)]"
          />
          <span>
            <span className="block font-medium">Update "{templateName}"</span>
            <span className="block text-sm text-court-500">
              Save today's exercises, sets and numbers as the template.
            </span>
          </span>
        </label>
      )}
      <ErrorNote error={error} />
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel}>
          Keep going
        </Button>
        <Button
          variant="primary"
          disabled={doneSets === 0 || pending}
          onClick={() => onFinish(updateTemplate)}
        >
          {pending ? "Finishing…" : "Finish"}
        </Button>
      </div>
    </div>
  );
}
