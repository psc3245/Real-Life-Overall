import {
  cardioLine,
  cardioSession,
  distanceUnit,
  formatDuration,
  formatPace,
  toDisplayDistance,
  type CardioTotalsDto,
  type ExerciseDto,
  type UnitSystem,
  type WorkoutDto,
} from "@rlo/shared";
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { useCardioOverview, useDeleteWorkout, useExercises } from "../../api/workouts";
import { Button } from "../../components/Button";
import { DebugJson } from "../../components/debug/Debug";
import { Modal } from "../../components/Modal";
import { StatTile } from "../../components/StatTile";
import { dayLabel, longDate } from "../../lib/format";
import { useTalk } from "../../lib/talk";
import { ErrorNote } from "../onboarding/ErrorNote";
import { CardioForm, effortLabel } from "./CardioForm";
import { formatElapsed } from "./format";
import { useUnits, WorkoutsNav } from "./WorkoutsNav";

const distanceText = (m: number, units: UnitSystem) =>
  `${toDisplayDistance(m, units)} ${distanceUnit(units)}`;

/** The Cardio tab: log runs, rides and swims; last 7 and 30 days; bests per activity. */
export function CardioPage() {
  const talk = useTalk();
  const units = useUnits();
  const overview = useCardioOverview();
  const exercises = useExercises();
  const navigate = useNavigate();
  const [logging, setLogging] = useState(false);
  const byId = new Map((exercises.data ?? []).map((e) => [e.id, e]));
  const o = overview.data;

  return (
    <div className="space-y-8 pt-4">
      <header className="space-y-4">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-neon">Training</p>
          <h1 className="font-display text-4xl font-bold uppercase md:text-5xl">
            {talk.nav.workouts}
          </h1>
        </div>
        <WorkoutsNav />
      </header>

      <Button variant="primary" className="w-full py-3 text-base" onClick={() => setLogging(true)}>
        Log cardio
      </Button>

      {overview.isPending && <p className="text-court-500">Loading…</p>}
      <ErrorNote error={overview.error} />
      {o && (
        <>
          <section className="grid gap-3 md:grid-cols-2">
            <Totals title="Last 7 days" totals={o.week} units={units} />
            <Totals title="Last 30 days" totals={o.month} units={units} />
          </section>

          {o.activities.length > 0 && (
            <section className="space-y-3">
              <h2 className="font-display text-xl uppercase tracking-wider">Bests</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {o.activities.map((a) => (
                  <Link
                    key={a.activityId}
                    to={`/workouts/exercises/${a.activityId}`}
                    className="space-y-1 rounded-xl border border-court-700 bg-court-900/70 p-4 hover:border-neon"
                  >
                    <span className="block font-display text-lg uppercase tracking-wide">
                      {byId.get(a.activityId)?.name ?? "Unknown activity"}
                    </span>
                    <span className="block text-xs text-court-500">
                      {a.sessions} session{a.sessions === 1 ? "" : "s"}
                      {a.distanceM > 0 && ` · ${distanceText(a.distanceM, units)} total`}
                    </span>
                    <dl className="grid grid-cols-3 gap-2 pt-1 text-sm">
                      <Best
                        label="Longest"
                        value={a.longestM ? distanceText(a.longestM, units) : "—"}
                      />
                      <Best label="Time" value={a.longestS ? formatDuration(a.longestS) : "—"} />
                      <Best
                        label="Best pace"
                        value={
                          a.bestPaceSPerKm
                            ? (formatPace(a.activityId, 1000, a.bestPaceSPerKm, units) ?? "—")
                            : "—"
                        }
                      />
                    </dl>
                  </Link>
                ))}
              </div>
            </section>
          )}

          <section className="space-y-3">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="font-display text-xl uppercase tracking-wider">Recent</h2>
              <Link to="/workouts/history" className="text-sm text-neon hover:underline">
                All history →
              </Link>
            </div>
            {o.recent.length === 0 ? (
              <p className="rounded-xl border border-dashed border-court-700 p-6 text-center text-court-500">
                Runs, rides, swims and walks go here: time, distance, pace, heart rate and how hard
                it felt. They count on the day's log and in its recap like any workout.
              </p>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {o.recent.map((w) => (
                  <CardioCard key={w.id} workout={w} byId={byId} units={units} />
                ))}
              </div>
            )}
          </section>
          <DebugJson label="cardio overview" data={o} />
        </>
      )}

      <Modal open={logging} onClose={() => setLogging(false)} label="Log cardio" size="lg">
        <h2 className="mb-4 font-display text-2xl uppercase">Log cardio</h2>
        {logging && (
          <CardioForm
            onCancel={() => setLogging(false)}
            onDone={(w) => {
              setLogging(false);
              navigate(`/workouts/${w.id}`, { state: { justFinished: true } });
            }}
          />
        )}
      </Modal>
    </div>
  );
}

function Totals({
  title,
  totals: t,
  units,
}: {
  title: string;
  totals: CardioTotalsDto;
  units: UnitSystem;
}) {
  return (
    <div className="space-y-2">
      <h2 className="text-xs uppercase tracking-wider text-court-500">{title}</h2>
      <dl className="grid grid-cols-3 gap-3">
        <StatTile label="Sessions" value={t.sessions} />
        <StatTile
          label={distanceUnit(units)}
          value={t.distanceM > 0 ? toDisplayDistance(t.distanceM, units) : "—"}
        />
        <StatTile label="Time" value={t.durationS > 0 ? formatElapsed(t.durationS) : "—"} />
      </dl>
    </div>
  );
}

