import {
  addDays,
  BACKFILL_DAYS,
  formatHabitEntry,
  isHabitDone,
  TREND_THRESHOLD,
  type DayDto,
  type DayHabitDto,
  type RatedNodeDto,
  type RecapDto,
} from "@rlo/shared";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { useDay } from "../../api/days";
import { useActivity, useRatings } from "../../api/ratings";
import { DayPicker } from "../../components/DayPicker";
import { Delta } from "../../components/Delta";
import { OvrBadge } from "../../components/OvrBadge";
import { ErrorNote } from "../onboarding/ErrorNote";
import { FocusCard } from "./FocusCard";

const longDate = (date: string) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });

const STATUS_LABEL: Record<DayDto["status"], string> = {
  open: "Not recapped yet",
  recapped: "Recapped",
  stale: "Edited since recap",
};

/** Today at a glance: what's done, what's left, and how the ratings are moving. Logging is /log. */
export function TodayPage() {
  const day = useDay(null);
  const ratings = useRatings();

  if (ratings.data === null) {
    return (
      <div className="pt-16 text-center">
        <p className="font-display text-3xl uppercase">Build your rating first</p>
        <p className="mt-2 text-court-300">Daily logging moves ratings you don't have yet.</p>
        <Link to="/onboarding" className="mt-4 inline-block text-neon hover:underline">
          Start onboarding →
        </Link>
      </div>
    );
  }
  if (day.isPending) return <p className="pt-10 text-court-500">Loading…</p>;
  if (day.isError) return <ErrorNote error={day.error} />;
  const d = day.data;

  return (
    <div className="space-y-6 pt-4">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-neon">{longDate(d.today)}</p>
          <h1 className="font-display text-4xl font-bold uppercase md:text-5xl">Today</h1>
          <p className="mt-1 text-sm uppercase tracking-wider text-court-500">
            {STATUS_LABEL[d.status]}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <DayPicker today={d.today} />
          <Link
            to="/log"
            className="rounded-lg bg-neon px-6 py-3 font-display text-lg font-semibold uppercase tracking-wider text-court-950 hover:brightness-110"
          >
            {d.status === "open" ? "Log today →" : "Open today's log →"}
          </Link>
        </div>
      </header>

      <MissedRecaps today={d.today} />

      <div className="grid gap-6 md:grid-cols-2">
        <HabitsCard day={d} />
        <div className="space-y-6">
          {ratings.data && <RatingCard nodes={ratings.data.nodes} />}
          <JournalCard day={d} />
        </div>
      </div>

      <FocusCard />

      {d.recap ? (
        <RecapCard title="Today's recap" recap={d.recap} date={d.date} />
      ) : (
        <YesterdayCard today={d.today} />
      )}
    </div>
  );
}

