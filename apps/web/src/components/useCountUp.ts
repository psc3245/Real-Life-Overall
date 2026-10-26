import { useEffect, useState } from "react";
import { reducedMotion as prefersReducedMotion } from "../lib/appearance";

/** Animates from 0 to `target` with an ease-out curve; jumps straight there for reduced motion. */
export function useCountUp(target: number, durationMs = 1600, delayMs = 0): number {
  const [value, setValue] = useState(() => (prefersReducedMotion() ? target : 0));

  useEffect(() => {
    if (prefersReducedMotion()) {
      setValue(target);
      return;
    }
    let frame = 0;
    let start: number | null = null;
    const tick = (now: number) => {
      start ??= now + delayMs;
      const t = Math.min(1, Math.max(0, (now - start) / durationMs));
      setValue(target * (1 - (1 - t) ** 3));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, durationMs, delayMs]);

  return value;
}
