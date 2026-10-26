import type { OnboardingStateDto } from "@rlo/shared";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { useMe } from "../../api/hooks";
import { useSetOnboardingMode } from "../../api/onboarding";
import { useRateInitial, useRatings } from "../../api/ratings";
import { Button } from "../../components/Button";
import { OvrBadge } from "../../components/OvrBadge";
import { StatBar } from "../../components/StatBar";
import { ErrorNote } from "./ErrorNote";
import { ModePicker } from "../seasons/ModePicker";
import { useShowRatings } from "../../components/score";
import { useTalk } from "../../lib/talk";

const WORKING_LINES = [
  "Reviewing your answers…",
  "Checking answers against the rating scale…",
  "Weighing strengths and gaps…",
  "Writing your rationales…",
  "Naming your build…",
];

export function RevealStep({ state }: { state: OnboardingStateDto }) {
  if (state.stage === "complete") return <Reveal />;
  return <ReadyToRate state={state} />;
}

function ReadyToRate({ state }: { state: OnboardingStateDto }) {
  const talk = useTalk();
  const rate = useRateInitial();
  const setMode = useSetOnboardingMode();
  const [line, setLine] = useState(0);

  useEffect(() => {
    if (!rate.isPending) return;
    const timer = setInterval(() => setLine((l) => (l + 1) % WORKING_LINES.length), 3500);
    return () => clearInterval(timer);
  }, [rate.isPending]);

  return (
    <div className="rounded-xl border border-court-700 bg-court-900/70 p-8 text-center">
      <p className="font-display text-3xl uppercase tracking-wider text-neon">
        {talk.scouting} complete
      </p>
      <p className="mx-auto mt-3 max-w-md text-court-300">
        That's everything needed. Your starting ratings are set once and then move with what you
        log.
      </p>
      <div className="mx-auto mt-6 max-w-2xl space-y-2 text-left">
        <p className="text-center text-sm uppercase tracking-wider text-court-300">
          How should your season be scored?
        </p>
        <ModePicker
          value={state.season.mode}
          disabled={setMode.isPending || rate.isPending}
          onChange={(mode) => setMode.mutate(mode)}
        />
        <p className="text-center text-xs text-court-500">
          You pick again at the start of every season.
        </p>
        <ErrorNote error={setMode.error} />
      </div>
      <Button
        variant="primary"
        className="mt-6 px-8 py-3 text-lg"
        disabled={rate.isPending || setMode.isPending}
        onClick={() => rate.mutate()}
      >
        {rate.isPending ? "Rating you…" : talk.revealButton}
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

/**
 * The OVR counts up, then the archetype and categories land one after another. A growth season
 * starts everyone at +0, so the scouting ratings stay behind a toggle (DESIGN.md §4.6).
 */
function Reveal() {
  const talk = useTalk();
  const ratings = useRatings();
  const me = useMe();
  const [showRatings, setShowRatings] = useShowRatings();
  if (ratings.isPending) return <p className="text-court-500">Loading…</p>;
  if (!ratings.data) return <ErrorNote error={ratings.error ?? new Error("No ratings found")} />;

  const { nodes, archetype, summary } = ratings.data;
  const root = nodes.find((n) => n.parentId === null);
  const categories = nodes.filter((n) => n.parentId === root?.id);
  const growth = ratings.data.season.mode === "growth";
  // Ratings show unless it's a growth season and the player hasn't asked to see them.
  const asRatings = !growth || showRatings;
  const rated = { mode: "rating" as const, max: 100 };

  return (
    <div className="flex flex-col items-center text-center">
      <p className="text-sm uppercase tracking-[0.3em] text-court-300">
        {me.data?.displayName ?? "Your"}{" "}
        {growth && !asRatings ? `${talk.growthMode} season` : "rating"}
      </p>
      <div className="mt-6 animate-[reveal-pop_700ms_ease-out_both]">
        <OvrBadge
          value={(asRatings ? root?.rating : root?.value) ?? 0}
          size="xl"
          animate
          mode={asRatings ? "rating" : "growth"}
        />
      </div>
      {growth && (
        <div
          className="reveal-in mt-4 max-w-md text-sm text-court-300"
          style={{ animationDelay: "2200ms" }}
        >
          <p>
            You're playing {talk.growthMode}: everyone starts at +0 and every point you gain this
            season counts. Your scouting ratings keep running underneath, visible only to you.
          </p>
          <button
            type="button"
            onClick={() => setShowRatings(!showRatings)}
            className="mt-1 text-xs uppercase tracking-wider text-court-500 hover:text-neon"
          >
            {showRatings ? "Hide my ratings" : "Peek at my ratings"}
          </button>
        </div>
      )}
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
            {asRatings ? (
              <StatBar label={c.name} value={c.rating ?? 0} score={rated} />
            ) : (
              <StatBar label={c.name} value={c.value ?? 0} />
            )}
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
