import { expect } from "vitest";
import { createApp } from "../src/app";
import type { Email } from "../src/auth/email";
import { dbCallRecorder, LlmClient } from "../src/llm/client";
import { createTestDb, mockResolver, testBindings } from "./helpers";

export const ORIGIN = "http://localhost:5173";
export const authBindings = {
  ...testBindings,
  AUTH_MODE: "better-auth",
  BETTER_AUTH_SECRET: "test-secret-test-secret-test-secret-0123",
  PUBLIC_URL: ORIGIN,
  PASSWORD_HASH_ITERATIONS: "10000",
};

export async function createAuthApp(extraBindings: Record<string, string> = {}) {
  const bindings = { ...authBindings, ...extraBindings };
  const db = await createTestDb();
  const { resolver } = mockResolver([]);
  const emails: Email[] = [];
  const mailer = async (email: Email) => void emails.push(email);
  const app = createApp(() => ({ db, llm: new LlmClient(resolver, dbCallRecorder(db)), mailer }));
  let cookie = "";
  const request = async (path: string, init: RequestInit = {}) => {
    const headers = new Headers(init.headers);
    headers.set("origin", ORIGIN);
    if (cookie) headers.set("cookie", cookie);
    if (init.body) headers.set("content-type", "application/json");
    const res = await app.request(`/api${path}`, { ...init, headers }, bindings);
    const setCookie = res.headers.getSetCookie?.() ?? [];
    for (const c of setCookie) {
      const [pair] = c.split(";");
      const [name] = pair!.split("=");
      cookie = [...cookie.split("; ").filter((x) => x && !x.startsWith(`${name}=`)), pair!].join(
        "; ",
      );
    }
    return res;
  };
  const post = (path: string, body: unknown) =>
    request(path, { method: "POST", body: JSON.stringify(body) });
  /** The first link in the newest email to `to`, as an /api path. */
  const linkFor = (to: string) => {
    const email = emails.findLast((e) => e.to === to);
    const url = email?.text.match(/https?:\/\/\S+/)?.[0];
    if (!url) throw new Error(`no email with a link for ${to}`);
    const { pathname, search } = new URL(url);
    return pathname.replace(/^\/api/, "") + search;
  };
  /** Signs up and follows the confirmation link, which signs the new player in. */
  const signUp = async (email: string, password = "a-long-password", name = "A") => {
    const res = await post("/auth/sign-up/email", { email, password, name });
    expect(res.status).toBe(200);
    expect((await request(linkFor(email))).status).toBe(302);
  };
  return {
    db,
    app,
    emails,
    request,
    post,
    linkFor,
    signUp,
    clearCookies: () => (cookie = ""),
    /** The current cookie jar, to switch between signed-in players. */
    cookies: () => cookie,
    useCookies: (jar: string) => (cookie = jar),
  };
}
