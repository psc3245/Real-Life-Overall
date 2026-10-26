import type { RatedNodeDto, SeasonDetailDto, SeasonDetailNode, SeasonMode } from "@rlo/shared";
import type { ReactNode } from "react";
import { Link, useParams } from "react-router";
import { ApiError } from "../../api/client";
import { useSeasonDetail } from "../../api/seasons";
import { Medallion } from "../../components/BadgeChip";
import { HistoryChart } from "../../components/charts/HistoryChart";
import { Delta } from "../../components/Delta";
import { OvrBadge } from "../../components/OvrBadge";
import { SectionNav } from "../../components/SectionNav";
import { formatScore, ScoreProvider } from "../../components/score";
import { StatBar } from "../../components/StatBar";
import { ErrorNote } from "../onboarding/ErrorNote";
import { EarlierWeek } from "../week/WeekPage";
import { seasonDates } from "../../lib/format";
import { StatTile } from "../../components/StatTile";
import { DebugJson } from "../../components/debug/Debug";

/** HistoryChart reads rated nodes; a season's nodes carry only what the chart needs. */
const asRated = (nodes: SeasonDetailNode[]): RatedNodeDto[] =>
  nodes.map((n, i) => ({
    id: n.id,
    parentId: n.parentId,
    name: n.name,
    description: "",
    depth: n.depth,
    weight: 1,
    sortOrder: i,
    templateKey: null,
    value: n.end,
    rating: null,
    rationale: null,
    confidence: null,
    decay: null,
    trend: null,
    goal: null,
    projection: null,
  }));

const change = (n: SeasonDetailNode) =>
  n.start !== null && n.end !== null ? n.end - n.start : null;

/** One season in full: how Overall and each category moved, the stats, badges and weeks. */
export function SeasonPage() {
  const { id = "" } = useParams();
  const detail = useSeasonDetail(id);
  if (detail.isPending) return <p className="pt-10 text-court-500">Loading…</p>;
  if (detail.isError) {
    if (detail.error instanceof ApiError && detail.error.status === 404) {
      return (
        <div className="pt-16 text-center">
          <p className="font-display text-3xl uppercase">Season not found</p>
          <Link to="/history" className="mt-4 inline-block text-neon hover:underline">
            All seasons →
          </Link>
        </div>
      );
    }
    return <ErrorNote error={detail.error} />;
  }
  return (
    <ScoreProvider mode={detail.data.mode} values={detail.data.nodes.map((n) => n.end)}>
      <Season s={detail.data} />
    </ScoreProvider>
  );
}

