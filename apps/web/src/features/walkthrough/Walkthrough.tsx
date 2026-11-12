import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useState,
  useSyncExternalStore,
  type CSSProperties,
} from "react";
import { useLocation, useNavigate } from "react-router";
import { useMe } from "../../api/hooks";
import { usePreferences, useSetPreferences } from "../../api/preferences";
import { useRatings } from "../../api/ratings";
import { Button } from "../../components/Button";
import { useTalk } from "../../lib/talk";
import { walkthroughSteps } from "./steps";

// Whether the tour is running, outside React so the account menu can start it from anywhere.
let running = false;
const listeners = new Set<() => void>();
const setRunning = (next: boolean) => {
  running = next;
  listeners.forEach((l) => l());
};

/** Starts the walkthrough from the first stop (the account menu's replay). */
export const startWalkthrough = () => setRunning(true);

/** Pages the tour never interrupts: building a rating comes first. */
const QUIET = ["/onboarding", "/season-setup", "/signin", "/signup"];

/**
 * The walkthrough (DESIGN.md §7.12): a spotlight tour of the main features, mounted once in the
 * root layout. It starts by itself the first time a rated player opens the app, and finishing or
 * skipping it sets `walkthroughDone` so it doesn't come back (on any device).
 */
export function Walkthrough() {
  // The saved flag, not the cached copy: a new browser's defaults would replay the tour.
  const me = useMe();
  const ratings = useRatings();
  const { pathname } = useLocation();
  const active = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => running,
  );

  const due =
    me.data?.preferences.walkthroughDone === false &&
    Boolean(ratings.data) &&
    !QUIET.some((p) => pathname.startsWith(p));
  useEffect(() => {
    if (due) setRunning(true);
  }, [due]);

  return active ? <Tour /> : null;
}

function Tour() {
  const talk = useTalk();
  const { features } = usePreferences();
  const setPreferences = useSetPreferences();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  // Fixed when the tour starts, so switching a feature mid-tour doesn't reshuffle the stops.
  const [steps] = useState(() => walkthroughSteps(talk, features));
  const [index, setIndex] = useState(0);
  const step = steps[index]!;
  const last = index === steps.length - 1;

  const finish = useCallback(() => {
    setRunning(false);
    setPreferences({ walkthroughDone: true });
  }, [setPreferences]);
  const go = useCallback(
    (delta: number) => setIndex((i) => Math.min(steps.length - 1, Math.max(0, i + delta))),
    [steps.length],
  );

  useEffect(() => {
    if (step.to && pathname !== step.to) navigate(step.to);
  }, [step, pathname, navigate]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish();
      else if (e.key === "ArrowRight") {
        if (last) finish();
        else go(1);
      } else if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [finish, go, last]);

  const rect = useTargetRect(step.target, pathname);

  return (
    <div
      className="fixed inset-0 z-50"
      role="dialog"
      aria-modal="true"
      aria-label={talk.walkthrough}
    >
      {rect ? (
        <div
          aria-hidden
          className="pointer-events-none absolute rounded-xl border-2 border-neon shadow-[0_0_0_9999px_rgb(0_0_0/0.65)] transition-all duration-300"
          style={{
            top: rect.top - PAD,
            left: rect.left - PAD,
            width: rect.width + PAD * 2,
            height: rect.height + PAD * 2,
          }}
        />
      ) : (
        <div aria-hidden className="absolute inset-0 bg-black/65" />
      )}
      <section
        aria-live="polite"
        className="absolute w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-court-700 bg-court-900 p-5 text-court-100 shadow-2xl"
        style={cardPosition(rect)}
      >
        <p className="text-xs uppercase tracking-[0.3em] text-neon">
          {talk.walkthrough} · {index + 1} of {steps.length}
        </p>
        <h2 className="mt-1 font-display text-2xl font-bold uppercase">{step.title}</h2>
        <p className="mt-2 text-sm text-court-300">{step.body}</p>
        <div className="mt-4 flex gap-1" aria-hidden>
          {steps.map((s, i) => (
            <span
              key={s.id}
              className={`h-1 flex-1 rounded-full ${i <= index ? "bg-neon" : "bg-court-700"}`}
            />
          ))}
        </div>
        <div className="mt-4 flex items-center justify-between gap-2">
          <Button variant="ghost" className="px-0" onClick={finish}>
            {last ? "Close" : "Skip"}
          </Button>
          <div className="flex gap-2">
            {index > 0 && <Button onClick={() => go(-1)}>Back</Button>}
            <Button variant="primary" autoFocus onClick={() => (last ? finish() : go(1))}>
              {index === 0 ? "Let's go" : last ? "Done" : "Next"}
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}

const PAD = 6;
const CARD_WIDTH = 352;
const GAP = 14;
/** Roughly the card's height, to decide whether it fits beside the target. */
const CARD_HEIGHT = 260;

/**
 * Below the target when it fits, else above it, else pinned to the bottom of the screen (a tall
 * target); centered when there's nothing to point at.
 */
function cardPosition(rect: DOMRect | null): CSSProperties {
  if (!rect) return { top: "50%", left: "50%", transform: "translate(-50%, -50%)" };
  const left = Math.max(16, Math.min(rect.left, window.innerWidth - CARD_WIDTH - 16));
  const below = rect.bottom + PAD + GAP;
  const above = rect.top - PAD - GAP;
  if (window.innerHeight - below >= CARD_HEIGHT) return { top: below, left };
  if (above >= CARD_HEIGHT) return { bottom: window.innerHeight - above, left };
  return { bottom: 16, left };
}

/**
 * Where the `data-tour` target is on screen, following scrolls and resizes. Pages load their data
 * after navigating, so it keeps looking for a moment; null when there's no target, it never shows
 * (its feature or widget is hidden) or it's off screen, and the card centers instead.
 */
function useTargetRect(target: string | undefined, pathname: string): DOMRect | null {
  const [rect, setRect] = useState<DOMRect | null>(null);
  useLayoutEffect(() => {
    setRect(null);
    if (!target) return;
    let el: HTMLElement | null = null;
    // A page can scroll the target away after it loads (the coach jumps to its newest message);
    // the card centers then rather than following it off screen.
    const measure = () => {
      if (!el?.isConnected) return;
      const r = el.getBoundingClientRect();
      setRect(r.bottom > 0 && r.top < window.innerHeight ? r : null);
    };
    const find = () => {
      el = document.querySelector<HTMLElement>(`[data-tour="${target}"]`);
      if (!el) return false;
      el.scrollIntoView({ block: "center", inline: "center", behavior: "instant" });
      measure();
      return true;
    };
    let tries = 0;
    const poll = find()
      ? undefined
      : setInterval(() => {
          if (find() || ++tries > 30) clearInterval(poll);
        }, 100);
    window.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);
    return () => {
      clearInterval(poll);
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
    };
  }, [target, pathname]);
  return rect;
}
