import {
  HABIT_TYPE_LABELS,
  statPeriod,
  type HabitProposalDto,
  type RatedNodeDto,
  type WeekRange,
  type WeeklyReviewDto,
} from "@rlo/shared";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { useDay } from "../../api/days";
import { useMe } from "../../api/hooks";
import { useRatings } from "../../api/ratings";
import { useResolveProposal, useRunWeekly, useSetWeekStart, useWeekly } from "../../api/weekly";
import { Button } from "../../components/Button";
import { EarnedBadges } from "../../components/BadgeChip";
import { Delta } from "../../components/Delta";
import { SectionNav } from "../../components/SectionNav";
import { ErrorNote } from "../onboarding/ErrorNote";
import { WeekBreakdown } from "./WeekBreakdown";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WORKING = ["Reading your week…", "Checking habits and decay…", "Setting next week's focus…"];

const fmt = (date: string) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });

export function WeekPage() {
  const weekly = useWeekly();
  const ratings = useRatings();
  const run = useRunWeekly();
  const [line, setLine] = useState(0);
  useEffect(() => {
    if (!run.isPending) return;
    const timer = setInterval(() => setLine((l) => (l + 1) % WORKING.length), 4000);
    return () => clearInterval(timer);
  }, [run.isPending]);

  if (ratings.data === null) {
    return (
      <div className="pt-16 text-center">
        <p className="font-display text-3xl uppercase">Build your rating first</p>
        <Link to="/onboarding" className="mt-4 inline-block text-neon hover:underline">
          Start onboarding →
        </Link>
      </div>
    );
  }
  if (weekly.isPending || ratings.isPending)
    return <p className="pt-10 text-court-500">Loading…</p>;
  if (weekly.isError) return <ErrorNote error={weekly.error} />;
  const { week, review, ready, history } = weekly.data;
  const names = new Map((ratings.data?.nodes ?? []).map((n) => [n.id, n.name]));

  return (
    <div className="space-y-8 pt-4">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-neon">Weekly review</p>
          <h1 className="font-display text-4xl font-bold uppercase md:text-5xl">
            {week ? `${fmt(week.start)} – ${fmt(week.end)}` : "Your week"}
          </h1>
        </div>
        <WeekStartPicker />
      </header>

      {!week && (
        <p className="rounded-xl border border-dashed border-court-700 p-8 text-center text-court-300">
          Your first weekly review arrives after your first full week. It runs automatically early
          the next morning, or you can run it here.
        </p>
      )}

      {ready && (
        <section className="space-y-3 rounded-xl border border-court-700 bg-court-900/70 p-5">
          <p className="text-court-300">
            This week is done. The scout reviews it as a whole: what worked, what slipped, your
            focus for next week, and any habits worth adding.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="primary"
              className="px-6 py-3 text-base"
              disabled={run.isPending}
              onClick={() => run.mutate()}
            >
              {run.isPending ? WORKING[line] : "Run weekly review"}
            </Button>
            {run.isPending && <span className="text-sm text-court-500">Up to a minute.</span>}
          </div>
          <ErrorNote error={run.error} />
        </section>
      )}

      <SectionNav
        sections={[
          ...(review ? [{ id: "review", label: "Review" }] : []),
          { id: "detail", label: "Week in detail" },
          ...(history.length ? [{ id: "earlier", label: "Earlier weeks" }] : []),
        ]}
      />

      {review && (
        <div id="review" className="scroll-mt-16">
          <ReviewCard review={review} names={names} />
        </div>
      )}

      <div id="detail" className="scroll-mt-16">
        <WeekDetail lastWeek={week} nodes={ratings.data?.nodes ?? []} />
      </div>

      {history.length > 0 && (
        <section id="earlier" className="scroll-mt-16 space-y-3">
          <h2 className="font-display text-2xl uppercase tracking-wider">Earlier weeks</h2>
          <ul className="space-y-2">
            {history.map((h) => (
              <li key={h.id} className="rounded-xl border border-court-700 bg-court-900/70 p-4">
                <p className="text-xs uppercase tracking-wider text-court-500">
                  {fmt(h.weekStart)} – {fmt(h.weekEnd)}
                </p>
                <p className="mt-1 text-sm text-court-300">{h.narrative}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/** Day-by-day specifics for the week in progress or the last finished one. */
function WeekDetail({ lastWeek, nodes }: { lastWeek: WeekRange | null; nodes: RatedNodeDto[] }) {
  const me = useMe();
  const today = useDay(null).data?.today;
  const [which, setWhich] = useState<"current" | "last">(lastWeek ? "last" : "current");
  if (!today || !me.data) return null;
  const current = statPeriod("week", today, me.data.weekStart);
  const week = which === "last" && lastWeek ? lastWeek : current;
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="font-display text-2xl uppercase tracking-wider">Week in detail</h2>
        <div
          role="tablist"
          aria-label="Which week"
          className="flex rounded-lg border border-court-700"
        >
          {(
            [
              ["current", "This week"],
              ["last", "Last week"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={which === key}
              disabled={key === "last" && !lastWeek}
              onClick={() => setWhich(key)}
              className={`px-3 py-1.5 font-display text-sm uppercase tracking-wider first:rounded-l-lg last:rounded-r-lg disabled:opacity-30 ${which === key ? "bg-neon text-court-950" : "text-court-300 hover:text-court-100"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <p className="text-sm text-court-500">
        {fmt(week.start)} – {fmt(week.end)}
        {week === current && " · so far"}
      </p>
      <WeekBreakdown week={week} today={today} nodes={nodes} />
    </section>
  );
}

function WeekStartPicker() {
  const me = useMe();
  const set = useSetWeekStart();
  if (!me.data) return null;
  return (
    <label className="flex items-center gap-2 text-sm text-court-300">
      Weeks start on
      <select
        aria-label="Weeks start on"
        value={me.data.weekStart}
        disabled={set.isPending}
        onChange={(e) => set.mutate(Number(e.target.value))}
        className="rounded-lg border border-court-700 bg-court-950 px-2 py-1.5 outline-none focus:border-neon"
      >
        {[1, 0, 6].map((d) => (
          <option key={d} value={d}>
            {DAY_NAMES[d]}
          </option>
        ))}
      </select>
    </label>
  );
}

function ReviewCard({ review, names }: { review: WeeklyReviewDto; names: Map<string, string> }) {
  const { overallStart: start, overallEnd: end } = review;
  return (
    <article className="space-y-6 rounded-xl border border-neon/40 bg-court-900 p-5">
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="font-display text-2xl uppercase tracking-wider text-neon">The week</h2>
        {start !== null && end !== null && (
          <p className="font-display text-lg tabular-nums text-court-300">
            OVR {start.toFixed(1)} → <span className="text-court-100">{end.toFixed(1)}</span>{" "}
            {Math.abs(end - start) >= 0.05 && <Delta value={end - start} className="text-base" />}
          </p>
        )}
      </header>
      <p className="text-court-100">{review.narrative}</p>
      <EarnedBadges badges={review.badges} />
      {review.archetypeChange && (
        <p className="rounded-lg border border-neon/40 bg-neon/5 p-3 text-sm">
          <span className="font-display uppercase tracking-wider text-neon">New archetype: </span>
          {review.archetypeChange.from && (
            <span className="text-court-500 line-through">{review.archetypeChange.from}</span>
          )}{" "}
          <span className="font-semibold">{review.archetypeChange.to}</span>.{" "}
          <span className="text-court-300">{review.archetypeChange.description}</span>
        </p>
      )}

      {review.focusGoals.length > 0 && (
        <section className="space-y-2">
          <h3 className="font-display text-lg uppercase tracking-wider">Next week's focus</h3>
          <ol className="space-y-2">
            {review.focusGoals.map((g, i) => (
              <li key={g.title} className="flex gap-3">
                <span className="font-display text-xl text-neon tabular-nums">{i + 1}</span>
                <div>
                  <p className="font-medium">{g.title}</p>
                  <p className="text-sm text-court-300">{g.detail}</p>
                  {g.nodeIds.length > 0 && (
                    <p className="mt-1 flex flex-wrap gap-1.5">
                      {g.nodeIds.map((id) => (
                        <span
                          key={id}
                          className="rounded bg-court-800 px-1.5 py-0.5 text-[11px] uppercase tracking-wider text-court-300"
                        >
                          {names.get(id) ?? "?"}
                        </span>
                      ))}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      {review.habitProposals.length > 0 && (
        <section className="space-y-2">
          <h3 className="font-display text-lg uppercase tracking-wider">Suggested habits</h3>
          <ul className="space-y-2">
            {review.habitProposals.map((p) => (
              <Proposal key={p.index} reviewId={review.id} proposal={p} names={names} />
            ))}
          </ul>
        </section>
      )}

      {review.corrections.length > 0 && (
        <section className="space-y-1">
          <h3 className="font-display text-lg uppercase tracking-wider">Weekly adjustments</h3>
          <ul className="divide-y divide-court-800">
            {review.corrections.map((c) => (
              <li key={c.nodeId} className="grid grid-cols-[4rem_1fr] gap-3 py-2">
                <Delta value={c.delta} className="text-lg" />
                <div>
                  <p className="font-medium">{c.nodeName}</p>
                  <p className="text-sm text-court-300">{c.reason}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {review.decayRevisions.length > 0 && (
        <section className="space-y-1">
          <h3 className="font-display text-lg uppercase tracking-wider">Decay rule changes</h3>
          <ul className="space-y-1 text-sm">
            {review.decayRevisions.map((d) => (
              <li key={d.nodeId}>
                <span className="font-medium">{d.nodeName}:</span>{" "}
                <span className="text-court-300">
                  fades {d.perDay}/day after {d.graceDays} idle days, floor {d.floor}. {d.reason}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}

function Proposal({
  reviewId,
  proposal: p,
  names,
}: {
  reviewId: string;
  proposal: HabitProposalDto;
  names: Map<string, string>;
}) {
  const resolve = useResolveProposal();
  const schedule = p.days.length === 7 ? "every day" : p.days.map((d) => DAY_SHORT[d]).join(", ");
  const goal =
    p.target !== null && (p.type === "counter" || p.type === "duration")
      ? ` · goal ${p.target} ${p.type === "duration" ? "min" : (p.unit ?? "")}`
      : "";
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-court-700 p-3">
      <div className="min-w-0">
        <p className="font-medium">{p.name}</p>
        <p className="text-sm text-court-500">
          {HABIT_TYPE_LABELS[p.type]} · {schedule}
          {goal}
          {p.nodeIds.length > 0 && ` · ${p.nodeIds.map((id) => names.get(id) ?? "?").join(", ")}`}
        </p>
        <p className="text-sm text-court-300">{p.reason}</p>
        <ErrorNote error={resolve.error} />
      </div>
      {p.status === "pending" ? (
        <div className="flex gap-1">
          <Button
            variant="primary"
            disabled={resolve.isPending}
            onClick={() => resolve.mutate({ id: reviewId, index: p.index, action: "accept" })}
          >
            Add habit
          </Button>
          <Button
            variant="ghost"
            disabled={resolve.isPending}
            onClick={() => resolve.mutate({ id: reviewId, index: p.index, action: "dismiss" })}
          >
            No thanks
          </Button>
        </div>
      ) : (
        <span className="text-xs uppercase tracking-wider text-court-500">
          {p.status === "accepted" ? "✓ Added" : "Dismissed"}
        </span>
      )}
    </li>
  );
}
