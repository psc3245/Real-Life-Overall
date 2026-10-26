import { useTalk } from "../../lib/talk";
export const ONBOARDING_STEPS = [
  { key: "discover", label: "Discover" },
  { key: "tree", label: "Build" },
  { key: "weights", label: "Weights" },
  { key: "questionnaire", label: "Scouting" },
  { key: "reveal", label: "Reveal" },
] as const;
export type StepKey = (typeof ONBOARDING_STEPS)[number]["key"];

export function StepIndicator({
  current,
  reachable,
  onSelect,
}: {
  current: StepKey;
  /** Steps the user may jump back to. */
  reachable: StepKey[];
  onSelect: (step: StepKey) => void;
}) {
  const talk = useTalk();
  return (
    <ol className="flex flex-wrap gap-2" aria-label="Onboarding steps">
      {ONBOARDING_STEPS.map((step, i) => {
        const active = step.key === current;
        const canGo = reachable.includes(step.key) && !active;
        return (
          <li key={step.key}>
            <button
              type="button"
              disabled={!canGo}
              onClick={() => onSelect(step.key)}
              aria-current={active ? "step" : undefined}
              className={`flex items-center gap-2 rounded-full border px-3 py-1 font-display text-sm uppercase tracking-wider ${
                active
                  ? "border-neon bg-neon/10 text-neon"
                  : canGo
                    ? "border-court-500 text-court-100 hover:border-neon"
                    : "border-court-700 text-court-500"
              }`}
            >
              <span className="tabular-nums">{i + 1}</span>
              {step.key === "questionnaire"
                ? talk.scouting
                : step.key === "reveal"
                  ? talk.reveal
                  : step.label}
            </button>
          </li>
        );
      })}
    </ol>
  );
}