function Card({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3 rounded-xl border border-court-700 bg-court-900/70 p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-display text-xl uppercase tracking-wider">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

const cardLink = "text-sm text-court-300 hover:text-neon";

function HabitsCard({ day }: { day: DayDto }) {
  const scheduled = day.habits.filter((h) => h.scheduled);
  const extra = day.habits.filter((h) => !h.scheduled && h.entry);
  const done = (h: DayHabitDto) =>
    Boolean(h.entry && isHabitDone(h.habit.type, h.habit.config, h.entry));
  const count = scheduled.filter(done).length;

  return (
    <Card
      title="Habits"
      action={
        <Link to="/habits" className={cardLink}>
          Stats →
        </Link>
      }
    >
      {scheduled.length === 0 && extra.length === 0 ? (
        <p className="text-sm text-court-500">
          Nothing scheduled today.{" "}
          <Link to="/habits/manage" className="text-neon hover:underline">
            Manage habits
          </Link>
        </p>
      ) : (
        <>
          {scheduled.length > 0 && (
            <div className="space-y-1">
              <p className="font-display text-3xl tabular-nums">
                {count}
                <span className="text-court-500">/{scheduled.length}</span>
                <span className="ml-2 text-sm uppercase tracking-wider text-court-300">done</span>
              </p>
              <div
                className="h-1.5 rounded-full bg-court-700"
                role="meter"
                aria-label="Habits done today"
                aria-valuemin={0}
                aria-valuemax={scheduled.length}
                aria-valuenow={count}
              >
                <div
                  className="h-full rounded-full bg-neon"
                  style={{ width: `${(100 * count) / scheduled.length}%` }}
                />
              </div>
            </div>
          )}
          <ul className="divide-y divide-court-800">
            {[...scheduled, ...extra].map((h) => (
              <li key={h.habit.id}>
                <Link
                  to={`/log#habit-${h.habit.id}`}
                  className="flex items-center gap-3 py-2 hover:text-neon"
                >
                  <span
                    aria-hidden
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-xs ${done(h) ? "border-neon bg-neon text-court-950" : "border-court-500"}`}
                  >
                    {done(h) ? "✓" : ""}
                  </span>
                  <span className="min-w-0 flex-1 truncate">
                    {h.habit.name}
                    {!h.scheduled && <span className="ml-2 text-xs text-court-500">bonus</span>}
                  </span>
                  <span className="max-w-[40%] truncate text-sm tabular-nums text-court-300">
                    {h.entry ? formatHabitEntry(h.habit.type, h.habit.config, h.entry) : "to do"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}

function RatingCard({ nodes }: { nodes: RatedNodeDto[] }) {
  const root = nodes.find((n) => n.parentId === null);
  if (root?.value == null) return null;
  const parents = new Set(nodes.map((n) => n.parentId));
  const movers = nodes
    .filter((n) => !parents.has(n.id) && n.trend != null && Math.abs(n.trend) >= TREND_THRESHOLD)
    .sort((a, b) => Math.abs(b.trend!) - Math.abs(a.trend!))
    .slice(0, 4);

  return (
    <Card
      title="Your rating"
      action={
        <Link to="/ratings" className={cardLink}>
          Full rating →
        </Link>
      }
    >
      <div className="flex items-center gap-4">
        <OvrBadge value={root.value} size="md" />
        <div>
          {root.trend != null && (
            <p className="text-sm text-court-300">
              <Delta value={root.trend} /> in the last 7 days
            </p>
          )}
          {root.projection != null && (
            <p className="text-sm text-court-500">
              Projected {root.projection.toFixed(1)} at season end
            </p>
          )}
        </div>
      </div>
      {movers.length > 0 && (
        <ul className="space-y-1 text-sm">
          {movers.map((n) => (
            <li key={n.id} className="flex items-center justify-between gap-3">
              <Link to={`/ratings/node/${n.id}`} className="truncate hover:text-neon">
                <span className={n.trend! > 0 ? "text-tier-green" : "text-tier-red"}>
                  {n.trend! > 0 ? "▲ hot" : "▼ cold"}
                </span>{" "}
                {n.name}
              </Link>
              <Delta value={n.trend!} />
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function JournalCard({ day }: { day: DayDto }) {
  const text = day.journal.trim();
  const answered = day.prompts.filter((p) => p.answer?.trim()).length;
  return (
    <Card
      title="Journal"
      action={
        <Link to="/log#journal" className={cardLink}>
          {text ? "Keep writing →" : "Write →"}
        </Link>
      }
    >
      {text ? (
        <p className="line-clamp-4 whitespace-pre-line text-sm text-court-300">{text}</p>
      ) : (
        <p className="text-sm text-court-500">Nothing written yet today.</p>
      )}
      {day.prompts.length > 0 && (
        <p className="text-xs uppercase tracking-wider text-court-500">
          {answered}/{day.prompts.length} guided questions answered
        </p>
      )}
    </Card>
  );
}

function RecapCard({ title, recap, date }: { title: string; recap: RecapDto; date: string }) {
  const top = [...recap.changes].sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, 4);
  const { overallBefore: before, overallAfter: after } = recap;
  return (
    <Card
      title={title}
      action={
        <Link to={`/log?date=${date}#recap`} className={cardLink}>
          Full recap →
        </Link>
      }
    >
      {before !== null && after !== null && (
        <p className="font-display text-lg tabular-nums text-court-300">
          OVR {before.toFixed(1)} → <span className="text-court-100">{after.toFixed(1)}</span>{" "}
          {Math.abs(after - before) >= 0.05 && <Delta value={after - before} />}
        </p>
      )}
      <p className="text-court-100">{recap.narrative}</p>
      {top.length > 0 && (
        <ul className="space-y-1 text-sm">
          {top.map((c) => (
            <li key={c.nodeId} className="grid grid-cols-[3.5rem_1fr] gap-2">
              <Delta value={c.delta} />
              <Link to={`/ratings/node/${c.nodeId}`} className="hover:text-neon">
                <span className="font-medium">{c.nodeName}</span>{" "}
                <span className="text-court-300">{c.reason}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function YesterdayCard({ today }: { today: string }) {
  const yesterday = addDays(today, -1);
  const day = useDay(yesterday);
  if (!day.data?.recap) return null;
  return <RecapCard title="Yesterday's recap" recap={day.data.recap} date={yesterday} />;
}

/** Past days in the backfill window that have entries but no current recap. */
function MissedRecaps({ today }: { today: string }) {
  const activity = useActivity(BACKFILL_DAYS + 1);
  const missed = (activity.data ?? []).filter((a) => a.date < today && a.logged && !a.recapped);
  if (!missed.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-tier-orange/40 bg-tier-orange/5 px-4 py-3 text-sm">
      <span className="text-court-100">
        {missed.length === 1 ? "A logged day hasn't" : `${missed.length} logged days haven't`} been
        recapped:
      </span>
      {missed.map((a) => (
        <Link key={a.date} to={`/log?date=${a.date}#recap`} className="text-neon hover:underline">
          {new Date(`${a.date}T00:00:00Z`).toLocaleDateString(undefined, {
            weekday: "short",
            month: "short",
            day: "numeric",
            timeZone: "UTC",
          })}
        </Link>
      ))}
    </div>
  );
}
