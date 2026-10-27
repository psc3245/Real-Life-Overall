import type { StartPage } from "@rlo/shared";
import { Redirect, type Href } from "expo-router";
import { useMe } from "@/api/hooks";
import { Loading } from "@/components/ui";

const START: Record<StartPage, Href> = {
  home: "/today",
  today: "/today",
  log: "/log",
  ratings: "/ratings",
  habits: "/habits",
};

/** Opens on the player's "Open the app on" choice (signed-out players are guarded to sign-in). */
export default function Index() {
  const me = useMe();
  if (me.isPending) return <Loading />;
  const start = me.data?.preferences.startPage ?? "today";
  // The log is pushed over Today so Back lands somewhere sensible.
  if (start === "log") return <Redirect href={{ pathname: "/today", params: { open: "log" } }} />;
  return <Redirect href={START[start]} />;
}
