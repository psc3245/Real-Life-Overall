import { CATEGORY_LABELS, TRACKING_LABELS, type ExerciseCategory } from "@rlo/shared";
import { useState } from "react";
import { Link } from "react-router";
import { useExercises } from "../../api/workouts";
import { Button } from "../../components/Button";
import { compactFieldClass } from "../../components/form";
import { Modal } from "../../components/Modal";
import { ErrorNote } from "../onboarding/ErrorNote";
import { CategoryChips, filterExercises, NewExerciseForm } from "./ExercisePicker";
import { since } from "./format";
import { WorkoutsNav } from "./WorkoutsNav";
import { DebugJson } from "../../components/debug/Debug";

/** The exercise library: built-ins plus custom ones, with how often each was done. */
export function ExercisesPage() {
  const exercises = useExercises();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<ExerciseCategory | null>(null);
  const [creating, setCreating] = useState(false);
  const shown = filterExercises(exercises.data ?? [], query, category);

  return (
    <div className="space-y-6 pt-4">
      <header className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-neon">Training</p>
            <h1 className="font-display text-4xl font-bold uppercase md:text-5xl">Exercises</h1>
          </div>
          <Button variant="primary" onClick={() => setCreating(true)}>
            + New exercise
          </Button>
        </div>
        <WorkoutsNav />
      </header>
      <input
        aria-label="Search exercises"
        value={query}
        placeholder="Search"
        onChange={(e) => setQuery(e.target.value)}
        className={`${compactFieldClass} w-full`}
      />
      <CategoryChips value={category} onChange={setCategory} />
      {exercises.isPending && <p className="text-court-500">Loading…</p>}
      <ErrorNote error={exercises.error} />
      <ul className="divide-y divide-court-800 rounded-xl border border-court-700 bg-court-900/70">
        {shown.map((e) => (
          <li key={e.id}>
            <Link
              to={`/workouts/exercises/${e.id}`}
              className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-court-800/60"
            >
              <span className="min-w-0">
                <span className="block truncate font-medium">{e.name}</span>
                <span className="block text-xs text-court-500">
                  {CATEGORY_LABELS[e.category]} · {TRACKING_LABELS[e.tracking]}
                  {e.custom && " · custom"}
                </span>
              </span>
              <span className="shrink-0 text-right text-xs text-court-500">
                {e.timesDone > 0 ? (
                  <>
                    <span className="block text-court-300">{e.timesDone}×</span>
                    {since(e.lastDone)}
                  </>
                ) : null}
              </span>
            </Link>
          </li>
        ))}
        {exercises.isSuccess && shown.length === 0 && (
          <li className="px-4 py-6 text-center text-sm text-court-500">No matches.</li>
        )}
      </ul>
      <DebugJson label="exercises" data={exercises.data} />
      <Modal open={creating} onClose={() => setCreating(false)} label="New exercise">
        <h2 className="mb-4 font-display text-xl uppercase tracking-wider">New exercise</h2>
        <NewExerciseForm initialName={query} onCreated={() => setCreating(false)} />
      </Modal>
    </div>
  );
}
