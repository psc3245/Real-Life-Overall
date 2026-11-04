import Constants from "expo-constants";

/** Production: one Worker serves the website and the API on this origin (DESIGN.md §8.8). */
const PRODUCTION_ORIGIN = "https://getovr.dev";

/**
 * Where the API lives. EXPO_PUBLIC_API_URL wins. Otherwise a release build uses production, and a
 * dev build uses port 8787 on the machine serving the bundle, which is localhost in the Simulator
 * and the Mac's LAN address on a phone.
 */
function defaultApiUrl(): string {
  if (!__DEV__) return `${PRODUCTION_ORIGIN}/api`;
  const host = Constants.expoConfig?.hostUri?.split(":")[0] ?? "localhost";
  return `http://${host}:8787/api`;
}

export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? defaultApiUrl()).replace(/\/$/, "");

/** The URL scheme in app.json, also trusted by the API's Better Auth config. */
export const APP_SCHEME = "rlo";

/** The website, for links people open elsewhere (shared profiles, email confirmation, resets). */
export const WEB_URL = (
  process.env.EXPO_PUBLIC_WEB_URL ?? (__DEV__ ? "http://localhost:5173" : PRODUCTION_ORIGIN)
).replace(/\/$/, "");
