import {
  CATEGORY_LABELS,
  EXERCISE_CATEGORIES,
  SPORT_LABELS,
  statLineLabel,
  type ExerciseCategory,
  type ExerciseDto,
} from "@rlo/shared";
import { useEffect, useRef, useState } from "react";
import { Button } from "../../components/Button";
import { compactFieldClass } from "../../components/form";
import { ExerciseForm } from "./ExerciseForm";

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
  initialCategory = null,
  onAdd,
  onClose,
}: {
  exercises: ExerciseDto[];
  /** Opens filtered to this category (sport practices start on Sport & skill). */
  initialCategory?: ExerciseCategory | null;
  onAdd: (ids: string[]) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<ExerciseCategory | null>(initialCategory);
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
            {e.sport ? SPORT_LABELS[e.sport] : CATEGORY_LABELS[e.category]} ·{" "}
            {statLineLabel(e.stats)}
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
        <ExerciseForm
          initialName={query}
          onSaved={(e) => {
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
