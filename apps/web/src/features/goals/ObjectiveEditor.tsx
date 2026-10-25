import {
  addDays,
  habitObjectiveUnit,
  MAX_HABIT_LINKS,
  OBJECTIVE_SOURCE_LABELS,
  OBJECTIVE_SOURCES,
  OBJECTIVE_TERM_LABELS,
  objectiveTerm,
  statPeriod,
  type HabitDto,
  type ObjectiveDto,
  type ObjectiveSource,
  type RatedNodeDto,
} from "@rlo/shared";
import { useState, type FormEvent } from "react";
import { useCreateObjective, useUpdateObjective } from "../../api/objectives";
import { AttributePicker } from "../../components/AttributePicker";
import { Button } from "../../components/Button";
import { compactFieldClass } from "../../components/form";
import { ErrorNote } from "../onboarding/ErrorNote";

const label = "block text-xs uppercase tracking-wider text-court-300";

/** Quick deadlines; a date input covers everything else. */
function deadlinePresets(today: string, weekStart: number) {
  const year = today.slice(0, 4);
  return [
    { label: "End of week", date: statPeriod("week", today, weekStart).end },
    { label: "End of month", date: statPeriod("month", today, weekStart).end },
    { label: "In 90 days", date: addDays(today, 89) },
    { label: "New Year's", date: `${year}-12-31` },
  ];
}

