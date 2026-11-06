import type { SeasonMode } from "@rlo/shared";
import { useQuery } from "@tanstack/react-query";
import { fetchRatings, ratingsKey } from "../api/ratings";

const CACHE_KEY = "rlo.seasonMode";

/** The last season mode seen, so a Souls season's look applies before /ratings loads. */
export function cachedSeasonMode(): SeasonMode | null {
  try {
    return (localStorage.getItem(CACHE_KEY) as SeasonMode | null) ?? null;
  } catch {
    return null;
  }
}

function cacheSeasonMode(mode: SeasonMode | null) {
  try {
    if (mode) localStorage.setItem(CACHE_KEY, mode);
    else localStorage.removeItem(CACHE_KEY);
  } catch {
    // Storage unavailable; the look still follows once ratings load.
  }
}

/**
 * The signed-in player's season mode, read from the ratings already in the cache (this never
 * fetches on its own), falling back to the last one seen.
 */
export function useSeasonMode(): SeasonMode | null {
  const ratings = useQuery({ queryKey: ratingsKey, queryFn: fetchRatings, enabled: false });
  if (ratings.data !== undefined) {
    const mode = ratings.data?.season?.mode ?? null;
    if (mode !== cachedSeasonMode()) cacheSeasonMode(mode);
    return mode;
  }
  return cachedSeasonMode();
}
