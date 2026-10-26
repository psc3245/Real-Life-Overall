import type { RatedNodeDto, RatingsDto } from "@rlo/shared";
import { toPng } from "html-to-image";
import { useRef, useState } from "react";
import { Link } from "react-router";
import { useMe } from "../../api/hooks";
import { useActivity, useChangeFeed, useHistory, useRatings } from "../../api/ratings";
import { ActivityHeatmap } from "../../components/charts/ActivityHeatmap";
import { HistoryChart } from "../../components/charts/HistoryChart";
import { ShapeRadar } from "../../components/charts/ShapeRadar";
import { Button } from "../../components/Button";
import { PlayerCard } from "../../components/PlayerCard";
import { StatBar } from "../../components/StatBar";
import { SectionNav } from "../../components/SectionNav";
import { ErrorNote } from "../onboarding/ErrorNote";
import { ChangeList } from "./ActivityPage";
import { BadgesSection } from "./BadgesSection";
import { DecayCard } from "./DecayCard";
import { NewSeasonBanner, PastSeasons } from "./SeasonSections";
import { GoalEditor } from "./GoalEditor";
import { CONFIDENCE_LABEL } from "./labels";
import { DebugJson } from "../../components/debug/Debug";

const RATINGS_SECTIONS = [
  { id: "card", label: "Card" },
  { id: "charts", label: "Charts" },
  { id: "badges", label: "Badges" },
  { id: "activity", label: "Activity" },
  { id: "categories", label: "Categories" },
  { id: "seasons", label: "Seasons" },
  { id: "decay", label: "Decay" },
];

export function RatingsPage() {
  const ratings = useRatings();
  const me = useMe();

  if (ratings.isPending) return <p className="pt-10 text-court-500">Loading…</p>;
  if (ratings.isError) return <ErrorNote error={ratings.error} />;
  if (!ratings.data) {
    return (
      <div className="pt-16 text-center">
        <p className="font-display text-3xl uppercase">No rating yet</p>
        <Link to="/onboarding" className="mt-4 inline-block text-neon hover:underline">
          Build your rating →
        </Link>
      </div>
    );
  }

  const data = ratings.data;
  const root = data.nodes.find((n) => n.parentId === null);
  const categories = data.nodes.filter((n) => n.parentId === root?.id);

  return (
    <div className="space-y-10 pt-4">
      <NewSeasonBanner />
      <SectionNav sections={RATINGS_SECTIONS} />
      <div id="card" className="grid scroll-mt-16 gap-8 md:grid-cols-[1fr_1.2fr] md:items-start">
        <ExportableCard
          ratings={data}
          name={me.data?.displayName ?? "Player"}
          username={me.data?.username}
        />
        <div className="space-y-3">
          <h1 className="font-display text-4xl font-bold uppercase">Scouting report</h1>
          {data.archetype && (
            <p className="text-court-300">
              <span className="font-semibold text-neon">{data.archetype.name}.</span>{" "}
              {data.archetype.description}
            </p>
          )}
          {data.summary && <p className="text-court-300">{data.summary}</p>}
          {root && (
            <div className="rounded-lg border border-court-800 p-3">
              <p className="mb-1 text-xs uppercase tracking-wider text-court-300">
                Overall potential
              </p>
              <GoalEditor node={root} />
            </div>
          )}
          <p className="text-sm text-court-500">
            Tap any attribute to see why it's rated that way.
          </p>
        </div>
      </div>

      <div id="charts" className="scroll-mt-16">
        <Charts ratings={data} />
      </div>

      <div id="badges" className="scroll-mt-16">
        <BadgesSection />
      </div>

      <div id="activity" className="scroll-mt-16">
        <RecentChanges />
      </div>

      <div id="categories" className="grid scroll-mt-16 gap-6 md:grid-cols-2">
        {categories.map((c) => (
          <section key={c.id} className="rounded-xl border border-court-700 bg-court-900/70 p-5">
            <Link
              to={`/ratings/node/${c.id}`}
              className="block rounded-lg outline-none hover:opacity-90 focus-visible:ring-2 focus-visible:ring-neon"
            >
              <StatBar
                label={c.name}
                value={c.value ?? 0}
                trend={c.trend}
                projection={c.projection}
                goal={c.goal}
              />
            </Link>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <GoalEditor node={c} />
              <Link
                to={`/ratings/node/${c.id}`}
                className="text-xs uppercase tracking-wider text-court-300 hover:text-neon"
              >
                Details →
              </Link>
            </div>
            <div className="mt-4 space-y-3 border-t border-court-800 pt-4">
              <Children ratings={data} parent={c} />
            </div>
          </section>
        ))}
      </div>

      <div id="seasons" className="scroll-mt-16">
        <PastSeasons />
      </div>

      <div id="decay" className="scroll-mt-16">
        <DecayCard />
      </div>
      <DebugJson label="ratings" data={ratings.data} />
    </div>
  );
}