export function ObjectiveEditor({
  objective,
  habits,
  nodes,
  today,
  weekStart,
  onDone,
}: {
  /** Omit to create a new goal. */
  objective?: ObjectiveDto;
  habits: HabitDto[];
  nodes: RatedNodeDto[];
  today: string;
  weekStart: number;
  onDone: () => void;
}) {
  const [name, setName] = useState(objective?.name ?? "");
  const [source, setSource] = useState<ObjectiveSource>(objective?.source ?? "manual");
  const [habitId, setHabitId] = useState(objective?.habitId ?? "");
  const [target, setTarget] = useState<number | null>(objective?.target ?? null);
  const [unit, setUnit] = useState(objective?.unit ?? "");
  const [startsOn, setStartsOn] = useState(objective?.startsOn ?? today);
  const [endsOn, setEndsOn] = useState(
    objective?.endsOn ?? statPeriod("week", today, weekStart).end,
  );
  const [links, setLinks] = useState<string[]>(objective?.links ?? []);
  const create = useCreateObjective();
  const update = useUpdateObjective();
  const saving = create.isPending || update.isPending;

  // Habits that can be counted: anything but groups (their sub-habits count instead).
  const countable = habits.filter((h) => h.type !== "group");
  const habit = countable.find((h) => h.id === habitId);
  const shownUnit =
    source === "habit" ? (habit ? habitObjectiveUnit(habit.type, habit.config) : "") : unit;
  const validWindow = Boolean(startsOn && endsOn && endsOn >= startsOn);

  const toggleLink = (id: string) =>
    setLinks((prev) =>
      prev.includes(id)
        ? prev.filter((x) => x !== id)
        : prev.length < MAX_HABIT_LINKS
          ? [...prev, id]
          : prev,
    );

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!target) return;
    const body = { name: name.trim(), target, unit: unit.trim(), startsOn, endsOn, links };
    if (objective) update.mutate({ id: objective.id, ...body }, { onSuccess: onDone });
    else
      create.mutate(
        { ...body, source, ...(source === "habit" && { habitId }) },
        { onSuccess: onDone },
      );
  };

  return (
    <form
      onSubmit={onSubmit}
      aria-label={objective ? "Edit goal" : "New goal"}
      className="space-y-6 rounded-xl border border-neon/40 bg-court-900 p-5"
    >
      <label className="block space-y-1">
        <span className={label}>Goal</span>
        <input
          value={name}
          maxLength={80}
          required
          autoFocus
          placeholder="e.g. Run 100 miles before New Year's"
          onChange={(e) => setName(e.target.value)}
          className={`${compactFieldClass} w-full`}
        />
      </label>

      <fieldset className="space-y-2">
        <legend className={label}>How progress is counted</legend>
        <div className="flex flex-wrap gap-2">
          {OBJECTIVE_SOURCES.map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={source === s}
              disabled={Boolean(objective) || (s === "habit" && countable.length === 0)}
              onClick={() => setSource(s)}
              className={`rounded-lg border px-3 py-2 text-sm disabled:opacity-40 ${source === s ? "border-neon bg-neon/10 text-neon" : "border-court-700 text-court-300 hover:border-court-500"}`}
            >
              {OBJECTIVE_SOURCE_LABELS[s]}
            </button>
          ))}
        </div>
        <p className="text-sm text-court-500">
          {source === "manual"
            ? "Add what you did toward it on each day's log."
            : "Every entry of the habit inside the goal's dates counts: amounts for counts and time, otherwise days done."}
        </p>
        {source === "habit" && (
          <select
            aria-label="Habit to count"
            value={habitId}
            required
            disabled={Boolean(objective)}
            onChange={(e) => setHabitId(e.target.value)}
            className={`${compactFieldClass} disabled:opacity-60`}
          >
            <option value="">Pick a habit…</option>
            {countable.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </select>
        )}
      </fieldset>

      <div className="flex flex-wrap items-end gap-4">
        <label className="space-y-1">
          <span className={label}>Target</span>
          <input
            type="number"
            aria-label="Target"
            min={0}
            step="any"
            required
            value={target ?? ""}
            onChange={(e) =>
              setTarget(Number.isFinite(e.target.valueAsNumber) ? e.target.valueAsNumber : null)
            }
            className={`${compactFieldClass} w-28`}
          />
        </label>
        <label className="space-y-1">
          <span className={label}>Unit</span>
          <input
            aria-label="Unit"
            value={shownUnit}
            maxLength={20}
            disabled={source === "habit"}
            placeholder="miles, sessions, books…"
            onChange={(e) => setUnit(e.target.value)}
            className={`${compactFieldClass} w-44 disabled:opacity-60`}
          />
        </label>
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap items-end gap-4">
          <label className="space-y-1">
            <span className={label}>Starts</span>
            <input
              type="date"
              aria-label="Starts on"
              value={startsOn}
              required
              onChange={(e) => setStartsOn(e.target.value)}
              className={compactFieldClass}
            />
          </label>
          <label className="space-y-1">
            <span className={label}>Deadline</span>
            <input
              type="date"
              aria-label="Deadline"
              value={endsOn}
              min={startsOn}
              required
              onChange={(e) => setEndsOn(e.target.value)}
              className={compactFieldClass}
            />
          </label>
          {validWindow && (
            <span className="pb-2 text-sm text-court-500">
              {OBJECTIVE_TERM_LABELS[objectiveTerm(startsOn, endsOn)]}
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {deadlinePresets(today, weekStart).map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => setEndsOn(p.date)}
              className={`rounded-full border px-3 py-1 text-xs uppercase tracking-wider ${endsOn === p.date ? "border-neon text-neon" : "border-court-700 text-court-300 hover:border-court-500"}`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {nodes.length > 0 && (
        <fieldset className="space-y-3">
          <legend className={label}>
            Builds these attributes ({links.length}/{MAX_HABIT_LINKS})
          </legend>
          <AttributePicker nodes={nodes} selected={links} onToggle={toggleLink} />
        </fieldset>
      )}

      <ErrorNote error={create.error ?? update.error} />
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button
          type="submit"
          variant="primary"
          disabled={
            !name.trim() || !target || !validWindow || (source === "habit" && !habitId) || saving
          }
        >
          {saving ? "Saving…" : objective ? "Save goal" : "Add goal"}
        </Button>
      </div>
    </form>
  );
}
