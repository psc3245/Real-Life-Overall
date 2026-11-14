import {
  makePct,
  RECORD_LABELS,
  SPORT_LABELS,
  type ExerciseDto,
  type SportSkillDto,
  type SportTotalsDto,
  type UnitSystem,
  type WorkoutTemplateDto,
} from "@rlo/shared";
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import {
  useActiveWorkout,
  useExercises,
  useSportOverview,
  useStartWorkout,
  useTemplates,
} from "../../api/workouts";
import { Button } from "../../components/Button";
import { DebugJson } from "../../components/debug/Debug";
import { Modal } from "../../components/Modal";
import { StatTile } from "../../components/StatTile";
import { useTalk } from "../../lib/talk";
import { ErrorNote } from "../onboarding/ErrorNote";
import { formatElapsed, formatRecord, since } from "./format";
import { TemplateCard, TemplatePreview } from "./StartWorkoutPage";
import { WorkoutCard } from "./WorkoutHistoryPage";
import { useUnits, WorkoutsNav } from "./WorkoutsNav";

/**
 * The Sports tab: start a practice (live, set by set, from sport & skill drills), practice
 * templates, the last 7 and 30 days, and how each drill is going.
 */
export function SportsPage() {
  const talk = useTalk();
  const units = useUnits();
  const active = useActiveWorkout();
  const templates = useTemplates();
  const exercises = useExercises();
  const overview = useSportOverview();
  const start = useStartWorkout();
  const navigate = useNavigate();
  const [preview, setPreview] = useState<WorkoutTemplateDto | null>(null);
  const byId = new Map((exercises.data ?? []).map((e) => [e.id, e]));
  const practices = templates.data?.filter((t) => t.kind === "sport");
  const inProgress = active.data;
  const o = overview.data;

  const begin = (templateId?: string) =>
    start.mutate(templateId ? { templateId } : { kind: "sport" }, {
      onSuccess: () => navigate("/workouts/active"),
    });

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

      {inProgress ? (
        <Link
          to="/workouts/active"
          className="flex items-center justify-between gap-4 rounded-xl border border-neon bg-neon/10 p-5 hover:bg-neon/15"
        >
          <span>
            <span className="block text-xs uppercase tracking-wider text-neon">In progress</span>
            <span className="font-display text-2xl uppercase">{inProgress.name}</span>
          </span>
          <span className="font-display text-lg uppercase text-neon">Resume →</span>
        </Link>
      ) : (
        <Button
          variant="primary"
          className="w-full py-3 text-base"
          disabled={start.isPending}
          onClick={() => begin()}
        >
          {start.isPending ? "Starting…" : "Start a practice"}
        </Button>
      )}
      <ErrorNote error={start.error} />

      {overview.isPending && <p className="text-court-500">Loading…</p>}
      <ErrorNote error={overview.error} />
      {o && (
        <section className="grid gap-3 md:grid-cols-2">
          <Totals title="Last 7 days" totals={o.week} />
          <Totals title="Last 30 days" totals={o.month} />
        </section>
      )}

      <section className="space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-display text-xl uppercase tracking-wider">
            Practice plans{" "}
            {practices && practices.length > 0 && (
              <span className="text-court-500">({practices.length})</span>
            )}
          </h2>
          <Link
            to="/workouts/templates/new?kind=sport"
            className="text-sm text-neon hover:underline"
          >
            + Plan
          </Link>
        </div>
        {practices?.length === 0 && (
          <p className="rounded-xl border border-dashed border-court-700 p-6 text-center text-court-500">
            Plans are practices you repeat: a shooting workout, footwork and first touch, speed and
            agility day. Make one here, or save a finished practice as one.
          </p>
        )}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {practices?.map((t) => (
            <TemplateCard key={t.id} template={t} names={byId} onOpen={() => setPreview(t)} />
          ))}
        </div>
      </section>

      {o && o.skills.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-display text-xl uppercase tracking-wider">Skills</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {o.skills.map((s) => (
              <SkillCard key={s.exerciseId} skill={s} info={byId.get(s.exerciseId)} units={units} />
            ))}
          </div>
        </section>
      )}

      {o && (
        <section className="space-y-3">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-display text-xl uppercase tracking-wider">Recent practices</h2>
            <Link to="/workouts/history" className="text-sm text-neon hover:underline">
              All history →
            </Link>
          </div>
          {o.recent.length === 0 ? (
            <p className="rounded-xl border border-dashed border-court-700 p-6 text-center text-court-500">
              A practice works like a workout: add drills (free throws, ball handling, cone drills,
              serves), check off sets as you go, and it counts on the day's log and in its recap.
            </p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {o.recent.map((w) => (
                <WorkoutCard key={w.id} workout={w} byId={byId} units={units} />
              ))}
            </div>
          )}
          <DebugJson label="sport overview" data={o} />
        </section>
      )}

      <Modal open={preview !== null} onClose={() => setPreview(null)} label="Practice plan">
        {preview && (
          <TemplatePreview
            template={preview}
            names={byId}
            canStart={!inProgress}
            starting={start.isPending}
            onStart={() => begin(preview.id)}
            onClose={() => setPreview(null)}
          />
        )}
      </Modal>
    </div>
  );
}

function Totals({ title, totals: t }: { title: string; totals: SportTotalsDto }) {
  return (
    <div className="space-y-2">
      <h2 className="text-xs uppercase tracking-wider text-court-500">{title}</h2>
      <dl className="grid grid-cols-2 gap-3">
        <StatTile label="Practices" value={t.sessions} />
        <StatTile label="Time" value={t.durationS > 0 ? formatElapsed(t.durationS) : "—"} />
      </dl>
    </div>
  );
}

/** A drill: its sport, sessions, all-time best and, for shooting-style drills, 30-day %. */
function SkillCard({
  skill: s,
  info,
  units,
}: {
  skill: SportSkillDto;
  info?: ExerciseDto;
  units: UnitSystem;
}) {
  const pct = s.recent ? makePct(s.recent.makes, s.recent.attempts) : null;
  return (
    <Link
      to={`/workouts/exercises/${s.exerciseId}`}
      className="space-y-1 rounded-xl border border-court-700 bg-court-900/70 p-4 hover:border-neon"
    >
      <span className="block font-display text-lg uppercase tracking-wide">
        {info?.name ?? "Unknown drill"}
      </span>
      <span className="block text-xs text-court-500">
        {info?.sport ? `${SPORT_LABELS[info.sport]} · ` : ""}
        {s.sessions} session{s.sessions === 1 ? "" : "s"} · {since(s.lastDone)}
      </span>
      <dl className="grid grid-cols-2 gap-2 pt-1 text-sm">
        <div>
          <dt className="text-[11px] uppercase tracking-wider text-court-500">
            {RECORD_LABELS[s.headline]}
          </dt>
          <dd className="tabular-nums">
            {s.best !== null && info ? formatRecord(s.headline, s.best, units, info.stats) : "—"}
          </dd>
        </div>
        {s.recent && (
          <div>
            <dt className="text-[11px] uppercase tracking-wider text-court-500">Last 30 days</dt>
            <dd className="tabular-nums">
              {pct !== null ? `${pct}% (${s.recent.makes}/${s.recent.attempts})` : "—"}
            </dd>
          </div>
        )}
      </dl>
    </Link>
  );
}
