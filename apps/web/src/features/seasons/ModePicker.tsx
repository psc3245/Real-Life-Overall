import { SEASON_MODE_INFO, SEASON_MODES, type SeasonMode } from "@rlo/shared";
import { useTalk } from "../../lib/talk";

/** Rating or growth, picked at the start of each season (DESIGN.md §4.6). */
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
  return (
    <div
      role="radiogroup"
      aria-label="How this season is scored"
      className="grid gap-3 sm:grid-cols-2"
    >
      {SEASON_MODES.map((mode) => {
        const active = value === mode;
        return (
          <button
            key={mode}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => onChange(mode)}
            className={`rounded-xl border p-4 text-left transition disabled:opacity-50 ${active ? "border-neon bg-neon/10" : "border-court-700 bg-court-900/70 hover:border-court-500"}`}
          >
            <span
              className={`block font-display text-xl uppercase tracking-wider ${active ? "text-neon" : "text-court-100"}`}
            >
              {mode === "growth" ? talk.growthMode : talk.ratingMode}
            </span>
            <span className="mt-1 block text-sm text-court-300">{SEASON_MODE_INFO[mode]}</span>
          </button>
        );
      })}
    </div>
  );
}
