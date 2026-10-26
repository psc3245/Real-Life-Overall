import { addDays, bmi, formatHeight, toDisplayWeight, weightUnit, type BodyDto } from "@rlo/shared";
import { useState } from "react";
import { useDay } from "../../api/days";
import { useMe } from "../../api/hooks";
import { useBody, useSaveBody } from "../../api/workouts";
import { Button } from "../../components/Button";
import { TrendChart } from "../../components/charts/TrendChart";
import { compactFieldClass } from "../../components/form";
import { StatTile } from "../../components/StatTile";
import { dayLabel } from "../../lib/format";
import { ErrorNote } from "../onboarding/ErrorNote";
import { WorkoutsNav } from "../workouts/WorkoutsNav";
import { HeightInput, WeightInput } from "./BodyInputs";
import { TrackingSettings } from "./TrackingSettings";
import { DebugJson } from "../../components/debug/Debug";

/** Height and weight over time, if the user tracks them. */
export function BodyPage() {
  const body = useBody();
  const me = useMe();
  const today = useDay(null).data?.today;

  return (
    <div className="space-y-6 pt-4">
      <header className="space-y-4">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-neon">Training</p>
          <h1 className="font-display text-4xl font-bold uppercase md:text-5xl">Body</h1>
        </div>
        <WorkoutsNav />
      </header>
      {(body.isPending || me.isPending || !today) && <p className="text-court-500">Loading…</p>}
      <ErrorNote error={body.error ?? me.error} />
      {body.data && me.data && today && (
        <>
          {body.data.trackWeight || body.data.trackHeight ? (
            <Tracked body={body.data} today={today} />
          ) : (
            <p className="rounded-xl border border-dashed border-court-700 p-6 text-center text-court-500">
              Height and weight tracking is off. Turn either on below to log it here and on each
              day's log.
            </p>
          )}
          <DebugJson label="body" data={body.data} />
          <div className="rounded-xl border border-court-700 bg-court-900/40 p-5">
            <TrackingSettings me={me.data} />
          </div>
        </>
      )}
    </div>
  );
}

function Tracked({ body, today }: { body: BodyDto; today: string }) {
  const units = body.unitSystem;
  const save = useSaveBody();
  const [date, setDate] = useState(today);
  const weights = body.entries.filter((e) => e.weightKg !== null);
  const heights = body.entries.filter((e) => e.heightCm !== null);
  const latestWeight = weights[0];
  const latestHeight = heights[0];
  const monthAgo = weights.find((e) => e.localDate <= addDays(today, -30));
  const change =
    latestWeight && monthAgo
      ? toDisplayWeight(latestWeight.weightKg! - monthAgo.weightKg!, units)
      : null;
  const onDate = body.entries.find((e) => e.localDate === date);
  const lb = weightUnit(units);

  return (
    <>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {body.trackWeight && (
          <StatTile
            label="Weight"
            value={latestWeight ? `${toDisplayWeight(latestWeight.weightKg!, units)}` : "—"}
            detail={latestWeight ? `${lb} · ${dayLabel(latestWeight.localDate)}` : "Not logged yet"}
          />
        )}
        {body.trackWeight && (
          <StatTile
            label="30-day change"
            value={change === null ? "—" : `${change > 0 ? "+" : ""}${change}`}
            detail={change === null ? "Needs a month of entries" : lb}
          />
        )}
        {body.trackHeight && (
          <StatTile
            label="Height"
            value={latestHeight ? formatHeight(latestHeight.heightCm!, units) : "—"}
            detail={latestHeight ? dayLabel(latestHeight.localDate) : "Not logged yet"}
          />
        )}
        {latestWeight && latestHeight && (
          <StatTile label="BMI" value={bmi(latestWeight.weightKg!, latestHeight.heightCm!)} />
        )}
      </dl>

      <section
        aria-label="Log measurements"
        className="space-y-3 rounded-xl border border-court-700 bg-court-900/70 p-4"
      >
        <div className="flex flex-wrap items-center gap-4">
          <h2 className="font-display text-lg uppercase tracking-wider">Log</h2>
          <input
            type="date"
            aria-label="Date"
            value={date}
            max={today}
            onChange={(e) => e.target.value && setDate(e.target.value)}
            className={compactFieldClass}
          />
        </div>
        {/* Keyed by date so the inputs reset to that day's values. */}
        <div key={date} className="flex flex-wrap items-center gap-6">
          {body.trackWeight && (
            <WeightInput
              kg={onDate?.weightKg ?? null}
              units={units}
              placeholderKg={latestWeight?.weightKg}
              onCommit={(weightKg) => save.mutate({ date, weightKg })}
            />
          )}
          {body.trackHeight && (
            <HeightInput
              cm={onDate?.heightCm ?? null}
              units={units}
              placeholderCm={latestHeight?.heightCm}
              onCommit={(heightCm) => save.mutate({ date, heightCm })}
            />
          )}
          <span aria-live="polite" className="text-xs uppercase tracking-wider text-court-500">
            {save.isPending ? "Saving…" : save.isSuccess ? "Saved" : ""}
          </span>
        </div>
        <ErrorNote error={save.error} />
      </section>

      {body.trackWeight && weights.length > 0 && (
        <section className="space-y-2 rounded-xl border border-court-700 bg-court-900/70 p-4">
          <h2 className="font-display text-lg uppercase tracking-wider">Weight</h2>
          <TrendChart
            label="Weight"
            points={[...weights]
              .reverse()
              .map((e) => ({ date: e.localDate, value: toDisplayWeight(e.weightKg!, units) }))}
            format={(v) => `${v} ${lb}`}
          />
        </section>
      )}

      {body.entries.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-display text-lg uppercase tracking-wider">Entries</h2>
          <ul className="divide-y divide-court-800 rounded-xl border border-court-700 bg-court-900/70">
            {body.entries.slice(0, 60).map((e) => (
              <li
                key={e.localDate}
                className="flex items-center justify-between gap-3 px-4 py-2 text-sm"
              >
                <button
                  type="button"
                  className="text-court-300 hover:text-neon"
                  onClick={() => setDate(e.localDate)}
                >
                  {dayLabel(e.localDate)}
                </button>
                <span className="flex items-center gap-4 tabular-nums">
                  {e.weightKg !== null && `${toDisplayWeight(e.weightKg, units)} ${lb}`}
                  {e.heightCm !== null && <span>{formatHeight(e.heightCm, units)}</span>}
                  <Button
                    variant="danger"
                    className="px-2 py-1"
                    aria-label={`Delete ${dayLabel(e.localDate)}`}
                    onClick={() =>
                      save.mutate({
                        date: e.localDate,
                        ...(e.weightKg !== null && { weightKg: null }),
                        ...(e.heightCm !== null && { heightCm: null }),
                      })
                    }
                  >
                    ✕
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
