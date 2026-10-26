import { TREND_THRESHOLD } from "@rlo/shared";
import { useEffect, useState } from "react";
import { formatScore, scoreColor, useScore, type Score } from "./score";

interface StatBarProps {
  label: string;
  value: number;
  /** 7-day change; shown as a hot/cold marker past the threshold. */
  trend?: number | null;
  /** Season-end projection, drawn as a ghost bar (Potential, DESIGN.md §7.1). */
  projection?: number | null;
  /** The user's target, drawn as a tick on the track. */
  goal?: number | null;
  /** Overrides the score in effect (ratings out of 100, or growth on its own scale). */
  score?: Score;
}

/** A 2K-style attribute bar that fills on mount. */
export function StatBar({ label, value, projection, goal, trend, score: scoreProp }: StatBarProps) {
  const contextScore = useScore();
  const { mode, max } = scoreProp ?? contextScore;
  const pct = (v: number) => Math.min(100, Math.max(0, (v / max) * 100));
  const target = pct(value);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setWidth(target));
    return () => cancelAnimationFrame(frame);
  }, [target]);
  const color = scoreColor(mode, value);
  const growth = mode === "growth";

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_3.5rem] items-center gap-x-3 gap-y-1">
      <span className="flex min-w-0 items-center gap-2">
        <span className="truncate text-sm font-medium uppercase tracking-wide text-court-300">
          {label}
        </span>
        {trend != null && Math.abs(trend) >= TREND_THRESHOLD && (
          <span
            className={`shrink-0 text-xs font-semibold tabular-nums ${trend > 0 ? "text-tier-green" : "text-tier-red"}`}
            title={
              growth
                ? `Hot: ${formatScore(mode, trend)} in 7 days`
                : `${trend > 0 ? "Hot" : "Cold"}: ${trend > 0 ? "+" : ""}${trend.toFixed(1)} in 7 days`
            }
          >
            {trend > 0 ? "▲" : "▼"} {trend > 0 ? "hot" : "cold"}
          </span>
        )}
      </span>
      <span
        className="row-span-2 text-right font-display text-2xl font-semibold tabular-nums"
        style={{ color }}
      >
        {formatScore(mode, value)}
      </span>
      <div
        className="relative h-2 rounded-full bg-court-700"
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={value}
      >
        {projection != null && (
          <div
            className="absolute inset-y-0 left-0 rounded-full opacity-25"
            style={{ width: `${pct(projection)}%`, backgroundColor: color }}
            title={`Projected ${formatScore(mode, projection)} at season end`}
          />
        )}
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-1000 ease-out"
          style={{ width: `${width}%`, backgroundColor: color, boxShadow: `0 0 12px ${color}` }}
        />
        {goal != null && (
          <div
            className="absolute inset-y-[-3px] w-0.5 rounded-full bg-court-100"
            style={{ left: `calc(${pct(goal)}% - 1px)` }}
            title={`Goal ${formatScore(mode, goal)}`}
          />
        )}
      </div>
    </div>
  );
}
