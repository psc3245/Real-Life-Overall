import type { ChangeFeedItemDto } from "@rlo/shared";
import { Link, useSearchParams } from "react-router";
import { useChangeFeed, useRatings, type ChangeSource } from "../../api/ratings";
import { Button } from "../../components/Button";
import { Delta } from "../../components/Delta";
import { ErrorNote } from "../onboarding/ErrorNote";

export const SOURCE_LABEL: Record<ChangeSource, string> = {
  onboarding: "Scouting",
  daily_recap: "Recap",
  weekly_review: "Weekly",
  decay: "Decay",
  recalibration: "New season",
};

const FILTERS: { key: string; label: string; sources?: ChangeSource[] }[] = [
  { key: "all", label: "All" },
  { key: "recaps", label: "Daily recaps", sources: ["daily_recap"] },
  { key: "weekly", label: "Weekly", sources: ["weekly_review"] },
  { key: "decay", label: "Decay", sources: ["decay"] },
  { key: "setup", label: "Scouting & seasons", sources: ["onboarding", "recalibration"] },
];

export const dayLabel = (date: string) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });

/** Every rating change this season, newest first, filterable by source and category. */
export function ActivityPage() {
  const [params, setParams] = useSearchParams();
  const filter = FILTERS.find((f) => f.key === params.get("source")) ?? FILTERS[0]!;
  const nodeId = params.get("node") ?? undefined;
  const ratings = useRatings();
  const feed = useChangeFeed({ sources: filter.sources, nodeId });

  const nodes = ratings.data?.nodes ?? [];
  const root = nodes.find((n) => n.parentId === null);
  const categories = nodes.filter((n) => n.parentId === root?.id);
  const set = (key: string, value: string | undefined) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  const items = feed.data?.pages.flat() ?? [];
  const groups = groupByDay(items);

  return (
    <div className="mx-auto max-w-3xl space-y-6 pt-4">
      <header>
        <Link to="/ratings" className="text-sm text-court-300 hover:text-neon">
          ← Rating
        </Link>
        <h1 className="font-display text-4xl font-bold uppercase md:text-5xl">Activity</h1>
        <p className="text-court-300">Every change to your ratings this season, and why.</p>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            aria-pressed={filter.key === f.key}
            onClick={() => set("source", f.key === "all" ? undefined : f.key)}
            className={`rounded-full border px-3 py-1 text-sm ${filter.key === f.key ? "border-neon bg-neon/10 text-neon" : "border-court-700 text-court-300 hover:border-court-500"}`}
          >
            {f.label}
          </button>
        ))}
        {categories.length > 0 && (
          <select
            aria-label="Category"
            value={nodeId ?? ""}
            onChange={(e) => set("node", e.target.value || undefined)}
            className="ml-auto rounded-lg border border-court-700 bg-court-950 px-2 py-1.5 text-sm outline-none focus:border-neon"
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {feed.isPending && <p className="text-court-500">Loading…</p>}
      <ErrorNote error={feed.error} />
      {feed.data && items.length === 0 && (
        <p className="rounded-xl border border-dashed border-court-700 p-8 text-center text-court-500">
          No changes match.
        </p>
      )}

      <div className="space-y-5">
        {groups.map((g) => (
          <section key={g.key} aria-label={g.date ? dayLabel(g.date) : "Undated"}>
            <div className="mb-2 flex items-baseline justify-between gap-3">
              <h2 className="font-display text-lg uppercase tracking-wider">
                {g.date ? dayLabel(g.date) : "Undated"}
              </h2>
              <span className="flex items-baseline gap-3 text-sm">
                <Delta value={g.net} />
                {g.date && (
                  <Link to={`/log?date=${g.date}`} className="text-court-300 hover:text-neon">
                    Open day →
                  </Link>
                )}
              </span>
            </div>
            <ChangeList items={g.items} />
          </section>
        ))}
      </div>

      {feed.hasNextPage && (
        <div className="text-center">
          <Button disabled={feed.isFetchingNextPage} onClick={() => feed.fetchNextPage()}>
            {feed.isFetchingNextPage ? "Loading…" : "Load more"}
          </Button>
        </div>
      )}
    </div>
  );
}

/** Rows of rating changes; each links to its attribute (and, with `showDates`, its day). */
export function ChangeList({
  items,
  showDates = false,
}: {
  items: ChangeFeedItemDto[];
  showDates?: boolean;
}) {
  return (
    <ul className="divide-y divide-court-800 rounded-xl border border-court-700 bg-court-900/70">
      {items.map((c) => (
        <li key={c.id} className="grid grid-cols-[4rem_1fr_auto] items-baseline gap-3 px-4 py-2.5">
          <Delta value={c.delta} className="text-lg" />
          <div className="min-w-0">
            <Link to={`/ratings/node/${c.nodeId}`} className="font-medium hover:text-neon">
              {c.nodeName}
            </Link>
            <p className="text-sm text-court-300">{c.reason}</p>
          </div>
          <span className="text-right text-xs uppercase tracking-wider text-court-500">
            {SOURCE_LABEL[c.source]}
            {showDates && c.date && (
              <Link
                to={`/log?date=${c.date}`}
                className="block normal-case tracking-normal hover:text-neon"
              >
                {dayLabel(c.date)}
              </Link>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}

function groupByDay(items: ChangeFeedItemDto[]) {
  const groups: { key: string; date: string | null; net: number; items: ChangeFeedItemDto[] }[] =
    [];
  for (const item of items) {
    const date = item.date ?? null;
    const key = date ?? "undated";
    let group = groups.at(-1);
    if (!group || group.key !== `${key}-${groups.length - 1}`) {
      group = { key: `${key}-${groups.length}`, date, net: 0, items: [] };
      groups.push(group);
    }
    group.items.push(item);
    group.net = Math.round((group.net + item.delta) * 100) / 100;
  }
  return groups;
}
