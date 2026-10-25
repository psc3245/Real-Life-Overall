import {
  CATEGORY_LABELS,
  EXERCISE_CATEGORIES,
  EXERCISE_TRACKING,
  TRACKING_LABELS,
  type ExerciseCategory,
  type ExerciseDto,
  type ExerciseTracking,
} from "@rlo/shared";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useCreateExercise } from "../../api/workouts";
import { Button } from "../../components/Button";
import { compactFieldClass } from "../../components/form";
import { ErrorNote } from "../onboarding/ErrorNote";

/** Filters the library by text and category; shared by the picker and the Exercises page. */
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

export function CategoryChips({
  value,
  onChange,
}: {
  value: ExerciseCategory | null;
  onChange: (c: ExerciseCategory | null) => void;
}) {
  const chip = (active: boolean) =>
    `shrink-0 rounded-full border px-3 py-1 text-xs uppercase tracking-wider ${active ? "border-neon text-neon" : "border-court-700 text-court-300 hover:border-court-500"}`;
  return (
    <div
      className="-mx-1 flex shrink-0 gap-1.5 overflow-x-auto px-1 pb-1"
      role="group"
      aria-label="Category"
    >
      <button type="button" className={chip(value === null)} onClick={() => onChange(null)}>
        All
      </button>
      {EXERCISE_CATEGORIES.map((c) => (
        <button
          key={c}
          type="button"
          aria-pressed={value === c}
          className={chip(value === c)}
          onClick={() => onChange(value === c ? null : c)}
        >
          {CATEGORY_LABELS[c]}
        </button>
      ))}
    </div>
  );
}

/** Picks one or more exercises to add, or creates a custom one. */
export function ExercisePicker({
  exercises,
  onAdd,
  onClose,
}: {
  exercises: ExerciseDto[];
  onAdd: (ids: string[]) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<ExerciseCategory | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const search = useRef<HTMLInputElement>(null);
  useEffect(() => {
    // The dialog focuses its first button when it opens; move focus to search after that.
    const id = setTimeout(() => search.current?.focus(), 0);
    return () => clearTimeout(id);
  }, [creating]);
  const shown = filterExercises(exercises, query, category);
  // Recently used first, then alphabetical (the list arrives sorted by name).
  const recent =
    query || category
      ? []
      : [...exercises]
          .filter((e) => e.lastDone)
          .sort((a, b) => b.lastDone!.localeCompare(a.lastDone!))
          .slice(0, 5);

  const toggle = (id: string) =>
    setPicked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const row = (e: ExerciseDto) => (
    <li key={e.id}>
      <button
        type="button"
        aria-pressed={picked.includes(e.id)}
        onClick={() => toggle(e.id)}
        className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left ${picked.includes(e.id) ? "bg-neon/10 text-neon" : "hover:bg-court-800"}`}
      >
        <span className="min-w-0">
          <span className="block truncate">{e.name}</span>
          <span className="block text-xs text-court-500">
            {CATEGORY_LABELS[e.category]} · {TRACKING_LABELS[e.tracking]}
            {e.custom && " · custom"}
          </span>
        </span>
        {picked.includes(e.id) && <span aria-hidden>✓</span>}
      </button>
    </li>
  );

  return (
    <div className="flex max-h-[80dvh] flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-xl uppercase tracking-wider">Add exercises</h2>
        <Button variant="ghost" onClick={() => setCreating((v) => !v)}>
          {creating ? "Back to list" : "+ New exercise"}
        </Button>
      </div>
      {creating ? (
        <NewExerciseForm
          initialName={query}
          onCreated={(e) => {
            setCreating(false);
            setPicked((prev) => [...prev, e.id]);
            setQuery("");
          }}
        />
      ) : (
        <>
          <input
            ref={search}
            aria-label="Search exercises"
            value={query}
            placeholder="Search"
            onChange={(e) => setQuery(e.target.value)}
            className={`${compactFieldClass} w-full shrink-0`}
          />
          <CategoryChips value={category} onChange={setCategory} />
          <ul className="-mx-1 min-h-40 flex-1 space-y-0.5 overflow-y-auto px-1">
            {recent.length > 0 && (
              <>
                <li className="px-3 pt-1 text-[11px] uppercase tracking-wider text-court-500">
                  Recent
                </li>
                {recent.map(row)}
                <li className="px-3 pt-2 text-[11px] uppercase tracking-wider text-court-500">
                  All exercises
                </li>
              </>
            )}
            {shown.map(row)}
            {shown.length === 0 && (
              <li className="px-3 py-6 text-center text-sm text-court-500">
                No matches.{" "}
                <button
                  type="button"
                  className="text-neon hover:underline"
                  onClick={() => setCreating(true)}
                >
                  Create "{query.trim() || "a new exercise"}"
                </button>
              </li>
            )}
          </ul>
        </>
      )}
      <div className="flex justify-end gap-2 border-t border-court-800 pt-3">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="primary" disabled={!picked.length} onClick={() => onAdd(picked)}>
          Add{picked.length ? ` (${picked.length})` : ""}
        </Button>
      </div>
    </div>
  );
}

export function NewExerciseForm({
  initialName = "",
  onCreated,
}: {
  initialName?: string;
  onCreated: (e: ExerciseDto) => void;
}) {
  const create = useCreateExercise();
  const [name, setName] = useState(initialName);
  const [category, setCategory] = useState<ExerciseCategory>("other");
  const [tracking, setTracking] = useState<ExerciseTracking>("weight_reps");
  const label = "block text-xs uppercase tracking-wider text-court-300";

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    create.mutate({ name: name.trim(), category, tracking }, { onSuccess: onCreated });
  };

  return (
    <form onSubmit={onSubmit} aria-label="New exercise" className="space-y-4">
      <label className="block space-y-1">
        <span className={label}>Name</span>
        <input
          value={name}
          required
          autoFocus
          maxLength={60}
          placeholder="e.g. Floaters, Sled Push"
          onChange={(e) => setName(e.target.value)}
          className={`${compactFieldClass} w-full`}
        />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1">
          <span className={label}>Category</span>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as ExerciseCategory)}
            className={`${compactFieldClass} w-full`}
          >
            {EXERCISE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1">
          <span className={label}>What a set records</span>
          <select
            value={tracking}
            onChange={(e) => setTracking(e.target.value as ExerciseTracking)}
            className={`${compactFieldClass} w-full`}
          >
            {EXERCISE_TRACKING.map((t) => (
              <option key={t} value={t}>
                {TRACKING_LABELS[t]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <ErrorNote error={create.error} />
      <div className="flex justify-end">
        <Button type="submit" variant="primary" disabled={!name.trim() || create.isPending}>
          {create.isPending ? "Creating…" : "Create exercise"}
        </Button>
      </div>
    </form>
  );
}
