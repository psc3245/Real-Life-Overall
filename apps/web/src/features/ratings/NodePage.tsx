import { ratingTier, type RatedNodeDto } from "@rlo/shared";
import { Link, useParams } from "react-router";
import { useHabitStats } from "../../api/days";
import { useChangeFeed, useHistory, useRatings } from "../../api/ratings";
import { Button } from "../../components/Button";
import { HistoryChart } from "../../components/charts/HistoryChart";
import { Delta } from "../../components/Delta";
import { StatBar } from "../../components/StatBar";
import { tierColor } from "../../components/tier";
import { ErrorNote } from "../onboarding/ErrorNote";
import { ChangeList } from "./ActivityPage";
import { GoalEditor } from "./GoalEditor";

const CONFIDENCE_LABEL = { low: "Low", medium: "Medium", high: "High" } as const;

/** Everything about one attribute or category: value, history, why it moved, what feeds it. */
export function NodePage() {
  const { id = "" } = useParams();
  const ratings = useRatings();
  if (ratings.isPending) return <p className="pt-10 text-court-500">Loading…</p>;
  if (ratings.isError) return <ErrorNote error={ratings.error} />;
  const nodes = ratings.data?.nodes ?? [];
  const node = nodes.find((n) => n.id === id);
  if (!node) {
    return (
      <div className="pt-16 text-center">
        <p className="font-display text-3xl uppercase">Not in this season's tree</p>
        <Link to="/ratings" className="mt-4 inline-block text-neon hover:underline">
          Back to your rating →
        </Link>
      </div>
    );
  }
  // Remount per node so paging and charts reset.
  return <NodeDetail key={node.id} node={node} nodes={nodes} />;
}

function NodeDetail({ node, nodes }: { node: RatedNodeDto; nodes: RatedNodeDto[] }) {
  const history = useHistory(90);
  const feed = useChangeFeed({ nodeId: node.id });
  const habits = useHabitStats("week");

  const byId = new Map(nodes.map((n) => [n.id, n]));
  const ancestors: RatedNodeDto[] = [];
  for (let p = node.parentId ? byId.get(node.parentId) : undefined; p;) {
    ancestors.unshift(p);
    p = p.parentId ? byId.get(p.parentId) : undefined;
  }
  const children = nodes.filter((n) => n.parentId === node.id);
  const below = new Set([node.id]);
  for (let size = 0; size !== below.size;) {
    size = below.size;
    for (const n of nodes) if (n.parentId && below.has(n.parentId)) below.add(n.id);
  }
  const linked = (habits.data?.habits ?? []).filter((h) => h.habit.links.some((l) => below.has(l)));
  const color = tierColor(ratingTier(node.value ?? 0));
  const changes = feed.data?.pages.flat() ?? [];

  return (
    <div className="mx-auto max-w-3xl space-y-8 pt-4">
      <header className="space-y-3">
        <nav aria-label="Breadcrumb" className="flex flex-wrap gap-1.5 text-sm text-court-300">
          <Link to="/ratings" className="hover:text-neon">
            Rating
          </Link>
          {ancestors
            .filter((a) => a.parentId !== null)
            .map((a) => (
              <span key={a.id} className="flex gap-1.5">
                <span aria-hidden>›</span>
                <Link to={`/ratings/node/${a.id}`} className="hover:text-neon">
                  {a.name}
                </Link>
              </span>
            ))}
        </nav>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <h1 className="font-display text-4xl font-bold uppercase md:text-5xl">{node.name}</h1>
            {node.description && <p className="text-court-300">{node.description}</p>}
          </div>
          <div className="text-right">
            <p className="font-display text-6xl font-bold tabular-nums" style={{ color }}>
              {node.value?.toFixed(1) ?? "—"}
            </p>
            {node.trend != null && (
              <p className="text-sm text-court-300">
                <Delta value={node.trend} /> in 7 days
              </p>
            )}
          </div>
        </div>
        <GoalEditor node={node} />
      </header>

      {(node.rationale || node.decay || node.confidence) && (
        <section className="space-y-2 rounded-xl border border-court-700 bg-court-900/70 p-5">
          <h2 className="font-display text-lg uppercase tracking-wider">Why it's rated this way</h2>
          {node.rationale && <p className="text-court-100">{node.rationale}</p>}
          <dl className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
            {node.confidence && (
              <div className="flex gap-1.5">
                <dt className="text-court-500">Confidence</dt>
                <dd>{CONFIDENCE_LABEL[node.confidence]}</dd>
              </div>
            )}
            {node.decay && (
              <div className="flex gap-1.5">
                <dt className="text-court-500">Decay</dt>
                <dd>
                  {node.decay.perDay}/day after {node.decay.graceDays} idle day
                  {node.decay.graceDays === 1 ? "" : "s"}, floor {node.decay.floor}
                </dd>
              </div>
            )}
          </dl>
          {node.decay?.notes && <p className="text-sm text-court-500">{node.decay.notes}</p>}
        </section>
      )}

      <section className="space-y-3 rounded-xl border border-court-700 bg-court-900/70 p-5">
        <h2 className="font-display text-lg uppercase tracking-wider">History</h2>
        {history.data ? (
          <HistoryChart history={history.data} nodes={nodes} only={node} />
        ) : (
          <p className="text-sm text-court-500">Loading…</p>
        )}
      </section>

      {children.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-display text-lg uppercase tracking-wider">Made up of</h2>
          <ul className="space-y-3 rounded-xl border border-court-700 bg-court-900/70 p-5">
            {children.map((c) => (
              <li key={c.id}>
                <Link
                  to={`/ratings/node/${c.id}`}
                  className="block rounded-lg outline-none hover:opacity-90 focus-visible:ring-2 focus-visible:ring-neon"
                >
                  <StatBar label={c.name} value={c.value ?? 0} trend={c.trend} goal={c.goal} />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-display text-lg uppercase tracking-wider">Habits that feed it</h2>
          <Link to="/habits" className="text-sm text-court-300 hover:text-neon">
            Habit stats →
          </Link>
        </div>
        {linked.length ? (
          <ul className="divide-y divide-court-800 rounded-xl border border-court-700 bg-court-900/70">
            {linked.map((h) => (
              <li key={h.habit.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <span className="truncate font-medium">{h.habit.name}</span>
                <span className="text-sm tabular-nums text-court-300">
                  {h.completed}/{h.scheduled + h.remaining} this week · streak {h.currentStreak}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-court-500">
            No habits linked yet.{" "}
            <Link to="/habits/manage" className="text-neon hover:underline">
              Link one
            </Link>{" "}
            so recaps know what builds it.
          </p>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-display text-lg uppercase tracking-wider">Changes this season</h2>
          <Link
            to={`/ratings/activity?node=${node.id}`}
            className="text-sm text-court-300 hover:text-neon"
          >
            In the activity feed →
          </Link>
        </div>
        <ErrorNote error={feed.error} />
        {changes.length ? (
          <ChangeList items={changes} showDates />
        ) : (
          feed.data && <p className="text-sm text-court-500">No changes yet.</p>
        )}
        {feed.hasNextPage && (
          <Button disabled={feed.isFetchingNextPage} onClick={() => feed.fetchNextPage()}>
            {feed.isFetchingNextPage ? "Loading…" : "Load more"}
          </Button>
        )}
      </section>
    </div>
  );
}
