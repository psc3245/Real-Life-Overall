import { Link } from "react-router";
import { useSeasonCards, useSeasonSetup } from "../../api/seasons";
import { OvrBadge } from "../../components/OvrBadge";

/** Shown while a freshly rolled season can still be reshaped. */
export function NewSeasonBanner() {
  const setup = useSeasonSetup();
  if (!setup.data?.editable) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-neon/40 bg-neon/5 p-4">
      <p className="text-sm">
        <span className="font-display uppercase tracking-wider text-neon">
          Season {setup.data.label} has begun.
        </span>{" "}
        <span className="text-court-300">
          Your ratings carried over. You can reshape your categories until {setup.data.setupEndsOn}.
        </span>
      </p>
      <Link
        to="/season-setup"
        className="rounded-lg bg-neon px-4 py-2 font-display text-sm font-semibold uppercase tracking-wider text-court-950 hover:brightness-110"
      >
        Season setup
      </Link>
    </div>
  );
}

export function PastSeasons() {
  const cards = useSeasonCards();
  if (!cards.data?.length) return null;
  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-display text-2xl uppercase tracking-wider">Past seasons</h2>
        <Link to="/history" className="text-sm text-court-300 hover:text-neon">
          All seasons →
        </Link>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.data.map((c) => {
          const categories = c.nodes.filter((n) => n.depth === 1);
          return (
            <li key={c.id}>
              <Link
                to={`/history/${c.id}`}
                className="flex gap-4 rounded-xl border border-court-700 bg-court-900/70 p-4 hover:border-neon/60"
              >
                {c.overall !== null && <OvrBadge value={c.overall} size="md" />}
                <div className="min-w-0 text-sm">
                  <p className="font-display text-lg uppercase tracking-wider">{c.label}</p>
                  {c.archetype && <p className="truncate text-court-300">{c.archetype}</p>}
                  <p className="mt-1 text-court-500">
                    {categories
                      .map((n) => `${n.name} ${n.value === null ? "–" : n.value.toFixed(0)}`)
                      .join(" · ")}
                  </p>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
