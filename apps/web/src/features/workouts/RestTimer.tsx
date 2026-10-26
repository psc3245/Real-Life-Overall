import { formatDuration } from "@rlo/shared";
import { useEffect, useState } from "react";

const STORAGE_KEY = "rlo.restSeconds";
const DEFAULT_REST = 120;

function storedRest(): number {
  try {
    const n = Number(localStorage.getItem(STORAGE_KEY));
    return Number.isFinite(n) && n >= 15 ? n : DEFAULT_REST;
  } catch {
    return DEFAULT_REST;
  }
}

function storeRest(seconds: number) {
  try {
    localStorage.setItem(STORAGE_KEY, String(seconds));
  } catch {
    // Storage unavailable; the timer still works for this session.
  }
}

/** A rest countdown started by checking off a set. Its length is remembered per browser. */
export function useRestTimer() {
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [length, setLength] = useState(storedRest);
  return {
    endsAt,
    length,
    start: () => setEndsAt(Date.now() + length * 1000),
    stop: () => setEndsAt(null),
    adjust: (delta: number) => {
      const next = Math.max(15, length + delta);
      setLength(next);
      storeRest(next);
      setEndsAt((at) => (at ? at + delta * 1000 : at));
    },
  };
}

export function RestTimerBar({ timer }: { timer: ReturnType<typeof useRestTimer> }) {
  const [now, setNow] = useState(() => Date.now());
  const { endsAt, stop } = timer;
  useEffect(() => {
    if (!endsAt) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [endsAt]);
  useEffect(() => {
    if (endsAt && now >= endsAt) stop();
  }, [endsAt, now, stop]);
  if (!endsAt) return null;

  const left = Math.max(0, Math.ceil((endsAt - now) / 1000));
  const pct = Math.min(100, (100 * left) / timer.length);
  const step =
    "h-9 rounded-lg border border-court-700 px-3 text-sm text-court-100 hover:border-neon";
  return (
    <div
      role="timer"
      aria-label="Rest timer"
      className="fixed inset-x-0 bottom-4 z-20 mx-auto w-[min(28rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-neon/50 bg-court-900/95 shadow-2xl backdrop-blur"
    >
      <div className="h-1 bg-court-700">
        <div
          className="h-full bg-neon transition-[width] duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <div>
          <p className="text-xs uppercase tracking-wider text-court-500">Rest</p>
          <p className="font-display text-3xl tabular-nums text-neon">{formatDuration(left)}</p>
        </div>
        <div className="flex gap-1.5">
          <button type="button" className={step} onClick={() => timer.adjust(-15)}>
            −15s
          </button>
          <button type="button" className={step} onClick={() => timer.adjust(15)}>
            +15s
          </button>
          <button
            type="button"
            className="h-9 rounded-lg bg-neon px-3 text-sm font-semibold text-court-950"
            onClick={stop}
          >
            Skip
          </button>
        </div>
      </div>
    </div>
  );
}
