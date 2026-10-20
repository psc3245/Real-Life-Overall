import { ratingTier } from "@rlo/shared";
import { useEffect, useState } from "react";
import { tierColor } from "./tier";

interface StatBarProps {
  label: string;
  value: number;
  /** Ghost marker for a goal or projected rating (Potential, DESIGN.md §7.1). */
  potential?: number;
}

/** A 2K-style attribute bar that fills on mount. */
export function StatBar({ label, value, potential }: StatBarProps) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setWidth(value));
    return () => cancelAnimationFrame(frame);
  }, [value]);
  const color = tierColor(ratingTier(value));

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_3.5rem] items-center gap-x-3 gap-y-1">
      <span className="truncate text-sm font-medium uppercase tracking-wide text-court-300">
        {label}
      </span>
      <span
        className="row-span-2 text-right font-display text-2xl font-semibold tabular-nums"
        style={{ color }}
      >
        {value.toFixed(1)}
      </span>
      <div
        className="relative h-2 overflow-hidden rounded-full bg-court-700"
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
      >
        {potential !== undefined && (
          <div
            className="absolute inset-y-0 left-0 rounded-full opacity-25"
            style={{ width: `${potential}%`, backgroundColor: color }}
          />
        )}
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-1000 ease-out"
          style={{ width: `${width}%`, backgroundColor: color, boxShadow: `0 0 12px ${color}` }}
        />
      </div>
    </div>
  );
}
