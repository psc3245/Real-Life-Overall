import {
  HABIT_STAT_RANGES,
  HABIT_TYPE_LABELS,
  type HabitStatRange,
  type HabitStatsDto,
} from "@rlo/shared";
import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import { useHabitStats } from "../../api/days";
import { useRatings } from "../../api/ratings";
import { NodeChip } from "../../components/NodeChip";
import { ErrorNote } from "../onboarding/ErrorNote";
import { DayStrip } from "./DayStrip";
import { scheduleLabel } from "./ManageHabitsPage";
import { StatTile } from "../../components/StatTile";
import { shortDate } from "../../lib/format";
import { DebugJson } from "../../components/debug/Debug";

const RANGE_LABEL: Record<HabitStatRange, string> = {
  week: "Week",
  month: "Month",
  season: "Season",
};

const pct = (rate: number | null) => (rate === null ? "—" : `${Math.round(rate * 100)}%`);

/** Every habit's completion, averages and streaks for this week, month or season. */
export function HabitsGlancePage() {
  const [params, setParams] = useSearchParams();
  const range = (HABIT_STAT_RANGES as readonly string[]).includes(params.get("range") ?? "")
    ? (params.get("range") as HabitStatRange)
    : "week";
  const stats = useHabitStats(range);
  const ratings = useRatings();
  const names = new Map((ratings.data?.nodes ?? []).map((n) => [n.id, n.name]));

  const all = stats.data?.habits ?? [];
  // Groups count once (their sub-habits show inside the group's card).
  const habits = all.filter((h) => !h.habit.parentId);
  const scheduled = habits.reduce((n, h) => n + h.scheduled, 0);
  const completed = habits.reduce((n, h) => n + h.completed, 0);
  const remaining = habits.reduce((n, h) => n + h.remaining, 0);
  const hottest = habits.reduce<HabitStatsDto | null>(
    (best, h) => (h.currentStreak > (best?.currentStreak ?? 0) ? h : best),
    null,
  );

  return (
    <div className="space-y-6 pt-4">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-neon">At a glance</p>
          <h1 className="font-display text-4xl font-bold uppercase md:text-5xl">Habits</h1>
          {stats.data && (
            <p className="text-sm text-court-500">
              {shortDate(stats.data.start)} – {shortDate(stats.data.end)}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div
            role="tablist"
            aria-label="Period"
            className="flex rounded-lg border border-court-700"
          >
            {HABIT_STAT_RANGES.map((r) => (
              <button
                key={r}
                type="button"
                role="tab"
                aria-selected={range === r}
                onClick={() => setParams(r === "week" ? {} : { range: r }, { replace: true })}
                className={`px-3 py-1.5 font-display text-sm uppercase tracking-wider first:rounded-l-lg last:rounded-r-lg ${range === r ? "bg-neon text-court-950" : "text-court-300 hover:text-court-100"}`}
              >
                {RANGE_LABEL[r]}
              </button>
            ))}
          </div>
          <Link to="/habits/manage" className="text-sm text-court-300 hover:text-neon">
            Manage →
          </Link>
        </div>
      </header>

      {stats.isPending && <p className="text-court-500">Loading…</p>}
      <ErrorNote error={stats.error} />

      {stats.data && habits.length === 0 && (
        <p className="rounded-xl border border-dashed border-court-700 p-8 text-center text-court-500">
          No habits yet.{" "}
          <Link to="/habits/manage" className="text-neon hover:underline">
            Add your first one
          </Link>
          .
        </p>
      )}

      {habits.length > 0 && (
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile label="Completion" value={pct(scheduled ? completed / scheduled : null)} />
          <StatTile label="Done" value={`${completed}/${scheduled}`} />
          <StatTile label={`Left this ${range}`} value={String(remaining)} />
          <StatTile
            label="Best streak going"
            value={hottest ? String(hottest.currentStreak) : "0"}
            detail={hottest?.habit.name}
          />
        </dl>
      )}

      <ul className="grid gap-4 lg:grid-cols-2">
        {habits.map((h) => (
          <HabitCard
            key={h.habit.id}
            stats={h}
            subs={all.filter((c) => c.habit.parentId === h.habit.id)}
            range={range}
            today={stats.data!.today}
            names={names}
          />
        ))}
      </ul>
      <DebugJson label="habit stats" data={stats.data} />
    </div>
  );
}

function HabitCard({
  stats: s,
  subs,
  range,
  today,
  names,
}: {
  stats: HabitStatsDto;
  subs: HabitStatsDto[];
  range: HabitStatRange;
  today: string;
  names: Map<string, string>;
}) {
  const [open, setOpen] = useState(false);
  const { habit } = s;
  return (
    <li className="space-y-3 rounded-xl border border-court-700 bg-court-900/70 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-display text-lg uppercase">{habit.name}</p>
          <p className="text-xs text-court-500">
            {HABIT_TYPE_LABELS[habit.type]} · {scheduleLabel(habit.days)}
          </p>
          {habit.links.length > 0 && (
            <p className="mt-1 flex flex-wrap gap-1.5">
              {habit.links.map((id) => (
                <NodeChip key={id} id={id} name={names.get(id)} />
              ))}
            </p>
          )}
        </div>
        <p className="text-right">
          <span className="font-display text-3xl tabular-nums">{pct(s.rate)}</span>
          <span className="block text-xs text-court-500">
            {s.completed}/{s.scheduled} {habit.config.direction === "avoid" ? "kept" : "done"}
          </span>
        </p>
      </div>

      <div className="h-1.5 rounded-full bg-court-700">
        <div
          className="h-full rounded-full bg-neon"
          style={{ width: `${Math.round((s.rate ?? 0) * 100)}%` }}
        />
      </div>

      <dl className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
        <Fact label={`Left this ${range}`} value={`${s.remaining}`} />
        {s.average !== null && (
          <Fact
            label="Avg"
            value={`${s.average}${s.target !== null ? ` / ${s.target}` : ""}`}
            suffix={habit.type === "duration" ? "min" : (habit.config.unit ?? "")}
          />
        )}
        <Fact label="Streak" value={String(s.currentStreak)} />
        <Fact
          label="Best"
          value={String(s.bestStreak)}
          suffix={s.bestStreakEnd ? `(to ${shortDate(s.bestStreakEnd)})` : ""}
        />
        {s.bonus > 0 && <Fact label="Bonus days" value={String(s.bonus)} />}
        {habit.config.direction === "avoid" && <Fact label="Slips" value={String(s.slips)} />}
      </dl>

      <DayStrip days={s.days} range={range} today={today} />

      {subs.length > 0 && (
        <ul className="space-y-1 border-t border-court-800 pt-3 text-sm" aria-label="Sub-habits">
          {subs.map((c) => (
            <li key={c.habit.id} className="flex items-center gap-3">
              <span className="min-w-0 flex-1 truncate">{c.habit.name}</span>
              {c.habit.links.map((id) => (
                <NodeChip key={id} id={id} name={names.get(id)} />
              ))}
              <span className="tabular-nums text-court-300">
                {c.completed}/{c.scheduled}
              </span>
              <span className="w-10 text-right font-display tabular-nums">{pct(c.rate)}</span>
            </li>
          ))}
        </ul>
      )}

      {s.recent.length > 0 && (
        <div>
          <button
            type="button"
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
            className="text-sm text-court-300 hover:text-neon"
          >
            {open ? "Hide recent entries ▲" : "Recent entries ▼"}
          </button>
          {open && (
            <ul className="mt-2 space-y-1 text-sm">
              {s.recent.map((r) => (
                <li key={r.date} className="flex gap-3">
                  <Link
                    to={`/log?date=${r.date}#habit-${habit.id}`}
                    className="w-16 shrink-0 text-court-500 hover:text-neon"
                  >
                    {shortDate(r.date)}
                  </Link>
                  <span className="min-w-0 break-words text-court-100">{r.value}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </li>
  );
}

function Fact({ label, value, suffix }: { label: string; value: string; suffix?: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <dt className="text-xs uppercase tracking-wider text-court-500">{label}</dt>
      <dd className="tabular-nums">
        {value}
        {suffix && <span className="ml-1 text-court-500">{suffix}</span>}
      </dd>
    </div>
  );
}
