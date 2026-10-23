import { addDays, MAX_HISTORY_DAYS, type RatedNodeDto, type WeekRange } from "@rlo/shared";
import { Link } from "react-router";
import { useHabitStats } from "../../api/days";
import { useActivity, useHistory } from "../../api/ratings";
import { Delta } from "../../components/Delta";
import { DayStrip, shortDate } from "../habits/DayStrip";

const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const daysBetween = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);

/**
 * The specifics of one week: logging and recaps per day, net rating movement, category moves
 * and each habit's week. `today` bounds a week that's still in progress.
 */
export function WeekBreakdown({
  week,
  today,
  nodes,
}: {
  week: WeekRange;
  today: string;
  nodes: RatedNodeDto[];
}) {
  // Activity and history are "last N days"; reach back to the day before the week.
  const span = Math.min(MAX_HISTORY_DAYS, daysBetween(addDays(week.start, -1), today) + 1);
  const activity = useActivity(span);
  const history = useHistory(span);
  const habits = useHabitStats("week", week.start);

  const dates = Array.from({ length: 7 }, (_, i) => addDays(week.start, i));
  const byDate = new Map((activity.data ?? []).map((a) => [a.date, a]));
  const past = dates.filter((d) => d <= today);
  const logged = past.filter((d) => byDate.get(d)?.logged).length;
  const recapped = past.filter((d) => byDate.get(d)?.recapped).length;
  const habitRows = habits.data?.habits ?? [];
  const scheduled = habitRows.reduce((n, h) => n + h.scheduled, 0);
  const completed = habitRows.reduce((n, h) => n + h.completed, 0);

  // Node values the evening before the week and at its (latest) end.
  const valueAt = (nodeId: string, date: string) => {
    if (!history.data) return null;
    const i = history.data.dates.indexOf(date);
    const series = history.data.series.find((s) => s.nodeId === nodeId);
    if (i < 0 || !series) return null;
    return series.values[i] ?? null;
  };
  const endDate = week.end < today ? week.end : today;
  const firstDate = history.data?.dates[0];
  const before = (id: string) =>
    valueAt(id, addDays(week.start, -1)) ??
    (firstDate && firstDate >= week.start ? valueAt(id, firstDate) : null);
  const root = nodes.find((n) => n.parentId === null);
  const categories = nodes.filter((n) => n.parentId === root?.id);
  const move = (id: string) => {
    const a = before(id);
    const b = valueAt(id, endDate);
    return a === null || b === null ? null : { from: a, to: b, delta: b - a };
  };
  const overall = root ? move(root.id) : null;

  const habitsOn = (date: string) => {
    const due = habitRows.filter((h) => h.days.find((d) => d.date === date)?.scheduled);
    return {
      due: due.length,
      done: due.filter((h) => h.days.find((d) => d.date === date)?.done).length,
    };
  };

  return (
    <div className="space-y-6">
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile label="Days logged" value={`${logged}/${past.length}`} />
        <Tile label="Recapped" value={`${recapped}/${past.length}`} />
        <Tile
          label="Habits done"
          value={scheduled ? `${Math.round((100 * completed) / scheduled)}%` : "—"}
          detail={scheduled ? `${completed} of ${scheduled}` : undefined}
        />
        <Tile
          label="Overall"
          value={overall ? overall.to.toFixed(1) : "—"}
          detail={overall ? <Delta value={overall.delta} /> : undefined}
        />
      </dl>

      {categories.length > 0 && history.data && (
        <section className="space-y-2">
          <h3 className="font-display text-lg uppercase tracking-wider">Category moves</h3>
          <ul className="grid gap-2 sm:grid-cols-2">
            {categories.map((c) => {
              const m = move(c.id);
              return (
                <li
                  key={c.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-court-800 px-3 py-2"
                >
                  <span className="truncate">{c.name}</span>
                  <span className="flex items-center gap-3 tabular-nums">
                    {m ? (
                      <>
                        <span className="text-sm text-court-500">
                          {m.from.toFixed(1)} → {m.to.toFixed(1)}
                        </span>
                        <Delta value={m.delta} />
                      </>
                    ) : (
                      <span className="text-court-500">—</span>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="space-y-2">
        <h3 className="font-display text-lg uppercase tracking-wider">Day by day</h3>
        <ol className="divide-y divide-court-800 rounded-xl border border-court-700 bg-court-900/70">
          {dates.map((date) => {
            const a = byDate.get(date);
            const h = habitsOn(date);
            const net = a ? a.gain - a.loss : 0;
            const ahead = date > today;
            return (
              <li key={date}>
                <Link
                  to={`/log?date=${date}`}
                  aria-disabled={ahead}
                  onClick={(e) => ahead && e.preventDefault()}
                  className={`grid grid-cols-[4.5rem_1fr_auto] items-center gap-3 px-4 py-2.5 ${ahead ? "pointer-events-none opacity-40" : "hover:bg-court-800/60"}`}
                >
                  <span>
                    <span className="block font-display uppercase">
                      {DAY_SHORT[new Date(`${date}T00:00:00Z`).getUTCDay()]}
                    </span>
                    <span className="text-xs text-court-500">{shortDate(date)}</span>
                  </span>
                  <span className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-court-300">
                    <span className={a?.logged ? "text-court-100" : "text-court-500"}>
                      {ahead ? "Ahead" : a?.logged ? "✓ Logged" : "Not logged"}
                    </span>
                    {a?.recapped && <span>Recapped</span>}
                    {h.due > 0 && (
                      <span className={h.done === h.due ? "text-neon" : ""}>
                        Habits {h.done}/{h.due}
                      </span>
                    )}
                  </span>
                  <span className="text-right tabular-nums">
                    {a && (a.gain || a.loss) ? (
                      <Delta value={net} />
                    ) : (
                      <span className="text-court-700">—</span>
                    )}
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      </section>

      {habitRows.length > 0 && (
        <section className="space-y-2">
          <h3 className="font-display text-lg uppercase tracking-wider">Habits this week</h3>
          <ul className="grid gap-3 sm:grid-cols-2">
            {habitRows.map((h) => (
              <li key={h.habit.id} className="space-y-2 rounded-lg border border-court-800 p-3">
                <p className="flex items-baseline justify-between gap-2">
                  <span className="truncate font-medium">{h.habit.name}</span>
                  <span className="text-sm tabular-nums text-court-300">
                    {h.completed}/{h.scheduled + h.remaining}
                    {h.average !== null && (
                      <span className="text-court-500">
                        {" "}
                        · avg {h.average}
                        {h.target !== null && `/${h.target}`}
                      </span>
                    )}
                  </span>
                </p>
                <DayStrip days={h.days} range="week" today={today} />
              </li>
            ))}
          </ul>
          <Link to="/habits" className="inline-block text-sm text-court-300 hover:text-neon">
            All habit stats →
          </Link>
        </section>
      )}
    </div>
  );
}

function Tile({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-court-700 bg-court-900/70 p-3">
      <dt className="text-xs uppercase tracking-wider text-court-500">{label}</dt>
      <dd className="font-display text-3xl tabular-nums">{value}</dd>
      {detail && <dd className="text-sm text-court-300">{detail}</dd>}
    </div>
  );
}
