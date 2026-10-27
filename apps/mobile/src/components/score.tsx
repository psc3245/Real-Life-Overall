import {
  formatGrowth,
  growthTier,
  ratingTier,
  RATING_MAX,
  type SeasonCardDto,
  type SeasonMode,
} from "@rlo/shared";
import * as SecureStore from "expo-secure-store";
import { createContext, useContext, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { Pressable, Text } from "react-native";
import { useRatings } from "@/api/ratings";
import { colors, tierKeyColor } from "@/lib/theme";

/**
 * How numbers on screen are scored (DESIGN.md §4.6): ratings on the 0-100 scale, or growth
 * (points gained) on a scale that fits the biggest number shown. Mirrors the web's score.tsx.
 */
export interface Score {
  mode: SeasonMode;
  /** The value a full bar stands for. */
  max: number;
}

const RATING_SCORE: Score = { mode: "rating", max: RATING_MAX };
/** Growth bars never get shorter than this scale, so early gains don't look maxed out. */
const GROWTH_SCALE_MIN = 10;

const ScoreContext = createContext<Score>(RATING_SCORE);

/** The score in effect: the signed-in player's season, or a card's own mode. */
export const useScore = () => useContext(ScoreContext);

/** A growth scale that fits every value (rounded up to a tidy number); 100 for ratings. */
export function scaleFor(mode: SeasonMode, values: (number | null | undefined)[]): number {
  if (mode === "rating") return RATING_MAX;
  const top = Math.max(GROWTH_SCALE_MIN, ...values.filter((v): v is number => v != null));
  const step = top <= 20 ? 5 : top <= 50 ? 10 : 25;
  return Math.ceil(top / step) * step;
}

export function ScoreProvider({
  mode,
  values,
  children,
}: {
  mode: SeasonMode;
  /** Everything a bar might show, so the growth scale fits them all. */
  values: (number | null | undefined)[];
  children: ReactNode;
}) {
  const max = scaleFor(mode, values);
  const score = useMemo(() => ({ mode, max }), [mode, max]);
  return <ScoreContext.Provider value={score}>{children}</ScoreContext.Provider>;
}

/** The signed-in player's own score, from their current season. */
export function OwnScoreProvider({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  const ratings = useRatings(enabled);
  const nodes = ratings.data?.nodes ?? [];
  return (
    <ScoreProvider
      mode={ratings.data?.season.mode ?? "rating"}
      values={nodes.flatMap((n) => [n.value, n.projection, n.goal])}
    >
      {children}
    </ScoreProvider>
  );
}

export function scoreColor(mode: SeasonMode, value: number): string {
  return tierKeyColor(mode === "growth" ? growthTier(value) : ratingTier(value));
}

/** "74.3" for a rating, "+3.4" for growth. */
export function formatScore(mode: SeasonMode, value: number, digits = 1): string {
  return mode === "growth" ? formatGrowth(value, digits) : value.toFixed(digits);
}

/** An archived season's numbers in its own mode. */
export function seasonCardScores(card: SeasonCardDto) {
  const growth = card.mode === "growth";
  return {
    mode: card.mode,
    overall: growth ? card.growth : card.overall,
    categories: card.nodes
      .filter((n) => n.depth === 1)
      .map((n) => ({ name: n.name, value: growth ? (n.growth ?? null) : n.value })),
  };
}

const SHOW_RATINGS_KEY = "rlo.showRatings";
const showListeners = new Set<() => void>();
let showRatings = SecureStore.getItem(SHOW_RATINGS_KEY) === "1";

function setShowRatings(next: boolean) {
  showRatings = next;
  SecureStore.setItem(SHOW_RATINGS_KEY, next ? "1" : "0");
  for (const listener of showListeners) listener();
}

/** Growth players can peek at their hidden ratings: one switch, remembered on this device. */
export function useShowRatings(): [boolean, (show: boolean) => void] {
  const show = useSyncExternalStore(
    (listener) => {
      showListeners.add(listener);
      return () => showListeners.delete(listener);
    },
    () => showRatings,
  );
  return [show, setShowRatings];
}

/**
 * In a growth season, the rating under a growth number: hidden behind a tap, and only ever on
 * the owner's own screens (other players never receive it).
 */
export function HiddenRating({ rating }: { rating: number | null }) {
  const { mode } = useScore();
  const [show, setShow] = useShowRatings();
  if (mode !== "growth" || rating === null) return null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: show }}
      accessibilityHint="Only you can see this"
      onPress={() => setShow(!show)}
      hitSlop={8}
    >
      <Text
        style={{
          color: colors.court500,
          fontSize: 12,
          letterSpacing: 1,
          textTransform: "uppercase",
        }}
      >
        {show ? `Rating ${rating.toFixed(1)} · hide` : "Show rating"}
      </Text>
    </Pressable>
  );
}
