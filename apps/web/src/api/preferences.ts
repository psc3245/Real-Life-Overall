import {
  applyPreferencesPatch,
  DEFAULT_PREFERENCES,
  mergePreferencesPatches,
  parsePreferences,
  type Feature,
  type Preferences,
  type PreferencesPatch,
} from "@rlo/shared";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useCallback, useLayoutEffect, useSyncExternalStore } from "react";
import { applyAppearance } from "../lib/appearance";
import { useAuthState } from "./auth";
import { api } from "./client";
import { queryKeys, useMe, type Me } from "./hooks";

const CACHE_KEY = "rlo.preferences";

/** The last signed-in player's preferences, so the theme applies before /me loads. */
let cached: Preferences | undefined;
export function cachedPreferences(): Preferences {
  if (cached) return cached;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    cached = raw ? parsePreferences(JSON.parse(raw)) : DEFAULT_PREFERENCES;
  } catch {
    cached = DEFAULT_PREFERENCES;
  }
  return cached;
}

export function cachePreferences(prefs: Preferences) {
  cached = prefs;
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(prefs));
  } catch {
    // Storage unavailable; the theme still applies once /me loads.
  }
}

/** The signed-in player's preferences (cached ones while loading or signed out). */
export function usePreferences(): Preferences {
  const auth = useAuthState();
  const me = useMe(auth.signedIn);
  return me.data?.preferences ?? cachedPreferences();
}

/** Keeps <html> styled from the current preferences; mounted once in the root layout. */
export function useApplyPreferences() {
  const auth = useAuthState();
  const me = useMe(auth.signedIn);
  const prefs = me.data?.preferences;
  useLayoutEffect(() => {
    if (!prefs) return;
    applyAppearance(prefs);
    cachePreferences(prefs);
  }, [prefs]);
}

export function useFeature(feature: Feature): boolean {
  return usePreferences().features[feature];
}

// Saving: changes apply to the cache at once (so the UI restyles live) and are sent to the API in
// one debounced PATCH, which keeps color pickers and rapid toggles from flooding requests.

export type SaveStatus = "idle" | "saving" | "saved" | "error";
let status: SaveStatus = "idle";
const listeners = new Set<() => void>();
const setStatus = (next: SaveStatus) => {
  status = next;
  listeners.forEach((l) => l());
};
let pending: PreferencesPatch = {};
let timer: ReturnType<typeof setTimeout> | undefined;

async function flush(queryClient: QueryClient) {
  const body = pending;
  pending = {};
  setStatus("saving");
  try {
    const me = await api<Me>("/me", {
      method: "PATCH",
      body: JSON.stringify({ preferences: body }),
    });
    // A newer change is already queued: keep the optimistic copy until it lands.
    if (Object.keys(pending).length === 0) {
      queryClient.setQueryData(queryKeys.me, me);
      setStatus("saved");
    }
  } catch {
    setStatus("error");
    await queryClient.invalidateQueries({ queryKey: queryKeys.me });
  }
}

export function useSetPreferences() {
  const queryClient = useQueryClient();
  return useCallback(
    (patch: PreferencesPatch) => {
      // A /me refetch landing mid-edit would overwrite the optimistic copy; stop it first.
      void queryClient.cancelQueries({ queryKey: queryKeys.me });
      queryClient.setQueryData<Me>(queryKeys.me, (me) =>
        me ? { ...me, preferences: applyPreferencesPatch(me.preferences, patch) } : me,
      );
      pending = mergePreferencesPatches(pending, patch);
      setStatus("saving");
      clearTimeout(timer);
      timer = setTimeout(() => void flush(queryClient), 400);
    },
    [queryClient],
  );
}

export function useSaveStatus(): SaveStatus {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => status,
  );
}
