import {
  availableRecords,
  CATEGORY_LABELS,
  defaultHeadline,
  displaySetValue,
  EXERCISE_CATEGORIES,
  EXERCISE_STATS,
  formatSet,
  MAX_STATS,
  PRESET_LABELS,
  RECORD_LABELS,
  SET_FIELD_KEYS,
  setFieldHeader,
  SPORT_LABELS,
  SPORTS,
  STAT_DETAILS,
  STAT_LABELS,
  STAT_PRESET_KEYS,
  STAT_PRESETS,
  statClash,
  statFields,
  type ExerciseCategory,
  type ExerciseDto,
  type ExerciseStat,
  type RecordKey,
  type Sport,
  type WorkoutSetDto,
} from "@rlo/shared";
import { useState, type FormEvent } from "react";
import { useCreateExercise, useUpdateExercise, type ExerciseInput } from "../../api/workouts";
import { Button } from "../../components/Button";
import { compactFieldClass } from "../../components/form";
import { ErrorNote } from "../onboarding/ErrorNote";
import { useUnits } from "./WorkoutsNav";

const label = "block text-xs uppercase tracking-wider text-court-300";
const chip = (active: boolean) =>
  `rounded-full border px-3 py-1 text-xs transition ${active ? "border-neon text-neon" : "border-court-700 text-court-300 hover:border-court-500"}`;

/** The stat picker shows one Distance chip; ft/m vs mi/km is a toggle on the picked row. */
const PICKABLE = EXERCISE_STATS.filter((s) => s !== "length");

/** A sample set for the preview, in stored units (round numbers in lb and ft). */
const SAMPLE: WorkoutSetDto = {
  kind: "normal",
  weightKg: 45.36,
  reps: 8,
  durationS: 45,
  distanceM: 30.48,
  attempts: 10,
  inclinePct: 6,
  heightCm: 61,
  level: 8,
  rpe: 7,
  done: true,
};
const SAMPLE_LONG = { ...SAMPLE, distanceM: 4828, durationS: 1500 };

/**
 * Builds an exercise from its stat line: what each set records (weight, distance, time,
 * incline…), in column order, and the record that scores it. Creates one, or edits a custom one.
 */
