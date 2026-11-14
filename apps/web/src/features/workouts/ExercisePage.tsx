import {
  CATEGORY_LABELS,
  formatSet,
  RECORD_KEYS,
  RECORD_LABELS,
  recordChartUnit,
  recordChartValue,
  SET_KIND_TAGS,
  SPORT_LABELS,
  statLineLabel,
} from "@rlo/shared";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useArchiveExercise, useExercise } from "../../api/workouts";
import { Button } from "../../components/Button";
import { TrendChart } from "../../components/charts/TrendChart";
import { StatTile } from "../../components/StatTile";
import { dayLabel } from "../../lib/format";
import { Modal } from "../../components/Modal";
import { ErrorNote } from "../onboarding/ErrorNote";
import { ExerciseForm } from "./ExerciseForm";
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
  const [editing, setEditing] = useState(false);
  if (detail.isPending) return <p className="pt-10 text-court-500">Loading…</p>;
  if (detail.isError) return <ErrorNote error={detail.error} />;

  const { exercise: e, records, history } = detail.data;
  const headline = e.headline;
  // The headline record first, then the rest in their usual order.
  const recordKeys = [headline, ...RECORD_KEYS.filter((k) => k !== headline)].filter(
    (k) => records[k] != null,
  );
  const points = [...history]
    .reverse()
    .filter((h) => h.best !== null)
    .map((h) => ({
      date: h.localDate,
      value: recordChartValue(headline, h.best!, units, e.stats),
    }));
  const unit = recordChartUnit(headline, units, e.stats);
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
            {e.sport ? SPORT_LABELS[e.sport] : CATEGORY_LABELS[e.category]} ·{" "}
            {statLineLabel(e.stats)} · scored by {RECORD_LABELS[headline].toLowerCase()}
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
              value={formatRecord(k, records[k]!, units, e.stats)}
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
                        {formatSet(e, s, units)}
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
        <div className="flex flex-wrap items-start gap-2 border-t border-court-800 pt-4">
          {!confirming && <Button onClick={() => setEditing(true)}>Edit exercise</Button>}
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
          <Modal open={editing} onClose={() => setEditing(false)} label="Edit exercise">
            <h2 className="mb-4 font-display text-xl uppercase tracking-wider">Edit exercise</h2>
            {e.timesDone > 0 && (
              <p className="mb-3 text-xs text-court-500">
                Logged sets keep their numbers; a stat you remove just stops showing.
              </p>
            )}
            <ExerciseForm
              exercise={e}
              onSaved={() => setEditing(false)}
              onCancel={() => setEditing(false)}
            />
          </Modal>
        </div>
      )}
    </div>
  );
}
