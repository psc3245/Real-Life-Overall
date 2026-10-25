import type { ExerciseDto, WorkoutTemplateDto } from "@rlo/shared";
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import {
  useActiveWorkout,
  useDeleteTemplate,
  useExercises,
  useStartWorkout,
  useTemplates,
} from "../../api/workouts";
import { Button } from "../../components/Button";
import { Modal } from "../../components/Modal";
import { ErrorNote } from "../onboarding/ErrorNote";
import { since } from "./format";
import { WorkoutsNav } from "./WorkoutsNav";

/** Start a workout: resume the one in progress, start empty, or start from a template. */
export function StartWorkoutPage() {
  const active = useActiveWorkout();
  const templates = useTemplates();
  const exercises = useExercises();
  const start = useStartWorkout();
  const navigate = useNavigate();
  const [preview, setPreview] = useState<WorkoutTemplateDto | null>(null);
  const names = new Map((exercises.data ?? []).map((e) => [e.id, e]));

  const begin = (templateId?: string) =>
    start.mutate(templateId ? { templateId } : {}, {
      onSuccess: () => navigate("/workouts/active"),
    });
  const inProgress = active.data;

  return (
    <div className="space-y-8 pt-4">
      <header className="space-y-4">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-neon">Training</p>
          <h1 className="font-display text-4xl font-bold uppercase md:text-5xl">Workout</h1>
        </div>
        <WorkoutsNav />
      </header>

      {inProgress ? (
        <Link
          to="/workouts/active"
          className="flex items-center justify-between gap-4 rounded-xl border border-neon bg-neon/10 p-5 hover:bg-neon/15"
        >
          <span>
            <span className="block text-xs uppercase tracking-wider text-neon">In progress</span>
            <span className="font-display text-2xl uppercase">{inProgress.name}</span>
          </span>
          <span className="font-display text-lg uppercase text-neon">Resume →</span>
        </Link>
      ) : (
        <section className="space-y-3">
          <h2 className="font-display text-xl uppercase tracking-wider">Quick start</h2>
          <Button
            variant="primary"
            className="w-full py-3 text-base"
            disabled={start.isPending}
            onClick={() => begin()}
          >
            {start.isPending ? "Starting…" : "Start an empty workout"}
          </Button>
        </section>
      )}
      <ErrorNote error={start.error} />

      <section className="space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-display text-xl uppercase tracking-wider">
            Templates{" "}
            {templates.data && templates.data.length > 0 && (
              <span className="text-court-500">({templates.data.length})</span>
            )}
          </h2>
          <Link to="/workouts/templates/new" className="text-sm text-neon hover:underline">
            + Template
          </Link>
        </div>
        {templates.isPending && <p className="text-court-500">Loading…</p>}
        <ErrorNote error={templates.error} />
        {templates.data?.length === 0 && (
          <p className="rounded-xl border border-dashed border-court-700 p-6 text-center text-court-500">
            Templates are workouts you repeat: Push Day, Leg Day, Shooting Drills. Make one here, or
            save a finished workout as a template.
          </p>
        )}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {templates.data?.map((t) => (
            <TemplateCard key={t.id} template={t} names={names} onOpen={() => setPreview(t)} />
          ))}
        </div>
      </section>

      <Modal open={preview !== null} onClose={() => setPreview(null)} label="Template">
        {preview && (
          <TemplatePreview
            template={preview}
            names={names}
            canStart={!inProgress}
            starting={start.isPending}
            onStart={() => begin(preview.id)}
            onClose={() => setPreview(null)}
          />
        )}
      </Modal>
    </div>
  );
}

function TemplateCard({
  template: t,
  names,
  onOpen,
}: {
  template: WorkoutTemplateDto;
  names: Map<string, ExerciseDto>;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="space-y-2 rounded-xl border border-court-700 bg-court-900/70 p-4 text-left hover:border-neon"
    >
      <span className="block font-display text-lg uppercase tracking-wide">{t.name}</span>
      <span className="line-clamp-3 block text-sm text-court-300">
        {t.exercises.map((e) => names.get(e.exerciseId)?.name ?? "?").join(", ") || "No exercises"}
      </span>
      <span className="block text-xs text-court-500">Last done: {since(t.lastUsedAt)}</span>
    </button>
  );
}

function TemplatePreview({
  template: t,
  names,
  canStart,
  starting,
  onStart,
  onClose,
}: {
  template: WorkoutTemplateDto;
  names: Map<string, ExerciseDto>;
  canStart: boolean;
  starting: boolean;
  onStart: () => void;
  onClose: () => void;
}) {
  const remove = useDeleteTemplate();
  const [confirming, setConfirming] = useState(false);
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl uppercase">{t.name}</h2>
          <p className="text-xs text-court-500">Last done: {since(t.lastUsedAt)}</p>
        </div>
        <Link to={`/workouts/templates/${t.id}`} className="text-sm text-neon hover:underline">
          Edit
        </Link>
      </div>
      {t.notes && <p className="text-sm text-court-300">{t.notes}</p>}
      <ul className="space-y-1.5">
        {t.exercises.map((e, i) => (
          <li key={i} className="flex justify-between gap-3 text-sm">
            <span>{names.get(e.exerciseId)?.name ?? "Unknown exercise"}</span>
            <span className="text-court-500">
              {e.sets.length} set{e.sets.length === 1 ? "" : "s"}
            </span>
          </li>
        ))}
      </ul>
      {!canStart && (
        <p className="text-sm text-court-500">Finish the workout in progress to start another.</p>
      )}
      <ErrorNote error={remove.error} />
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-court-800 pt-3">
        {confirming ? (
          <span className="flex items-center gap-1 text-sm text-court-300">
            Delete template?
            <Button
              variant="danger"
              disabled={remove.isPending}
              onClick={() => remove.mutate(t.id, { onSuccess: onClose })}
            >
              Yes, delete
            </Button>
          </span>
        ) : (
          <Button variant="danger" onClick={() => setConfirming(true)}>
            Delete
          </Button>
        )}
        <span className="flex gap-2">
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          <Button variant="primary" disabled={!canStart || starting} onClick={onStart}>
            {starting ? "Starting…" : "Start workout"}
          </Button>
        </span>
      </div>
    </div>
  );
}
