import { ratingTier } from "@rlo/shared";
import { tierColor } from "./tier";
import { useCountUp } from "./useCountUp";

export function OvrBadge({
  value,
  size = "lg",
  animate = false,
}: {
  value: number;
  size?: "md" | "lg" | "xl";
  /** Count up from 0, for the reveal. */
  animate?: boolean;
}) {
  const counted = useCountUp(value, 2200);
  const shown = animate ? counted : value;
  const color = tierColor(ratingTier(shown));
  const dims = {
    md: "h-16 w-16 text-3xl",
    lg: "h-28 w-28 text-6xl",
    xl: "h-44 w-44 text-8xl",
  }[size];
  return (
    <div
      className={`${dims} flex flex-col items-center justify-center rounded-2xl border-2 bg-court-900 font-display font-bold leading-none`}
      style={{ borderColor: color, color, boxShadow: `0 0 24px -6px ${color}` }}
    >
      <span className="tabular-nums">{Math.round(shown)}</span>
      <span className="mt-1 text-xs font-semibold tracking-[0.3em] text-court-300">OVR</span>
    </div>
  );
}
