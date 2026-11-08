import type { StartPage } from "@rlo/shared";
import { Redirect, type Href } from "expo-router";
import { useMe } from "@/api/hooks";
import { usePreferences } from "@/api/preferences";
import { useActiveWorkout } from "@/api/workouts";
import { Loading } from "@/components/ui";

const START: Record<StartPage, Href> = {
  home: "/today",
  today: "/today",
  log: "/log",
  ratings: "/ratings",
  habits: "/habits",
};

/**
 * Opens on a workout in progress, or else the player's "Open the app on" choice (signed-out
 * players are guarded to sign-in).
 */
export default function Index() {
  const me = useMe();
  const { features } = usePreferences();
  const active = useActiveWorkout();
  if (me.isPending || active.isPending) return <Loading />;
  // Pushed over training so Back lands where it would have from "Resume".
  if (active.data && features.workouts) {
    return <Redirect href={{ pathname: "/habits", params: { view: "train", resume: "1" } }} />;
  }
  const start = me.data?.preferences.startPage ?? "today";
  // The log is pushed over Today so Back lands somewhere sensible.
  if (start === "log") return <Redirect href={{ pathname: "/today", params: { open: "log" } }} />;
  return <Redirect href={START[start]} />;
}
