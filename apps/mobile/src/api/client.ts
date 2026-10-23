import * as SecureStore from "expo-secure-store";
import { API_URL } from "@/lib/config";
import { authClient } from "./auth";

const DEV_USER_KEY = "rlo.devUser";
let devUser = SecureStore.getItem(DEV_USER_KEY) ?? "dev";

/** In AUTH_MODE=dev the API trusts this header instead of a session (DESIGN.md §8.5). */
export function getDevUser(): string {
  return devUser;
}

export function setDevUser(username: string) {
  devUser = username;
  SecureStore.setItem(DEV_USER_KEY, username);
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly body: unknown,
  ) {
    super(message);
  }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("x-dev-user", devUser);
  const cookie = await authClient.getCookie();
  if (cookie) headers.set("cookie", cookie);
  if (init.body) headers.set("content-type", "application/json");

  // credentials "omit": the session goes in the cookie header above, not the native cookie jar.
  const res = await fetch(`${API_URL}${path}`, { ...init, headers, credentials: "omit" });
  const body: unknown = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    const message =
      body && typeof body === "object" && "error" in body ? String(body.error) : res.statusText;
    throw new ApiError(res.status, message, body);
  }
  return body as T;
}
