import {
  addDays,
  formatDuration,
  formatSet,
  HABIT_TYPE_LABELS,
  suggestedHabitConfig,
  suggestedHabitGoal,
  WEEKDAY_SHORT,
  type CoachSuggestionDto,
  type ExerciseDto,
  type UnitSystem,
  type WorkoutExerciseDto,
} from "@rlo/shared";
import { useState, type FormEvent } from "react";
import { Link } from "react-router";
import { useResolveCoachSuggestion } from "../../api/coach";
import { useDay, useHabits } from "../../api/days";
import { useMe } from "../../api/hooks";
import { useRatings } from "../../api/ratings";
import { useExercises } from "../../api/workouts";
import { Button } from "../../components/Button";
import { compactFieldClass } from "../../components/form";
import { Modal } from "../../components/Modal";
import { weekdayDate } from "../../lib/format";
import { ObjectiveEditor, type GoalDraft } from "../goals/ObjectiveEditor";
import { HabitEditor, type HabitDraft } from "../habits/HabitEditor";
import { ErrorNote } from "../onboarding/ErrorNote";
import { WorkoutEditor } from "../workouts/WorkoutEditor";
import { useUnits } from "../workouts/WorkoutsNav";

/**
 * Something the coach drafted (DESIGN.md §5.9): a workout, template, habit or goal shown with
 * its details. Nothing exists until the player saves it, as it is or after tweaking it in the
 * same editor the rest of the app uses.
 */
export type Draft = Extract<
  CoachSuggestionDto,
  { kind: "workout" | "template" | "habit" | "goal" }
>;

const LABEL: Record<Draft["kind"], string> = {
  workout: "Workout",
  template: "Workout template",
  habit: "Habit",
  goal: "Goal",
};

const SAVE: Record<Draft["kind"], string> = {
  workout: "Looks right, save it",
  template: "Save template",
  habit: "Add habit",
  goal: "Add goal",
};

function savedLink(d: Draft) {
  if (!d.createdId) return null;
  switch (d.kind) {
    case "workout":
      return `/workouts/${d.createdId}`;
    case "template":
      return `/workouts/templates/${d.createdId}`;
    case "habit":
      return "/habits/manage";
    case "goal":
      return "/goals";
  }
}

/** "Squat (Barbell): 3 × 225 lb × 5" per exercise. */
function exerciseLines(exercises: WorkoutExerciseDto[], library: ExerciseDto[], units: UnitSystem) {
  const byId = new Map(library.map((e) => [e.id, e]));
  return exercises.map((e) => {
    const info = byId.get(e.exerciseId);
    const last = e.sets.findLast((s) => s.weightKg ?? s.reps ?? s.durationS ?? s.distanceM);
    const shown = last && info ? formatSet(info, last, units) : "";
    return `${info?.name ?? "Exercise"}: ${e.sets.length} set${e.sets.length === 1 ? "" : "s"}${shown ? ` · ${shown}` : ""}`;
  });
}

/** The draft as the habit or goal editor's starting values. */
function habitDraft(d: Extract<Draft, { kind: "habit" }>): HabitDraft {
  return {
    name: d.name,
    type: d.habitType,
    config: suggestedHabitConfig(d),
    days: d.days,
    links: d.nodeIds,
  };
}

function goalDraft(d: Extract<Draft, { kind: "goal" }>, today: string): GoalDraft {
  return {
    name: d.name,
    kind: d.goalKind ?? "total",
    target: d.target,
    unit: d.unit,
    startValue: d.startValue ?? null,
    endsOn: d.endsOn ?? addDays(today, d.durationDays - 1),
    links: d.nodeIds,
  };
}

