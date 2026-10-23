import Constants from "expo-constants";

/**
 * Where the API lives. EXPO_PUBLIC_API_URL wins; otherwise use port 8787 on the machine serving
 * the bundle, which is localhost in the Simulator and the Mac's LAN address on a phone.
 */
function defaultApiUrl(): string {
  const host = Constants.expoConfig?.hostUri?.split(":")[0] ?? "localhost";
  return `http://${host}:8787/api`;
}

export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? defaultApiUrl()).replace(/\/$/, "");

/** The URL scheme in app.json, also trusted by the API's Better Auth config. */
export const APP_SCHEME = "rlo";

/** The website, for links people open elsewhere (shared profiles). */
export const WEB_URL = (process.env.EXPO_PUBLIC_WEB_URL ?? "http://localhost:5173").replace(
  /\/$/,
  "",
);