function Children({ ratings, parent }: { ratings: RatingsDto; parent: RatedNodeDto }) {
  const children = ratings.nodes.filter((n) => n.parentId === parent.id);
  if (!children.length) return <Detail node={parent} />;
  return (
    <>
      {children.map((child) => {
        const grandchildren = ratings.nodes.some((n) => n.parentId === child.id);
        return grandchildren ? (
          <div key={child.id} className="space-y-3 border-l border-court-700 pl-3">
            <Link to={`/ratings/node/${child.id}`} className="block hover:opacity-90">
              <StatBar label={child.name} value={child.value ?? 0} trend={child.trend} />
            </Link>
            <Children ratings={ratings} parent={child} />
          </div>
        ) : (
          <AttributeRow key={child.id} node={child} />
        );
      })}
    </>
  );
}

function AttributeRow({ node }: { node: RatedNodeDto }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="block w-full rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-neon"
      >
        <StatBar label={node.name} value={node.value ?? 0} trend={node.trend} goal={node.goal} />
      </button>
      {open && <Detail node={node} />}
    </div>
  );
}

function Detail({ node }: { node: RatedNodeDto }) {
  return (
    <div className="mt-2 space-y-2 rounded-lg bg-court-950/60 p-3 text-sm">
      {node.rationale && <p className="text-court-100">{node.rationale}</p>}
      <Link to={`/ratings/node/${node.id}`} className="inline-block text-neon hover:underline">
        History, changes and linked habits →
      </Link>
      <GoalEditor node={node} />
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs uppercase tracking-wider text-court-500">
        {node.confidence && <span>{CONFIDENCE_LABEL[node.confidence]}</span>}
        {node.decay && (
          <span>
            Fades {node.decay.perDay}/day after {node.decay.graceDays} idle day
            {node.decay.graceDays === 1 ? "" : "s"} · floor {node.decay.floor}
          </span>
        )}
      </div>
    </div>
  );
}

/** The latest few changes; the full feed is its own page. */
function RecentChanges() {
  const changes = useChangeFeed({
    sources: ["daily_recap", "weekly_review", "decay", "recalibration"],
    pageSize: 3,
  });
  const items = changes.data?.pages[0] ?? [];
  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-display text-2xl uppercase tracking-wider">Recent activity</h2>
        <Link to="/ratings/activity" className="text-sm text-court-300 hover:text-neon">
          All activity →
        </Link>
      </div>
      {items.length ? (
        <ChangeList items={items} showDates />
      ) : (
        <p className="text-sm text-court-500">No changes since scouting yet.</p>
      )}
    </section>
  );
}

/** The player card plus a PNG export of it (DESIGN.md §7.1). */
function ExportableCard({
  ratings,
  name,
  username,
}: {
  ratings: RatingsDto;
  name: string;
  username?: string;
}) {
  const card = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const download = async () => {
    if (!card.current) return;
    setExporting(true);
    setError(null);
    try {
      const url = await toPng(card.current, {
        pixelRatio: 2,
        backgroundColor: getComputedStyle(document.documentElement).getPropertyValue(
          "--color-court-950",
        ),
        cacheBust: true,
      });
      const link = document.createElement("a");
      link.href = url;
      link.download = `${name.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "player"}-ovr-${ratings.season.label}.png`;
      link.click();
    } catch (e) {
      setError(e instanceof Error ? e : new Error("Couldn't create the image"));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-2">
      <div ref={card} className="rounded-2xl">
        <PlayerCard ratings={ratings} name={name} />
      </div>
      <div className="flex items-center justify-end gap-3">
        <ErrorNote error={error} />
        {username && (
          <Link to={`/u/${username}`} className="px-4 py-2 text-sm text-court-300 hover:text-neon">
            Share profile
          </Link>
        )}
        <Button variant="ghost" disabled={exporting} onClick={download}>
          {exporting ? "Rendering…" : "↓ Download card"}
        </Button>
      </div>
    </div>
  );
}

function Charts({ ratings }: { ratings: RatingsDto }) {
  const history = useHistory(90);
  const activity = useActivity(119);
  return (
    <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      <section className="space-y-3 rounded-xl border border-court-700 bg-court-900/70 p-5">
        <h2 className="font-display text-2xl uppercase tracking-wider">History</h2>
        {history.data ? (
          <HistoryChart history={history.data} nodes={ratings.nodes} />
        ) : (
          <p className="text-sm text-court-500">Loading…</p>
        )}
      </section>
      <section className="space-y-3 rounded-xl border border-court-700 bg-court-900/70 p-5">
        <h2 className="font-display text-2xl uppercase tracking-wider">Shape</h2>
        <ShapeRadar nodes={ratings.nodes} />
      </section>
      <section className="space-y-3 rounded-xl border border-court-700 bg-court-900/70 p-5 lg:col-span-2">
        <h2 className="font-display text-2xl uppercase tracking-wider">Consistency</h2>
        {activity.data && <ActivityHeatmap days={activity.data} />}
      </section>
    </div>
  );
}
