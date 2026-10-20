const API_URL = import.meta.env.VITE_API_URL ?? "/api";
const DEV_USER_KEY = "rlo.devUser";

/** Auth is deferred (DESIGN.md §8.5): the API trusts an x-dev-user header in dev mode. */
export function getDevUser(): string {
  try {
    return localStorage.getItem(DEV_USER_KEY) ?? "dev";
  } catch {
    return "dev";
  }
}

export function setDevUser(username: string) {
  try {
    localStorage.setItem(DEV_USER_KEY, username);
  } catch {
    // Storage unavailable; the default dev user still works.
  }
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
  headers.set("x-dev-user", getDevUser());
  if (init.body) headers.set("content-type", "application/json");

  const res = await fetch(`${API_URL}${path}`, { ...init, headers });
  const body: unknown = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    const message =
      body && typeof body === "object" && "error" in body ? String(body.error) : res.statusText;
    throw new ApiError(res.status, message, body);
  }
  return body as T;
}