function Best({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wider text-court-500">{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}

/** A cardio session in a list: name, day and its one-line summary. */
export function CardioCard({
  workout: w,
  byId,
  units,
}: {
  workout: WorkoutDto;
  byId: Map<string, ExerciseDto>;
  units: UnitSystem;
}) {
  const s = cardioSession(w);
  return (
    <Link
      to={`/workouts/${w.id}`}
      className="block space-y-1 rounded-xl border border-court-700 bg-court-900/70 p-4 hover:border-neon"
    >
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-display text-lg uppercase tracking-wide">{w.name}</p>
        <span className="shrink-0 rounded-full bg-neon/10 px-2 py-0.5 text-[11px] uppercase tracking-wider text-neon">
          Cardio
        </span>
      </div>
      <p className="text-xs text-court-500">
        {dayLabel(w.localDate)}
        {w.name !== byId.get(s.activityId)?.name && ` · ${byId.get(s.activityId)?.name ?? ""}`}
      </p>
      <p className="text-sm tabular-nums text-court-300">
        {cardioLine(s.activityId, s.distanceM, s.durationS, w.cardio, units)}
      </p>
      {w.summary.prs.length > 0 && (
        <p className="text-sm text-tier-yellow">
          ★ {w.summary.prs.length} PR{w.summary.prs.length === 1 ? "" : "s"}
        </p>
      )}
    </Link>
  );
}

/** A finished cardio session: its numbers, records, and editing. */
export function CardioSessionView({
  workout: w,
  justFinished,
}: {
  workout: WorkoutDto;
  justFinished: boolean;
}) {
  const units = useUnits();
  const exercises = useExercises();
  const remove = useDeleteWorkout();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const s = cardioSession(w);
  const activity = exercises.data?.find((e) => e.id === s.activityId);
  const pace = formatPace(s.activityId, s.distanceM, s.durationS, units);
  const c = w.cardio;

  return (
    <div className="space-y-6 pt-4">
      <header className="space-y-4">
        <WorkoutsNav />
        {justFinished && (
          <p className="rounded-xl border border-neon/50 bg-neon/10 px-4 py-3 text-neon">
            Session logged. It's on that day's log and counts toward its recap.
          </p>
        )}
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-neon">
            {longDate(w.localDate)}
            {activity && w.name !== activity.name && ` · ${activity.name}`}
          </p>
          <h1 className="font-display text-4xl font-bold uppercase md:text-5xl">{w.name}</h1>
        </div>
      </header>

      {editing ? (
        <CardioForm
          session={w}
          onCancel={() => setEditing(false)}
          onDone={() => setEditing(false)}
        />
      ) : (
        <>
          <dl className="grid grid-cols-3 gap-3">
            <StatTile label="Time" value={formatDuration(s.durationS)} />
            <StatTile
              label={distanceUnit(units)}
              value={s.distanceM ? toDisplayDistance(s.distanceM, units) : "—"}
            />
            <StatTile label="Pace" value={pace ?? "—"} />
          </dl>
          {c && (c.avgHeartRate || c.calories || c.elevationM || c.effort) && (
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatTile label="Avg HR" value={c.avgHeartRate ?? "—"} />
              <StatTile label="Calories" value={c.calories ?? "—"} />
              <StatTile
                label={`Climb (${units === "imperial" ? "ft" : "m"})`}
                value={
                  c.elevationM
                    ? Math.round(units === "imperial" ? c.elevationM * 3.28084 : c.elevationM)
                    : "—"
                }
              />
              <StatTile
                label="Effort"
                value={c.effort ? `${c.effort}/10` : "—"}
                detail={c.effort ? effortLabel(c.effort) : undefined}
              />
            </dl>
          )}

          {w.summary.prs.length > 0 && (
            <section className="space-y-2 rounded-xl border border-tier-yellow/40 bg-tier-yellow/5 p-4">
              <h2 className="font-display text-lg uppercase tracking-wider text-tier-yellow">
                ★ Personal records
              </h2>
              <ul className="space-y-1 text-sm">
                {w.summary.prs.map((pr) => (
                  <li key={pr.exerciseId}>{pr.label}</li>
                ))}
              </ul>
            </section>
          )}
          {w.notes && <p className="whitespace-pre-wrap text-court-300">{w.notes}</p>}

          <div className="space-y-3 border-t border-court-800 pt-4">
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => setEditing(true)}>Edit session</Button>
              {activity && (
                <Link
                  to={`/workouts/exercises/${activity.id}`}
                  className="rounded-lg px-4 py-2 text-sm text-neon hover:underline"
                >
                  {activity.name} history →
                </Link>
              )}
              {confirming ? (
                <span className="flex items-center gap-1 text-sm text-court-300">
                  Delete this session?
                  <Button
                    variant="danger"
                    disabled={remove.isPending}
                    onClick={() =>
                      remove.mutate(w.id, { onSuccess: () => navigate("/workouts/cardio") })
                    }
                  >
                    Yes, delete
                  </Button>
                  <Button variant="ghost" onClick={() => setConfirming(false)}>
                    Keep
                  </Button>
                </span>
              ) : (
                <Button variant="danger" onClick={() => setConfirming(true)}>
                  Delete
                </Button>
              )}
            </div>
            <ErrorNote error={remove.error} />
          </div>
          <DebugJson label="cardio session (WorkoutDto)" data={w} />
        </>
      )}
    </div>
  );
}
