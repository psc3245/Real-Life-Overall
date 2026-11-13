import {
  CATEGORY_LABELS,
  formatSet,
  HEADLINE_RECORD,
  RECORD_LABELS,
  recordChartUnit,
  recordChartValue,
  SET_KIND_TAGS,
  TRACKING_LABELS,
  type ExerciseRecordsDto,
} from "@rlo/shared";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useArchiveExercise, useExercise } from "../../api/workouts";
import { Button } from "../../components/Button";
import { TrendChart } from "../../components/charts/TrendChart";
import { StatTile } from "../../components/StatTile";
import { dayLabel } from "../../lib/format";
import { ErrorNote } from "../onboarding/ErrorNote";
import { formatRecord } from "./format";
import { useUnits, WorkoutsNav } from "./WorkoutsNav";
import { DebugId, DebugJson } from "../../components/debug/Debug";
import { ChartLink } from "../charts/ChartLink";

export function ExercisePage() {
  const { id = "" } = useParams();
  const detail = useExercise(id);
  const units = useUnits();
  const archive = useArchiveExercise();
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);
  if (detail.isPending) return <p className="pt-10 text-court-500">Loading…</p>;
  if (detail.isError) return <ErrorNote error={detail.error} />;

  const { exercise: e, records, history } = detail.data;
  const headline = HEADLINE_RECORD[e.tracking];
  const recordKeys = (Object.keys(records) as (keyof ExerciseRecordsDto)[]).filter(
    (k) => records[k] !== null,
  );
  const points = [...history]
    .reverse()
    .filter((h) => h.best !== null)
    .map((h) => ({
      date: h.localDate,
      value: recordChartValue(headline, h.best!, units, e.tracking),
    }));
  const unit = recordChartUnit(headline, units, e.tracking);
  const chartUnit = unit === "%" ? "%" : unit === "reps" ? "" : ` ${unit}`;

  return (
    <div className="space-y-6 pt-4">
      <header className="space-y-4">
        <WorkoutsNav />
        <div>
          <Link to="/workouts/exercises" className="text-sm text-court-300 hover:text-neon">
            ← Exercises
          </Link>
          <h1 className="font-display text-4xl font-bold uppercase md:text-5xl">
            {e.name}
            <DebugId id={e.id} />
          </h1>
          <p className="text-sm text-court-500">
            {CATEGORY_LABELS[e.category]} · {TRACKING_LABELS[e.tracking]}
            {e.custom && " · custom"} · done {e.timesDone}×
            {/* The chart catalog only lists exercises from finished workouts. */}
            {e.timesDone > 0 && (
              <>
                {" · "}
                <ChartLink
                  ids={[`exercise:${e.id}`]}
                  config={{ range: "all", trend: true }}
                  className="text-neon hover:underline"
                />
              </>
            )}
          </p>
        </div>
      </header>

      {recordKeys.length > 0 ? (
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {recordKeys.map((k) => (
            <StatTile
              key={k}
              label={RECORD_LABELS[k]}
              value={formatRecord(k, records[k]!, units, e.tracking)}
            />
          ))}
        </dl>
      ) : (
        <p className="rounded-xl border border-dashed border-court-700 p-6 text-center text-court-500">
          No sets logged yet. Records and charts show up after your first workout with it.
        </p>
      )}

      {points.length > 0 && (
        <section className="space-y-2 rounded-xl border border-court-700 bg-court-900/70 p-4">
          <h2 className="font-display text-lg uppercase tracking-wider">
            {RECORD_LABELS[headline]}
          </h2>
          <TrendChart
            points={points}
            label={RECORD_LABELS[headline]}
            format={(v) => `${v}${chartUnit}`}
          />
        </section>
      )}

      {history.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-display text-xl uppercase tracking-wider">History</h2>
          {history.map((h) => {
            let working = 0;
            return (
              <Link
                key={`${h.workoutId}-${h.localDate}`}
                to={`/workouts/${h.workoutId}`}
                className="block rounded-xl border border-court-700 bg-court-900/70 p-4 hover:border-neon"
              >
                <p className="flex justify-between gap-3">
                  <span className="font-medium">{h.workoutName}</span>
                  <span className="text-sm text-court-500">{dayLabel(h.localDate)}</span>
                </p>
                <ol className="mt-1 space-y-0.5 text-sm tabular-nums text-court-300">
                  {h.sets.map((s, i) => {
                    if (s.kind !== "warmup") working += 1;
                    return (
                      <li key={i} className="flex gap-3">
                        <span className="w-6 text-center text-court-500">
                          {s.kind === "normal" ? working : SET_KIND_TAGS[s.kind]}
                        </span>
                        {formatSet(e.tracking, s, units)}
                      </li>
                    );
                  })}
                </ol>
              </Link>
            );
          })}
        </section>
      )}

      <DebugJson label="exercise detail" data={detail.data} />
      {e.custom && (
        <div className="border-t border-court-800 pt-4">
          {confirming ? (
            <span className="flex flex-wrap items-center gap-2 text-sm text-court-300">
              Remove from your library? Past workouts keep it.
              <Button
                variant="danger"
                disabled={archive.isPending}
                onClick={() =>
                  archive.mutate(e.id, { onSuccess: () => navigate("/workouts/exercises") })
                }
              >
                Yes, remove
              </Button>
              <Button variant="ghost" onClick={() => setConfirming(false)}>
                Keep
              </Button>
            </span>
          ) : (
            <Button variant="danger" onClick={() => setConfirming(true)}>
              Remove exercise
            </Button>
          )}
          <ErrorNote error={archive.error} />
        </div>
      )}
    </div>
  );
}
