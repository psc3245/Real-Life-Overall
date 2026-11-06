import { SEASON_MODE_INFO, SEASON_MODES, type SeasonMode } from "@rlo/shared";
import { useAccount } from "../../api/account";
import { PremiumBadge } from "../../components/Premium";
import { useTalk } from "../../lib/talk";

/**
 * Rating, growth or souls, picked at the start of each season (DESIGN.md §4.6, §4.7). Souls is
 * still in testing, so only dev and admin accounts see it.
 */
export function ModePicker({
  value,
  onChange,
  disabled = false,
}: {
  value: SeasonMode;
  onChange: (mode: SeasonMode) => void;
  disabled?: boolean;
}) {
  const talk = useTalk();
  const { premium, tester } = useAccount();
  const modes = SEASON_MODES.filter((m) => m !== "souls" || tester);
  return (
    <div
      role="radiogroup"
      aria-label="How this season is scored"
      className={`grid gap-3 ${modes.length > 2 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}
    >
      {modes.map((mode) => {
        const active = value === mode;
        // Rating seasons are premium (DESIGN.md §8.9).
        const locked = mode === "rating" && !premium;
        return (
          <button
            key={mode}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled || locked}
            onClick={() => onChange(mode)}
            className={`rounded-xl border p-4 text-left transition disabled:opacity-50 ${active ? "border-neon bg-neon/10" : "border-court-700 bg-court-900/70 hover:border-court-500"}`}
          >
            <span
              className={`block font-display text-xl uppercase tracking-wider ${active ? "text-neon" : "text-court-100"}`}
            >
              {mode === "growth"
                ? talk.growthMode
                : mode === "souls"
                  ? talk.souls.mode
                  : talk.ratingMode}
              {locked && <PremiumBadge className="ml-2" />}
              {mode === "souls" && (
                <span className="ml-2 inline-block rounded bg-court-700 px-1.5 py-0.5 align-middle text-[10px] font-semibold uppercase tracking-wider text-court-300">
                  Beta
                </span>
              )}
            </span>
            <span className="mt-1 block text-sm text-court-300">{SEASON_MODE_INFO[mode]}</span>
          </button>
        );
      })}
    </div>
  );
}
