import { computeNodeValues, type RatingNodeLike } from "@rlo/shared";
import { Link } from "react-router";
import { useMe } from "../api/hooks";
import { OvrBadge } from "../components/OvrBadge";
import { StatBar } from "../components/StatBar";

/** Sample player for the landing preview; real trees come from onboarding. */
const sampleNodes: (RatingNodeLike & { name: string })[] = [
  { id: "ovr", parentId: null, depth: 0, weight: 1, name: "Overall" },
  { id: "fit", parentId: "ovr", depth: 1, weight: 2, name: "Fitness" },
  { id: "car", parentId: "ovr", depth: 1, weight: 3, name: "Career" },
  { id: "soc", parentId: "ovr", depth: 1, weight: 1, name: "Social" },
  { id: "cardio", parentId: "fit", depth: 2, weight: 1, name: "Cardio" },
  { id: "strength", parentId: "fit", depth: 2, weight: 1, name: "Strength" },
  { id: "skills", parentId: "car", depth: 2, weight: 2, name: "Skills" },
  { id: "output", parentId: "car", depth: 2, weight: 1, name: "Output" },
  { id: "friends", parentId: "soc", depth: 2, weight: 1, name: "Friendships" },
];
const sampleLeaves = new Map([
  ["cardio", 72.4],
  ["strength", 64.1],
  ["skills", 86.3],
  ["output", 79.0],
  ["friends", 58.6],
]);

export function HomePage() {
  const me = useMe();
  const values = computeNodeValues(sampleNodes, sampleLeaves);
  const categories = sampleNodes.filter((n) => n.depth === 1);

  return (
    <div className="grid gap-10 pt-6 md:grid-cols-[1.1fr_1fr] md:items-center">
      <section>
        <p className="text-sm uppercase tracking-[0.3em] text-neon">
          {me.data ? `Welcome, ${me.data.displayName}` : "Your life, rated"}
        </p>
        <h1 className="mt-3 font-display text-5xl font-bold uppercase leading-[1.05] md:text-6xl">
          What's your <span className="text-neon">overall</span>?
        </h1>
        <p className="mt-5 max-w-md text-court-300">
          Build a 2K-style rating for your real life. Pick the categories that matter, answer a
          scouting questionnaire, and get your starting ratings. Then watch them move as you log
          your days.
        </p>
        <Link
          to="/onboarding"
          className="mt-8 inline-block rounded-lg bg-neon px-6 py-3 font-display text-lg font-semibold uppercase tracking-wider text-court-950 hover:brightness-110"
        >
          Build my rating
        </Link>
      </section>

      <section
        aria-label="Sample player card"
        className="rounded-2xl border border-court-700 bg-court-900/80 p-6 shadow-2xl backdrop-blur"
      >
        <div className="flex items-center gap-5">
          <OvrBadge value={values.get("ovr") ?? 0} />
          <div>
            <p className="font-display text-2xl font-semibold uppercase">Sample Player</p>
            <p className="text-sm uppercase tracking-widest text-court-300">
              Two-Way Builder · 2026-Q4
            </p>
          </div>
        </div>
        <div className="mt-6 space-y-4">
          {categories.map((c) => (
            <StatBar key={c.id} label={c.name} value={values.get(c.id) ?? 0} />
          ))}
        </div>
      </section>
    </div>
  );
}
