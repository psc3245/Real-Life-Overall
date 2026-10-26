import type { DayDto } from "@rlo/shared";
import { Link } from "react-router";
import { useSaveBody } from "../../api/workouts";
import { HeightInput, WeightInput } from "../body/BodyInputs";
import { ErrorNote } from "../onboarding/ErrorNote";
import { formatElapsed, formatVolume } from "../workouts/format";

/** The day's finished workouts. */
export function DayWorkouts({ day }: { day: DayDto }) {
  return (
    <section className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-xl uppercase tracking-wider">Workouts</h2>
        <Link to="/workouts" className="text-sm text-court-300 hover:text-neon">
          {day.date === day.today ? "Start a workout →" : "Workouts →"}
        </Link>
      </div>
      {day.workouts.length === 0 ? (
        <p className="rounded-xl border border-dashed border-court-700 p-6 text-center text-court-500">
          No workouts logged on this day.
        </p>
      ) : (
        <div className="space-y-3">
          {day.workouts.map((w) => (
            <Link
              key={w.id}
              to={`/workouts/${w.id}`}
              className="block space-y-2 rounded-xl border border-neon/50 bg-court-900/70 p-4 hover:border-neon"
            >
              <p className="flex flex-wrap items-baseline justify-between gap-3">
                <span className="font-medium">{w.name}</span>
                <span className="text-sm text-court-300">
                  {formatElapsed(w.durationS)}
                  {w.volumeKg > 0 && ` · ${formatVolume(w.volumeKg, day.units)}`}
                </span>
              </p>
              <ul className="space-y-0.5 text-sm text-court-300">
                {w.lines.map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
              {w.prs.length > 0 && (
                <p className="text-sm text-tier-yellow">★ {w.prs.join(" · ")}</p>
              )}
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

/** Weight and height for the day, when tracked. */
export function DayBody({ day }: { day: DayDto }) {
  const save = useSaveBody();
  const body = day.body;
  if (!body) return null;
  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-xl uppercase tracking-wider">Body</h2>
        <Link to="/body" className="text-sm text-court-300 hover:text-neon">
          Trends →
        </Link>
      </div>
      <div
        key={day.date}
        className="flex flex-wrap items-center gap-6 rounded-xl border border-court-700 bg-court-900/70 p-4"
      >
        {body.trackWeight && (
          <label className="flex items-center gap-3">
            <span className="text-sm text-court-300">Weight</span>
            <WeightInput
              kg={body.weightKg}
              units={day.units}
              placeholderKg={body.lastWeightKg}
              disabled={!day.editable}
              onCommit={(weightKg) => save.mutate({ date: day.date, weightKg })}
            />
          </label>
        )}
        {body.trackHeight && (
          <div className="flex items-center gap-3">
            <span className="text-sm text-court-300">Height</span>
            <HeightInput
              cm={body.heightCm}
              units={day.units}
              placeholderCm={body.lastHeightCm}
              disabled={!day.editable}
              onCommit={(heightCm) => save.mutate({ date: day.date, heightCm })}
            />
          </div>
        )}
        <span aria-live="polite" className="text-xs uppercase tracking-wider text-court-500">
          {save.isPending ? "Saving…" : ""}
        </span>
      </div>
      <ErrorNote error={save.error} />
    </section>
  );
}
