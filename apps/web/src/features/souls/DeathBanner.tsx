import { DEATH_CAUSE_LABELS, formatSouls } from "@rlo/shared";
import { useState } from "react";
import { Link } from "react-router";
import { useSouls } from "../../api/souls";
import { useTalk } from "../../lib/talk";

const SEEN_KEY = "rlo.deathSeen";

function seen(): string | null {
  try {
    return localStorage.getItem(SEEN_KEY);
  } catch {
    return null;
  }
}

/**
 * The death moment in a Souls season (DESIGN.md §4.7): once per death, across the top of every
 * page, until it's dismissed.
 */
export function DeathBanner({ enabled }: { enabled: boolean }) {
  const talk = useTalk();
  const souls = useSouls(enabled);
  const [dismissed, setDismissed] = useState(seen);
  const death = souls.data?.days.find((d) => d.deaths.length > 0 && !d.open);
  if (!death || dismissed === death.date) return null;
  const dismiss = () => {
    try {
      localStorage.setItem(SEEN_KEY, death.date);
    } catch {
      // Storage blocked: it hides for this visit only.
    }
    setDismissed(death.date);
  };
  // Only the latest death, and only while it's recent enough to matter.
  if (souls.data!.days.findIndex((d) => d === death) > 2) return null;
  return (
    <section
      role="alert"
      className="relative -mx-4 mb-6 overflow-hidden bg-gradient-to-b from-transparent via-black/85 to-transparent px-4 py-10 text-center"
    >
      <p className="death-in font-display text-5xl font-semibold uppercase text-flare sm:text-6xl">
        {talk.souls.died}
      </p>
      <p className="mt-4 text-court-300">
        {death.deaths.map((c) => DEATH_CAUSE_LABELS[c]).join(", ")}.
        {death.dropped > 0 &&
          ` ${formatSouls(death.dropped)} ${talk.souls.souls} lie in your ${talk.souls.bloodstain.toLowerCase()}. ${talk.endDay} cleanly to reclaim them.`}
      </p>
      <div className="mt-4 flex justify-center gap-6 text-sm">
        <Link to="/bonfire" className="text-neon hover:underline">
          {talk.souls.bonfire} →
        </Link>
        <button type="button" onClick={dismiss} className="text-court-500 hover:text-court-100">
          Dismiss
        </button>
      </div>
    </section>
  );
}
