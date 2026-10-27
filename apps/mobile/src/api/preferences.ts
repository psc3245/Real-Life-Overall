import {
  applyPreferencesPatch,
  DEFAULT_PREFERENCES,
  mergePreferencesPatches,
  type Feature,
  type Preferences,
  type PreferencesPatch,
} from "@rlo/shared";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useCallback, useSyncExternalStore } from "react";
import { api } from "./client";
import { queryKeys, useMe, type Me } from "./hooks";
import { useAuthState } from "./session";

/** The signed-in player's preferences (defaults while loading). Shared with the web via /me. */
export function usePreferences(): Preferences {
  const auth = useAuthState();
  const me = useMe(auth.signedIn);
  return me.data?.preferences ?? DEFAULT_PREFERENCES;
}

export function useFeature(feature: Feature): boolean {
  return usePreferences().features[feature];
}

// Saving: changes apply to the cache at once and go to the API in one debounced PATCH, so rapid
// toggles don't flood requests. Same scheme as the web (apps/web/src/api/preferences.ts).

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