export function DraftCard({ messageId, draft: d }: { messageId: string; draft: Draft }) {
  const resolve = useResolveCoachSuggestion();
  const ratings = useRatings();
  const library = useExercises().data ?? [];
  const units = useUnits();
  const today = useDay(null).data?.today;
  const [reviewing, setReviewing] = useState(false);
  const names = new Map((ratings.data?.nodes ?? []).map((n) => [n.id, n.name]));
  const builds =
    d.kind === "habit" || d.kind === "goal"
      ? d.nodeIds.map((id) => names.get(id)).filter(Boolean)
      : [];

  const save = (edits?: unknown) =>
    resolve.mutate(
      { messageId, index: d.index, action: "accept", edits },
      { onSuccess: () => setReviewing(false) },
    );
  const link = savedLink(d);

  let facts: string[] = [];
  if (d.kind === "workout") {
    facts = [
      `${weekdayDate(d.date)} · ${formatDuration(d.durationS)}`,
      ...exerciseLines(d.exercises, library, units),
    ];
  } else if (d.kind === "template") {
    facts = exerciseLines(d.exercises, library, units);
  } else if (d.kind === "habit") {
    const schedule =
      d.days.length === 7 ? "Every day" : d.days.map((x) => WEEKDAY_SHORT[x]).join(", ");
    const amount = suggestedHabitGoal(d);
    facts = [
      `${HABIT_TYPE_LABELS[d.habitType]}${d.avoid ? " (avoid)" : ""} · ${schedule}${amount}`,
    ];
  } else if (today) {
    const g = goalDraft(d, today);
    facts = [
      `${g.kind === "reach" ? `${g.startValue} → ` : ""}${g.target} ${g.unit} by ${weekdayDate(g.endsOn)}`,
    ];
  }
  if (builds.length) facts.push(`Builds ${builds.join(", ")}`);

  return (
    <li
      className={`space-y-3 rounded-xl border p-4 ${d.status === "pending" ? "border-neon/40 bg-court-900" : "border-court-800 bg-court-900/40"}`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[11px] uppercase tracking-wider text-neon">
          {LABEL[d.kind]}
          {d.status === "pending" && <span className="text-court-500"> · draft, not saved</span>}
        </p>
        {d.status !== "pending" && (
          <span className="text-xs uppercase tracking-wider text-court-500">
            {d.status === "accepted" ? "✓ Saved" : "Discarded"}
          </span>
        )}
      </div>
      <div>
        <p className="font-display text-lg uppercase tracking-wide">
          {d.status === "accepted" && link ? (
            <Link to={link} className="hover:text-neon">
              {d.name}
            </Link>
          ) : (
            d.name
          )}
        </p>
        <ul className="mt-1 space-y-0.5 text-sm text-court-300">
          {/* Lines can repeat ("Exercise: 3 sets" while the library loads), so key by position. */}
          {facts.map((f, i) => (
            <li key={i}>{f}</li>
          ))}
        </ul>
        {d.reason && <p className="mt-2 text-sm text-court-300">{d.reason}</p>}
      </div>
      <ErrorNote error={resolve.error} />
      {d.status === "pending" && (
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" disabled={resolve.isPending} onClick={() => save()}>
            {SAVE[d.kind]}
          </Button>
          <Button variant="ghost" disabled={resolve.isPending} onClick={() => setReviewing(true)}>
            Review and tweak
          </Button>
          <Button
            variant="ghost"
            disabled={resolve.isPending}
            onClick={() => resolve.mutate({ messageId, index: d.index, action: "dismiss" })}
          >
            Discard
          </Button>
        </div>
      )}
      <Modal
        open={reviewing}
        onClose={() => setReviewing(false)}
        label={`Review ${LABEL[d.kind].toLowerCase()}`}
        size="xl"
      >
        {today && (
          <Review
            draft={d}
            today={today}
            pending={resolve.isPending}
            error={resolve.error}
            onSave={save}
            onClose={() => setReviewing(false)}
          />
        )}
      </Modal>
    </li>
  );
}

function Review({
  draft: d,
  today,
  pending,
  error,
  onSave,
  onClose,
}: {
  draft: Draft;
  today: string;
  pending: boolean;
  error: unknown;
  onSave: (edits: unknown) => void;
  onClose: () => void;
}) {
  const ratings = useRatings();
  const habits = useHabits();
  const me = useMe();
  const nodes = ratings.data?.nodes ?? [];
  const submit = { onSubmit: onSave, pending, error };
  return (
    <div className="max-h-[80dvh] overflow-y-auto">
      {d.kind === "habit" ? (
        <HabitEditor
          nodes={nodes}
          today={today}
          onDone={onClose}
          initial={habitDraft(d)}
          submit={submit}
        />
      ) : d.kind === "goal" ? (
        <ObjectiveEditor
          habits={habits.data ?? []}
          nodes={nodes}
          today={today}
          weekStart={me.data?.weekStart ?? 1}
          onDone={onClose}
          initial={goalDraft(d, today)}
          submit={submit}
        />
      ) : (
        <WorkoutReview draft={d} today={today} {...submit} onClose={onClose} />
      )}
    </div>
  );
}

/** A workout or template draft: its name, and for a workout its day and length, plus the sets. */
function WorkoutReview({
  draft: d,
  today,
  onSubmit,
  pending,
  error,
  onClose,
}: {
  draft: Extract<Draft, { kind: "workout" | "template" }>;
  today: string;
  onSubmit: (edits: unknown) => void;
  pending: boolean;
  error: unknown;
  onClose: () => void;
}) {
  const library = useExercises();
  const units = useUnits();
  const [name, setName] = useState(d.name);
  const [exercises, setExercises] = useState(d.exercises);
  const [date, setDate] = useState(d.kind === "workout" ? d.date : today);
  const [minutes, setMinutes] = useState(d.kind === "workout" ? Math.round(d.durationS / 60) : 0);
  const workout = d.kind === "workout";

  return (
    <form
      aria-label={workout ? "Review workout" : "Review template"}
      className="space-y-5"
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        onSubmit(
          workout
            ? {
                name: name.trim(),
                notes: d.notes,
                localDate: date,
                durationS: Math.max(1, minutes) * 60,
                // A logged workout keeps only the sets that were done.
                exercises: exercises
                  .map((x) => ({ ...x, sets: x.sets.filter((s) => s.done) }))
                  .filter((x) => x.sets.length),
              }
            : { name: name.trim(), notes: d.notes, exercises },
        );
      }}
    >
      <div className="flex flex-wrap items-end gap-3">
        <label className="min-w-48 flex-1 space-y-1">
          <span className="block text-xs uppercase tracking-wider text-court-300">Name</span>
          <input
            value={name}
            required
            maxLength={80}
            onChange={(e) => setName(e.target.value)}
            className={`${compactFieldClass} w-full`}
          />
        </label>
        {workout && (
          <>
            <label className="space-y-1">
              <span className="block text-xs uppercase tracking-wider text-court-300">Day</span>
              <input
                type="date"
                value={date}
                max={today}
                required
                onChange={(e) => setDate(e.target.value)}
                className={compactFieldClass}
              />
            </label>
            <label className="space-y-1">
              <span className="block text-xs uppercase tracking-wider text-court-300">Minutes</span>
              <input
                type="number"
                min={1}
                max={1440}
                value={minutes || ""}
                required
                onChange={(e) => setMinutes(e.target.valueAsNumber || 0)}
                className={`${compactFieldClass} w-24`}
              />
            </label>
          </>
        )}
      </div>
      {library.data ? (
        <WorkoutEditor
          exercises={exercises}
          library={library.data}
          units={units}
          mode={workout ? "log" : "plan"}
          onChange={setExercises}
        />
      ) : (
        <p className="text-court-500">Loading exercises…</p>
      )}
      <ErrorNote error={error} />
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button
          type="submit"
          variant="primary"
          disabled={pending || !name.trim() || !exercises.length}
        >
          {pending ? "Saving…" : workout ? "Save workout" : "Save template"}
        </Button>
      </div>
    </form>
  );
}
