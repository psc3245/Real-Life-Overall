import { LEADERBOARD_MIN_RECAPPED_DAYS, type PublicCardDto, type RatingsDto } from "@rlo/shared";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { OvrBadge } from "./OvrBadge";
import { StatBar } from "./StatBar";
import { useTalk } from "../lib/talk";

interface CardCategory {
  key: string;
  /** Makes the bar a link (your own card's categories open their pages). */
  href?: string;
  name: string;
  value: number;
  trend?: number | null;
  projection?: number | null;
  goal?: number | null;
}

/** The card layout shared by your own card and other players' public cards. */
export function CardView({
  name,
  overall,
  subtitle,
  note,
  categories,
}: {
  name: string;
  overall: number;
  subtitle: string;
  note?: ReactNode;
  categories: CardCategory[];
}) {
  const talk = useTalk();
  return (
    <section
      aria-label={talk.playerCard}
      className="rounded-2xl border border-court-700 bg-court-900/80 p-6 shadow-2xl backdrop-blur"
    >
      <div className="flex items-center gap-5">
        <OvrBadge value={overall} />
        <div className="min-w-0">
          <p className="truncate font-display text-2xl font-semibold uppercase">{name}</p>
          <p className="text-sm uppercase tracking-widest text-court-300">{subtitle}</p>
          {note && <p className="mt-1 text-xs uppercase tracking-wider text-court-500">{note}</p>}
        </div>
      </div>
      <div className="mt-6 space-y-4">
        {categories.map(({ key, href, name: label, ...bar }) =>
          href ? (
            <Link key={key} to={href} className="block rounded-lg hover:opacity-90">
              <StatBar label={label} {...bar} />
            </Link>
          ) : (
            <StatBar key={key} label={label} {...bar} />
          ),
        )}
      </div>
    </section>
  );
}

/** OVR, archetype and category bars. Used on the home page, the reveal and the ratings page. */
export function PlayerCard({ ratings, name }: { ratings: RatingsDto; name: string }) {
  const talk = useTalk();
  const root = ratings.nodes.find((n) => n.parentId === null);
  const categories = ratings.nodes.filter((n) => n.parentId === root?.id);

  return (
    <CardView
      name={name}
      overall={root?.value ?? 0}
      subtitle={`${ratings.archetype?.name ?? talk.unranked} · ${ratings.season.label}`}
      note={
        root?.projection != null && (
          <>
            Projected {Math.round(root.projection)} by season end
            {root.goal != null && ` · goal ${Math.round(root.goal)}`}
          </>
        )
      }
      categories={categories.map((c) => ({
        key: c.id,
        href: `/ratings/node/${c.id}`,
        name: c.name,
        value: c.value ?? 0,
        trend: c.trend,
        projection: c.projection,
        goal: c.goal,
      }))}
    />
  );
}

/** Another player's shared card: Overall, archetype and categories only. */
export function PublicCard({ card, name }: { card: PublicCardDto; name: string }) {
  const talk = useTalk();
  return (
    <CardView
      name={name}
      overall={card.overall}
      subtitle={`${card.archetype ?? talk.unranked} · ${card.seasonLabel}`}
      note={`${card.recappedDays} recapped day${card.recappedDays === 1 ? "" : "s"} this season${card.recappedDays < LEADERBOARD_MIN_RECAPPED_DAYS ? " · provisional" : ""}`}
      categories={card.categories.map((c) => ({ key: c.name, name: c.name, value: c.value }))}
    />
  );
}
