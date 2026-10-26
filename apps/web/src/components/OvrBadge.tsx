import type { SeasonMode } from "@rlo/shared";
import { formatScore, scoreColor, useScore } from "./score";
import { useCountUp } from "./useCountUp";
import { useTalk } from "../lib/talk";

export function OvrBadge({
  value,
  size = "lg",
  animate = false,
  mode: modeProp,
}: {
  value: number;
  size?: "md" | "lg" | "xl";
  /** Count up from 0, for the reveal. */
  animate?: boolean;
  /** Defaults to the score in effect (your season, or the card being shown). */
  mode?: SeasonMode;
}) {
  const talk = useTalk();
  const score = useScore();
  const mode = modeProp ?? score.mode;
  const counted = useCountUp(value, 2200);
  const shown = animate ? counted : value;
  const color = scoreColor(mode, shown);
  const growth = mode === "growth";
  const dims = {
    md: growth ? "h-16 w-16 text-xl" : "h-16 w-16 text-3xl",
    lg: growth ? "h-28 w-28 text-4xl" : "h-28 w-28 text-6xl",
    xl: growth ? "h-44 w-44 text-6xl" : "h-44 w-44 text-8xl",
  }[size];
  return (
    <div
      className={`${dims} flex flex-col items-center justify-center rounded-2xl border-2 bg-court-900 font-display font-bold leading-none`}
      style={{ borderColor: color, color, boxShadow: `0 0 24px -6px ${color}` }}
    >
      <span className="tabular-nums">
        {growth ? formatScore(mode, shown, shown >= 10 ? 0 : 1) : Math.round(shown)}
      </span>
      <span className="mt-1 text-xs font-semibold tracking-[0.3em] text-court-300">
        {growth ? talk.growthLabel : talk.ovr}
      </span>
    </div>
  );
}
