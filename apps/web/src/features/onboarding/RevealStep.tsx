import type { OnboardingStateDto } from "@rlo/shared";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { useMe } from "../../api/hooks";
import { useRateInitial, useRatings } from "../../api/ratings";
import { Button } from "../../components/Button";
import { OvrBadge } from "../../components/OvrBadge";
import { StatBar } from "../../components/StatBar";
import { ErrorNote } from "./ErrorNote";

const WORKING_LINES = [
  "Reviewing your scouting report…",
  "Checking answers against the rating scale…",
  "Weighing strengths and gaps…",
  "Writing your rationales…",
  "Naming your build…",
];

export function RevealStep({ state }: { state: OnboardingStateDto }) {
  if (state.stage === "complete") return <Reveal />;
  return <ReadyToRate />;
}

function ReadyToRate() {
  const rate = useRateInitial();
  const [line, setLine] = useState(0);

  useEffect(() => {
    if (!rate.isPending) return;
    const timer = setInterval(() => setLine((l) => (l + 1) % WORKING_LINES.length), 3500);
    return () => clearInterval(timer);
  }, [rate.isPending]);

  return (
    <div className="rounded-xl border border-court-700 bg-court-900/70 p-8 text-center">
      <p className="font-display text-3xl uppercase tracking-wider text-neon">Scouting complete</p>
      <p className="mx-auto mt-3 max-w-md text-court-300">
        The scouts have everything they need. Your starting ratings are set once and then move with
        what you log.
      </p>
      <Button
        variant="primary"
        className="mt-6 px-8 py-3 text-lg"
        disabled={rate.isPending}
        onClick={() => rate.mutate()}
      >
        {rate.isPending ? "Rating you…" : "Reveal my rating"}
      </Button>
      {rate.isPending && (
        <p aria-live="polite" className="mt-4 animate-pulse text-sm text-court-500">
          {WORKING_LINES[line]} This can take up to a minute.
        </p>
      )}
      <div className="mt-4 flex justify-center">
        <ErrorNote error={rate.error} />
      </div>
    </div>
  );
}

/** The OVR counts up, then the archetype and categories land one after another. */
function Reveal() {
  const ratings = useRatings();
  const me = useMe();
  if (ratings.isPending) return <p className="text-court-500">Loading…</p>;
  if (!ratings.data) return <ErrorNote error={ratings.error ?? new Error("No ratings found")} />;

  const { nodes, archetype, summary } = ratings.data;
  const root = nodes.find((n) => n.parentId === null);
  const categories = nodes.filter((n) => n.parentId === root?.id);

  return (
    <div className="flex flex-col items-center text-center">
      <p className="text-sm uppercase tracking-[0.3em] text-court-300">
        {me.data?.displayName ?? "Your"} rating
      </p>
      <div className="mt-6 animate-[reveal-pop_700ms_ease-out_both]">
        <OvrBadge value={root?.value ?? 0} size="xl" animate />
      </div>
      {archetype && (
        <div className="reveal-in mt-8" style={{ animationDelay: "2300ms" }}>
          <p className="font-display text-4xl font-bold uppercase tracking-wide text-neon">
            {archetype.name}
          </p>
          <p className="mx-auto mt-2 max-w-md text-court-300">{archetype.description}</p>
        </div>
      )}
      <div className="mt-10 w-full max-w-xl space-y-4 text-left">
        {categories.map((c, i) => (
          <div key={c.id} className="reveal-in" style={{ animationDelay: `${2800 + i * 250}ms` }}>
            <StatBar label={c.name} value={c.value ?? 0} />
          </div>
        ))}
      </div>
      {summary && (
        <p
          className="reveal-in mt-10 max-w-xl text-court-300"
          style={{ animationDelay: `${3000 + categories.length * 250}ms` }}
        >
          {summary}
        </p>
      )}
      <Link
        to="/ratings"
        className="reveal-in mt-8 rounded-lg bg-neon px-6 py-3 font-display text-lg font-semibold uppercase tracking-wider text-court-950 hover:brightness-110"
        style={{ animationDelay: `${3300 + categories.length * 250}ms` }}
      >
        See full ratings
      </Link>
    </div>
  );
}