function Season({ s }: { s: SeasonDetailDto }) {
  const root = s.nodes.find((n) => n.parentId === null);
  const categories = s.nodes.filter((n) => n.parentId === root?.id);
  const leaves = s.nodes.filter((n) => !s.nodes.some((c) => c.parentId === n.id));
  const movers = leaves
    .filter((n) => change(n) !== null && Math.abs(change(n)!) >= 0.05)
    .sort((a, b) => Math.abs(change(b)!) - Math.abs(change(a)!))
    .slice(0, 6);
  const names = new Map(s.nodes.map((n) => [n.id, n.name]));
  // Node pages only exist for the current season's tree.
  const nodeLink = (n: SeasonDetailNode, children: ReactNode) =>
    s.current ? (
      <Link to={`/ratings/node/${n.id}`} className="hover:text-neon">
        {children}
      </Link>
    ) : (
      children
    );

  return (
    <div className="space-y-8 pt-4">
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <Link to="/history" className="text-sm text-court-300 hover:text-neon">
            ← History
          </Link>
          <h1 className="flex flex-wrap items-center gap-3 font-display text-4xl font-bold uppercase md:text-5xl">
            {s.label}
            <span
              className={`rounded border px-2 py-0.5 text-sm ${s.current ? "border-neon/50 text-neon" : "border-court-700 text-court-300"}`}
            >
              {s.current ? "In progress" : "Final"}
            </span>
          </h1>
          <p className="text-court-500">
            {seasonDates(s.startsOn, s.endsOn)}
            {s.archetype && ` · ${s.archetype}`}
          </p>
        </div>
        {root?.end != null && (
          <div className="flex items-center gap-4">
            <OvrBadge value={root.end} />
            {s.mode === "growth" ? (
              <p className="text-sm text-court-300">
                Gained {s.current ? "so far" : "over the season"}
              </p>
            ) : (
              root.start !== null && (
                <p className="text-sm text-court-300">
                  Started at {root.start.toFixed(1)}
                  <br />
                  <Delta value={root.end - root.start} className="text-lg" />{" "}
                  {s.current ? "so far" : "over the season"}
                </p>
              )
            )}
          </div>
        )}
      </header>

      <SectionNav
        sections={[
          { id: "stats", label: "Stats" },
          ...(s.history.dates.length > 1 ? [{ id: "chart", label: "History" }] : []),
          { id: "categories", label: "Categories" },
          ...(s.badges.length ? [{ id: "badges", label: "Badges" }] : []),
          ...(s.weeks.length ? [{ id: "weeks", label: "Weeks" }] : []),
        ]}
      />

      <dl id="stats" className="grid scroll-mt-16 grid-cols-2 gap-3 sm:grid-cols-5">
        <StatTile label="Days logged" value={s.stats.daysLogged} />
        <StatTile label="Recapped" value={s.stats.daysRecapped} />
        <StatTile label="Best streak" value={s.stats.bestLoggingStreak} />
        <StatTile label="Habits done" value={s.stats.habitCompletions} />
        <StatTile label="Weekly reviews" value={s.stats.weeklyReviews} />
      </dl>

      {s.history.dates.length > 1 && (
        <section
          id="chart"
          className="scroll-mt-16 space-y-3 rounded-xl border border-court-700 bg-court-900/70 p-5"
        >
          <h2 className="font-display text-2xl uppercase tracking-wider">History</h2>
          <HistoryChart history={s.history} nodes={asRated(s.nodes)} />
        </section>
      )}

      <section id="categories" className="scroll-mt-16 space-y-4">
        <h2 className="font-display text-2xl uppercase tracking-wider">Categories</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {categories.map((c) => {
            const attrs = s.nodes.filter((n) => n.parentId === c.id);
            return (
              <div
                key={c.id}
                className="space-y-3 rounded-xl border border-court-700 bg-court-900/70 p-5"
              >
                {nodeLink(c, <StatBar label={c.name} value={c.end ?? 0} />)}
                <StartEnd node={c} mode={s.mode} />
                {attrs.length > 0 && (
                  <ul className="space-y-1 border-t border-court-800 pt-3 text-sm">
                    {attrs.map((a) => (
                      <li key={a.id} className="flex items-center justify-between gap-3">
                        <span className="truncate">{nodeLink(a, a.name)}</span>
                        <StartEnd node={a} mode={s.mode} />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
        {movers.length > 0 && (
          <div className="space-y-2">
            <h3 className="font-display text-lg uppercase tracking-wider">Biggest moves</h3>
            <ul className="grid gap-2 sm:grid-cols-2">
              {movers.map((n) => (
                <li
                  key={n.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-court-800 px-3 py-2"
                >
                  <span className="truncate">{nodeLink(n, n.name)}</span>
                  <Delta value={change(n)!} />
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {s.badges.length > 0 && (
        <section id="badges" className="scroll-mt-16 space-y-3">
          <h2 className="font-display text-2xl uppercase tracking-wider">Badges earned</h2>
          <ul className="flex flex-wrap gap-3">
            {s.badges.map((b) => (
              <li
                key={`${b.key}-${b.tier}`}
                className="flex items-center gap-2 rounded-lg border border-court-800 px-3 py-2"
                title={b.description}
              >
                <Medallion tier={b.tier} size={26} />
                <span className="text-sm">{b.name}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {s.weeks.length > 0 && (
        <section id="weeks" className="scroll-mt-16 space-y-3">
          <h2 className="font-display text-2xl uppercase tracking-wider">Weekly reviews</h2>
          <ul className="space-y-2">
            {s.weeks.map((w) => (
              <EarlierWeek key={w.id} week={w} names={names} />
            ))}
          </ul>
        </section>
      )}
      <DebugJson label="season" data={s} />
    </div>
  );
}

function StartEnd({ node, mode }: { node: SeasonDetailNode; mode: SeasonMode }) {
  const d = change(node);
  if (mode === "growth") {
    return (
      <span className="text-sm tabular-nums text-court-300">
        {node.end === null ? "–" : `${formatScore(mode, node.end)} gained`}
      </span>
    );
  }
  return (
    <span className="flex items-center gap-2 text-sm tabular-nums">
      <span className="text-court-500">
        {node.start?.toFixed(1) ?? "–"} → {node.end?.toFixed(1) ?? "–"}
      </span>
      {d !== null && <Delta value={d} />}
    </span>
  );
}
