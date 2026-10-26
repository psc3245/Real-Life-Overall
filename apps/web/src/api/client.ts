const API_URL = import.meta.env.VITE_API_URL ?? "/api";
const DEV_USER_KEY = "rlo.devUser";

/** In AUTH_MODE=dev the API trusts this header instead of a session (DESIGN.md §8.5). */
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

/** One API call, for the admin debug panel. */
export interface RequestLogEntry {
  id: number;
  method: string;
  path: string;
  status: number | null;
  ms: number;
  at: number;
  /** Response size in characters (JSON), when there was a body. */
  size: number | null;
  error: string | null;
}

const MAX_LOG = 100;
let requestLog: RequestLogEntry[] = [];
let nextLogId = 1;
const logListeners = new Set<() => void>();

function record(entry: Omit<RequestLogEntry, "id">) {
  requestLog = [{ ...entry, id: nextLogId++ }, ...requestLog].slice(0, MAX_LOG);
  logListeners.forEach((l) => l());
}

/** Recent API calls, newest first (useSyncExternalStore-compatible). */
export const requestLogStore = {
  subscribe(listener: () => void) {
    logListeners.add(listener);
    return () => logListeners.delete(listener);
  },
  get: () => requestLog,
  clear() {
    requestLog = [];
    logListeners.forEach((l) => l());
  },
};

function parseBody(text: string): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null; // Not JSON (e.g. a proxy error page); callers fall back to statusText.
  }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("x-dev-user", getDevUser());
  if (init.body) headers.set("content-type", "application/json");

  const method = init.method ?? "GET";
  const started = performance.now();
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { ...init, headers });
  } catch (error) {
    record({
      method,
      path,
      status: null,
      ms: Math.round(performance.now() - started),
      at: Date.now(),
      size: null,
      error: error instanceof Error ? error.message : "Network error",
    });
    throw error;
  }
  const text = res.status === 204 ? "" : await res.text().catch(() => "");
  const body = parseBody(text);
  record({
    method,
    path,
    status: res.status,
    ms: Math.round(performance.now() - started),
    at: Date.now(),
    size: text ? text.length : null,
    error: res.ok ? null : text.slice(0, 300),
  });
  if (!res.ok) {
    const message =
      body && typeof body === "object" && "error" in body ? String(body.error) : res.statusText;
    throw new ApiError(res.status, message, body);
  }
  return body as T;
}
