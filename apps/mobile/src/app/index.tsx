import { Redirect } from "expo-router";

/** The app opens on Today (signed-out players are guarded off to sign-in by the root stack). */
export default function Index() {
  return <Redirect href="/today" />;
}