export function ExerciseForm({
  initialName = "",
  exercise,
  onSaved,
  onCancel,
}: {
  initialName?: string;
  /** A custom exercise to edit; omitted to create one. */
  exercise?: ExerciseDto;
  onSaved: (e: ExerciseDto) => void;
  onCancel?: () => void;
}) {
  const create = useCreateExercise();
  const update = useUpdateExercise(exercise?.id ?? "");
  const save = exercise ? update : create;
  const units = useUnits();
  const [name, setName] = useState(exercise?.name ?? initialName);
  const [category, setCategory] = useState<ExerciseCategory>(exercise?.category ?? "other");
  const [sport, setSport] = useState<Sport | null>(exercise?.sport ?? null);
  const [stats, setStats] = useState<ExerciseStat[]>(exercise?.stats ?? ["weight", "reps"]);
  const [picked, setPicked] = useState<RecordKey | null>(exercise?.headline ?? null);
  const [note, setNote] = useState("");

  const options = availableRecords(stats);
  const headline = picked && options.includes(picked) ? picked : defaultHeadline(stats);

  const add = (stat: ExerciseStat) => {
    setNote("");
    if (stats.length >= MAX_STATS) return setNote(`Up to ${MAX_STATS} stats per exercise.`);
    // Lifts, carries and jumps measure short distances; cardio defaults to miles or km.
    const next = stat === "distance" && category !== "cardio" ? "length" : stat;
    const clash = statClash(stats, next);
    if (clash) {
      return setNote(`${STAT_LABELS[next]} and ${STAT_LABELS[clash]} share a column; pick one.`);
    }
    setStats([...stats, next]);
  };
  const remove = (i: number) => {
    setNote("");
    setStats(stats.filter((_, j) => j !== i));
  };
  const move = (i: number, delta: -1 | 1) => {
    const next = [...stats];
    [next[i], next[i + delta]] = [next[i + delta]!, next[i]!];
    setStats(next);
  };
  const toggleScale = (i: number) =>
    setStats(stats.map((s, j) => (j === i ? (s === "length" ? "distance" : "length") : s)));
  const usePreset = (key: keyof typeof STAT_PRESETS) => {
    setNote("");
    setStats([...STAT_PRESETS[key]]);
    setPicked(null);
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!stats.length) return setNote("Pick at least one stat.");
    const input: ExerciseInput = {
      name: name.trim(),
      category,
      stats,
      headline,
      sport: category === "sport" ? sport : null,
    };
    save.mutate(input, { onSuccess: onSaved });
  };

  const fields = statFields(stats);
  const makes = stats.includes("makes");
  const sample = stats.includes("distance") ? SAMPLE_LONG : SAMPLE;
  const has = (s: ExerciseStat) =>
    stats.includes(s) || (s === "distance" && stats.includes("length"));

  return (
    <form
      onSubmit={onSubmit}
      aria-label={exercise ? "Edit exercise" : "New exercise"}
      className="min-h-0 space-y-4 overflow-y-auto"
    >
      <label className="block space-y-1">
        <span className={label}>Name</span>
        <input
          value={name}
          required
          autoFocus
          maxLength={60}
          placeholder="Hill farmer's walk"
          onChange={(e) => setName(e.target.value)}
          className={`${compactFieldClass} w-full`}
        />
      </label>

      <div className="space-y-1.5">
        <span className={label}>Category</span>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Category">
          {EXERCISE_CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={category === c}
              className={chip(category === c)}
              onClick={() => setCategory(c)}
            >
              {CATEGORY_LABELS[c]}
            </button>
          ))}
        </div>
        {category === "sport" && (
          <select
            aria-label="Sport"
            value={sport ?? ""}
            onChange={(e) => setSport((e.target.value || null) as Sport | null)}
            className={`${compactFieldClass} mt-1 w-full`}
          >
            <option value="">Any sport</option>
            {SPORTS.map((s) => (
              <option key={s} value={s}>
                {SPORT_LABELS[s]}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between gap-2">
          <span className={label}>Stat line</span>
          <span className="text-xs text-court-500">What each set records · up to {MAX_STATS}</span>
        </div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Start from">
          <span className="self-center text-xs text-court-500">Start from</span>
          {STAT_PRESET_KEYS.map((k) => (
            <button key={k} type="button" className={chip(false)} onClick={() => usePreset(k)}>
              {PRESET_LABELS[k]}
            </button>
          ))}
        </div>
        <ol className="space-y-1" aria-label="Stats">
          {stats.map((s, i) => (
            <li
              key={s}
              className="flex items-center gap-2 rounded-lg border border-court-700 bg-court-900 px-2 py-1.5 text-sm"
            >
              <span className="w-5 text-center text-xs text-court-500">{i + 1}</span>
              <span className="min-w-0 flex-1">
                <span className="block">{s === "length" ? "Distance" : STAT_LABELS[s]}</span>
                <span className="block truncate text-xs text-court-500">
                  {s === "length" || s === "distance"
                    ? s === "length"
                      ? "Short: feet or meters"
                      : "Long: miles or km"
                    : STAT_DETAILS[s]}
                </span>
              </span>
              {(s === "length" || s === "distance") && (
                <button
                  type="button"
                  onClick={() => toggleScale(i)}
                  className="rounded-md border border-court-700 px-2 py-0.5 text-xs text-court-300 hover:border-court-500"
                  title="Switch between short and long distances"
                >
                  {s === "length"
                    ? `${setFieldHeader("length", units, false)} · short`
                    : `${setFieldHeader("distance", units, false)} · long`}
                </button>
              )}
              <button
                type="button"
                aria-label={`Move ${STAT_LABELS[s]} up`}
                disabled={i === 0}
                onClick={() => move(i, -1)}
                className="px-1 text-court-500 enabled:hover:text-court-100 disabled:opacity-30"
              >
                ↑
              </button>
              <button
                type="button"
                aria-label={`Move ${STAT_LABELS[s]} down`}
                disabled={i === stats.length - 1}
                onClick={() => move(i, 1)}
                className="px-1 text-court-500 enabled:hover:text-court-100 disabled:opacity-30"
              >
                ↓
              </button>
              <button
                type="button"
                aria-label={`Remove ${STAT_LABELS[s]}`}
                onClick={() => remove(i)}
                className="px-1 text-court-500 hover:text-flare"
              >
                ×
              </button>
            </li>
          ))}
          {stats.length === 0 && (
            <li className="rounded-lg border border-dashed border-court-700 px-3 py-3 text-center text-sm text-court-500">
              Add a stat below
            </li>
          )}
        </ol>
        {stats.length < MAX_STATS && (
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Add a stat">
            {PICKABLE.filter((s) => !has(s)).map((s) => (
              <button
                key={s}
                type="button"
                aria-label={`Add ${STAT_LABELS[s]}`}
                title={STAT_DETAILS[s]}
                onClick={() => add(s)}
                className="rounded-full border border-dashed border-court-600 px-3 py-1 text-xs text-court-300 hover:border-neon hover:text-neon"
              >
                + {STAT_LABELS[s]}
              </button>
            ))}
          </div>
        )}
        {note && <p className="text-xs text-tier-orange">{note}</p>}
      </div>

      {stats.length > 0 && (
        <div className="space-y-1.5">
          <span className={label}>Preview</span>
          <div className="rounded-lg bg-court-900 p-2 text-sm">
            <div
              className="grid gap-1.5 px-1 text-[11px] font-semibold uppercase tracking-wider text-court-500"
              style={{ gridTemplateColumns: `2rem repeat(${fields.length}, minmax(0,1fr))` }}
            >
              <span className="text-center">Set</span>
              {fields.map((f) => (
                <span key={f} className="text-center">
                  {setFieldHeader(f, units, makes)}
                </span>
              ))}
            </div>
            <div
              className="mt-1 grid gap-1.5 px-1 tabular-nums"
              style={{ gridTemplateColumns: `2rem repeat(${fields.length}, minmax(0,1fr))` }}
            >
              <span className="rounded-md bg-court-800 py-1 text-center">1</span>
              {fields.map((f) => (
                <span key={f} className="rounded-md bg-court-800 py-1 text-center text-court-300">
                  {displaySetValue(f, (sample[SET_FIELD_KEYS[f]] as number | null) ?? null, units)}
                </span>
              ))}
            </div>
            <p className="mt-2 px-1 text-xs text-court-500">
              In history: {formatSet({ stats }, sample, units)}
            </p>
          </div>
        </div>
      )}

      {stats.length > 0 && (
        <label className="block space-y-1">
          <span className={label}>Scored by</span>
          <select
            value={headline}
            onChange={(e) => setPicked(e.target.value as RecordKey)}
            className={`${compactFieldClass} w-full`}
          >
            {options.map((k) => (
              <option key={k} value={k}>
                {RECORD_LABELS[k]}
                {k === "fastestS" ? " (lower wins)" : ""}
              </option>
            ))}
          </select>
          <span className="block text-xs text-court-500">
            Sets its personal record, chart and each session's best set.
          </span>
        </label>
      )}

      <ErrorNote error={save.error} />
      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button
          type="submit"
          variant="primary"
          disabled={!name.trim() || !stats.length || save.isPending}
        >
          {save.isPending ? "Saving…" : exercise ? "Save changes" : "Create exercise"}
        </Button>
      </div>
    </form>
  );
}
