import {
  bestSet,
  formatSet,
  type ExerciseDto,
  type UnitSystem,
  type WorkoutDto,
} from "@rlo/shared";
import { Link } from "react-router";
import { useExercises, useWorkoutHistory } from "../../api/workouts";
import { Button } from "../../components/Button";
import { dayLabel } from "../../lib/format";
import { ErrorNote } from "../onboarding/ErrorNote";
import { formatElapsed, formatVolume } from "./format";
import { useUnits, WorkoutsNav } from "./WorkoutsNav";
import { DebugJson } from "../../components/debug/Debug";

export function WorkoutHistoryPage() {
  const history = useWorkoutHistory();
  const exercises = useExercises();
  const units = useUnits();
  const byId = new Map((exercises.data ?? []).map((e) => [e.id, e]));
  const workouts = history.data?.pages.flatMap((p) => p.workouts) ?? [];

  return (
    <div className="space-y-6 pt-4">
      <header className="space-y-4">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-neon">Training</p>
          <h1 className="font-display text-4xl font-bold uppercase md:text-5xl">History</h1>
        </div>
        <WorkoutsNav />
      </header>
      {history.isPending && <p className="text-court-500">Loading…</p>}
      <ErrorNote error={history.error} />
      {history.isSuccess && workouts.length === 0 && (
        <p className="rounded-xl border border-dashed border-court-700 p-8 text-center text-court-500">
          No workouts yet.{" "}
          <Link to="/workouts" className="text-neon hover:underline">
            Start one
          </Link>
          .
        </p>
      )}
      <div className="grid gap-3 md:grid-cols-2">
        {workouts.map((w) => (
          <WorkoutCard key={w.id} workout={w} byId={byId} units={units} />
        ))}
      </div>
      <DebugJson label="history pages" data={history.data?.pages} />
      {history.hasNextPage && (
        <div className="text-center">
          <Button
            disabled={history.isFetchingNextPage}
            onClick={() => void history.fetchNextPage()}
          >
            {history.isFetchingNextPage ? "Loading…" : "Load more"}
          </Button>
        </div>
      )}
    </div>
  );
}

export function WorkoutCard({
  workout: w,
  byId,
  units,
}: {
  workout: WorkoutDto;
  byId: Map<string, ExerciseDto>;
  units: UnitSystem;
}) {
  return (
    <Link
      to={`/workouts/${w.id}`}
      className="block space-y-3 rounded-xl border border-court-700 bg-court-900/70 p-4 hover:border-neon"
    >
      <div>
        <p className="font-display text-lg uppercase tracking-wide">{w.name}</p>
        <p className="text-xs text-court-500">{dayLabel(w.localDate)}</p>
      </div>
      <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-court-300">
        <span>⏱ {formatElapsed(w.summary.durationS)}</span>
        {w.summary.volumeKg > 0 && <span>{formatVolume(w.summary.volumeKg, units)}</span>}
        {w.summary.prs.length > 0 && (
          <span className="text-tier-yellow">
            ★ {w.summary.prs.length} PR{w.summary.prs.length === 1 ? "" : "s"}
          </span>
        )}
      </p>
      <table className="w-full text-sm">
        <thead className="text-[11px] uppercase tracking-wider text-court-500">
          <tr>
            <th className="text-left font-semibold">Exercise</th>
            <th className="text-right font-semibold">Best set</th>
          </tr>
        </thead>
        <tbody>
          {w.exercises.map((e, i) => {
            const info = byId.get(e.exerciseId);
            const best = info ? bestSet(info.tracking, e.sets) : null;
            return (
              <tr key={i}>
                <td className="truncate py-0.5 pr-3">
                  {e.sets.length} × {info?.name ?? "Unknown exercise"}
                </td>
                <td className="py-0.5 text-right tabular-nums text-court-300">
                  {best && info ? formatSet(info.tracking, best, units) : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Link>
  );
}
