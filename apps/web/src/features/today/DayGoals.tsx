import type { DayDto, DayObjectiveDto } from "@rlo/shared";
import { useState } from "react";
import { Link } from "react-router";
import { useSaveObjectiveEntry } from "../../api/objectives";
import { formatNumber } from "../../lib/format";
import {
  ObjectiveAmount,
  ObjectiveBar,
  objectiveStatusText,
  statusTone,
} from "../goals/ObjectiveProgress";
import { ErrorNote } from "../onboarding/ErrorNote";

/** The day's goals: log what you did toward manual ones; habit goals follow their habit. */
export function DayGoals({ day }: { day: DayDto }) {
  return (
    <section className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-xl uppercase tracking-wider">Goals</h2>
        <Link to="/goals" className="text-sm text-court-300 hover:text-neon">
          All goals →
        </Link>
      </div>
      {day.objectives.length === 0 ? (
        <p className="rounded-xl border border-dashed border-court-700 p-6 text-center text-court-500">
          No goals running on this day.{" "}
          <Link to="/goals" className="text-neon hover:underline">
            Set one
          </Link>
          , like "Run 100 miles before New Year's".
        </p>
      ) : (
        <div className="space-y-3">
          {day.objectives.map((item) => (
            <DayGoalRow key={`${day.date}-${item.objective.id}`} item={item} day={day} />
          ))}
        </div>
      )}
    </section>
  );
}

function DayGoalRow({ item, day }: { item: DayObjectiveDto; day: DayDto }) {
  const { objective: o } = item;
  const save = useSaveObjectiveEntry(day.date, o.id);
  const [value, setValue] = useState(item.logged === null ? "" : String(item.logged));
  const commit = () => {
    const n = value.trim() === "" ? null : Number(value);
    if (n !== null && (!Number.isFinite(n) || n < 0)) return;
    if (n === item.logged || (n === 0 && item.logged === null)) return;
    save.mutate(n);
  };

  return (
    <div
      id={`goal-${o.id}`}
      className={`scroll-mt-16 space-y-3 rounded-xl border bg-court-900/70 p-4 ${item.dayAmount > 0 ? "border-neon/50" : "border-court-700"}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium">{o.name}</p>
          <p className="text-sm">
            <ObjectiveAmount objective={o} />
            <span className={`ml-2 ${statusTone(o)}`}>{objectiveStatusText(o)}</span>
          </p>
        </div>
        {o.source === "manual" ? (
          <label className="flex items-center gap-2 text-sm text-court-300">
            <span className="sr-only">{o.name} on this day</span>
            <span aria-hidden>+</span>
            <input
              type="number"
              inputMode="decimal"
              min={0}
              step="any"
              value={value}
              disabled={!day.editable}
              placeholder="0"
              onChange={(e) => setValue(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
              className="w-24 rounded-lg border border-court-700 bg-court-950 px-3 py-1.5 text-right tabular-nums outline-none focus:border-neon"
            />
            {o.unit}
            {day.editable && (
              <button
                type="button"
                aria-label={`Add 1 ${o.unit}`}
                onClick={() => {
                  const next = (Number(value) || 0) + 1;
                  setValue(String(next));
                  save.mutate(next);
                }}
                className="h-8 w-8 rounded-lg border border-court-700 text-court-100 hover:border-neon"
              >
                +1
              </button>
            )}
          </label>
        ) : (
          <p className="text-sm text-court-300">
            {item.dayAmount > 0
              ? `+${formatNumber(item.dayAmount)} from ${o.habitName ?? "the habit"}`
              : `Counts ${o.habitName ?? "a habit"}`}
          </p>
        )}
      </div>
      <ObjectiveBar objective={o} thin />
      <ErrorNote error={save.error} />
    </div>
  );
}
