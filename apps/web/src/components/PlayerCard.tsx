import type { RatingsDto } from "@rlo/shared";
import { OvrBadge } from "./OvrBadge";
import { StatBar } from "./StatBar";

/** OVR, archetype and category bars. Used on the home page, the reveal and the ratings page. */
export function PlayerCard({ ratings, name }: { ratings: RatingsDto; name: string }) {
  const root = ratings.nodes.find((n) => n.parentId === null);
  const categories = ratings.nodes.filter((n) => n.parentId === root?.id);

  return (
    <section
      aria-label="Player card"
      className="rounded-2xl border border-court-700 bg-court-900/80 p-6 shadow-2xl backdrop-blur"
    >
      <div className="flex items-center gap-5">
        <OvrBadge value={root?.value ?? 0} />
        <div className="min-w-0">
          <p className="truncate font-display text-2xl font-semibold uppercase">{name}</p>
          <p className="text-sm uppercase tracking-widest text-court-300">
            {ratings.archetype?.name ?? "Unranked"} · {ratings.season.label}
          </p>
        </div>
      </div>
      <div className="mt-6 space-y-4">
        {categories.map((c) => (
          <StatBar key={c.id} label={c.name} value={c.value ?? 0} trend={c.trend} />
        ))}
      </div>
    </section>
  );
}
