import { Link } from "react-router";
import { useRatings } from "../../api/ratings";
import { useSeasonCards } from "../../api/seasons";
import { OvrBadge } from "../../components/OvrBadge";
import { ErrorNote } from "../onboarding/ErrorNote";
import { seasonDates } from "../../lib/format";

/** Every season: the one in progress first, then archived ones, newest first. */
export function HistoryPage() {
  const ratings = useRatings();
  const cards = useSeasonCards();
  if (ratings.isPending || cards.isPending) return <p className="pt-10 text-court-500">Loading…</p>;
  const error = ratings.error ?? cards.error;
  if (error) return <ErrorNote error={error} />;

  const live = ratings.data;
  const root = live?.nodes.find((n) => n.parentId === null);
  const rows = [
    ...(live
      ? [
          {
            id: live.season.id,
            label: live.season.label,
            dates: seasonDates(live.season.startsOn, live.season.endsOn),
            overall: root?.value ?? null,
            archetype: live.archetype?.name ?? null,
            categories: live.nodes
              .filter((n) => n.parentId === root?.id)
              .map((n) => ({ name: n.name, value: n.value })),
            current: true,
          },
        ]
      : []),
    ...(cards.data ?? []).map((c) => ({
      id: c.id,
      label: c.label,
      dates: seasonDates(c.startsOn, c.endsOn),
      overall: c.overall,
      archetype: c.archetype,
      categories: c.nodes
        .filter((n) => n.depth === 1)
        .map((n) => ({ name: n.name, value: n.value })),
      current: false,
    })),
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-6 pt-4">
      <header>
        <p className="text-sm uppercase tracking-[0.3em] text-neon">Seasons</p>
        <h1 className="font-display text-4xl font-bold uppercase md:text-5xl">History</h1>
        <p className="text-court-300">
          Each calendar quarter is a season. Open one to see how it went.
        </p>
      </header>
      {rows.length === 0 && (
        <p className="rounded-xl border border-dashed border-court-700 p-8 text-center text-court-500">
          Your first season starts when you finish onboarding.
        </p>
      )}
      <ul className="space-y-3">
        {rows.map((r) => (
          <li key={r.id}>
            <Link
              to={`/history/${r.id}`}
              className="flex items-center gap-4 rounded-xl border border-court-700 bg-court-900/70 p-4 transition hover:border-neon/60"
            >
              {r.overall !== null ? (
                <OvrBadge value={r.overall} size="md" />
              ) : (
                <span className="h-16 w-16 rounded-2xl border-2 border-court-700" />
              )}
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 font-display text-xl uppercase tracking-wider">
                  {r.label}
                  {r.current && (
                    <span className="rounded border border-neon/50 px-1.5 text-[11px] text-neon">
                      In progress
                    </span>
                  )}
                </p>
                <p className="text-sm text-court-500">
                  {r.dates}
                  {r.archetype && ` · ${r.archetype}`}
                </p>
                <p className="mt-1 truncate text-sm text-court-300">
                  {r.categories
                    .map((c) => `${c.name} ${c.value === null ? "–" : c.value.toFixed(0)}`)
                    .join(" · ")}
                </p>
              </div>
              <span aria-hidden className="text-court-500">
                →
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
