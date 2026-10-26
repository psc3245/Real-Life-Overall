import type { SeasonMode } from "@rlo/shared";
import { formatScore, useScore } from "./score";
import { useTalk } from "../lib/talk";

/** A signed rating change: green up, red down. */
export function Delta({ value, className = "" }: { value: number; className?: string }) {
  const up = value > 0;
  return (
    <span
      className={`font-display tabular-nums ${up ? "text-tier-green" : "text-tier-red"} ${className}`}
    >
      {up ? "+" : "−"}
      {Math.abs(value).toFixed(Math.abs(value) < 0.1 ? 2 : 1)}
    </span>
  );
}

/**
 * One rating change as the season scores it: the change itself, or in a growth season the
 * part that counts (decay and setbacks show as "±0", DESIGN.md §4.6).
 */
export function ChangeDelta({
  delta,
  growth,
  className = "",
}: {
  delta: number;
  growth: number;
  className?: string;
}) {
  const { mode } = useScore();
  if (mode !== "growth") return <Delta value={delta} className={className} />;
  if (Math.abs(growth) < 0.005) {
    return (
      <span
        className={`font-display tabular-nums text-court-500 ${className}`}
        title="Doesn't count toward growth"
      >
        ±0
      </span>
    );
  }
  return <Delta value={growth} className={className} />;
}

/** "OVR 70.1 → 71.2 +1.1", or in a growth season "Growth +3.2 → +4.0 +0.8". */
export function OverallMove({
  mode,
  before,
  after,
  className = "",
}: {
  mode: SeasonMode;
  before: number;
  after: number;
  className?: string;
}) {
  const talk = useTalk();
  return (
    <p className={`font-display text-lg tabular-nums text-court-300 ${className}`}>
      {mode === "growth" ? talk.growthLabel : talk.ovr} {formatScore(mode, before)} →{" "}
      <span className="text-court-100">{formatScore(mode, after)}</span>{" "}
      {Math.abs(after - before) >= 0.05 && <Delta value={after - before} className="text-base" />}
    </p>
  );
}
