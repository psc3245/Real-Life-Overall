import { describe, expect, it } from "vitest";
import { authAccounts, users } from "../src/db/schema";
import { createApp } from "../src/app";
import type { Email } from "../src/auth/email";
import { passwordHasher } from "../src/auth/password";
import { dbCallRecorder, LlmClient } from "../src/llm/client";
import { createTestDb, mockResolver, testBindings } from "./helpers";

const ORIGIN = "http://localhost:5173";
const authBindings = {
  ...testBindings,
  AUTH_MODE: "better-auth",
  BETTER_AUTH_SECRET: "test-secret-test-secret-test-secret-0123",
  PUBLIC_URL: ORIGIN,
  PASSWORD_HASH_ITERATIONS: "10000",
};

async function createAuthApp() {
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
    const res = await app.request(`/api${path}`, { ...init, headers }, authBindings);
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
  };
}

describe("password hashing", () => {
  it("round-trips and rejects wrong passwords and malformed hashes", async () => {
    const h = passwordHasher(10_000);
    const hash = await h.hash("correct horse");
    expect(hash).toMatch(/^pbkdf2\$sha256\$10000\$/);
    expect(await h.verify({ hash, password: "correct horse" })).toBe(true);
    expect(await h.verify({ hash, password: "wrong horse" })).toBe(false);
    expect(await h.verify({ hash: "bcrypt$nope", password: "x" })).toBe(false);
  });
});

describe("better-auth mode", () => {
  it("signs up, links an app user, and authenticates later requests", async () => {
    const { request, post, db, linkFor } = await createAuthApp();
    expect((await request("/me")).status).toBe(401);

    const signUp = await post("/auth/sign-up/email", {
      email: "Peter.Collins@example.com",
      password: "a-long-password",
      name: "Peter",
    });
    expect(signUp.status).toBe(200);
    // No session until the email is confirmed.
    expect((await request("/me")).status).toBe(401);
    expect((await request(linkFor("peter.collins@example.com"))).status).toBe(302);

    const me = await request("/me");
    expect(me.status).toBe(200);
    expect(await me.json()).toMatchObject({ username: "petercollins", displayName: "Peter" });
    const [user] = await db.select().from(users);
    expect(user!.authSubject).toBeTruthy();
    const [account] = await db.select().from(authAccounts);
    expect(account!.password).toMatch(/^pbkdf2\$/);

    // The same identity maps to the same app user.
    await request("/me");
    expect(await db.select().from(users)).toHaveLength(1);
  });

  it("signs in with the right password only, and signs out", async () => {
    const { request, post, signUp, clearCookies } = await createAuthApp();
    await signUp("a@example.com");
    clearCookies();

    expect(
      (await post("/auth/sign-in/email", { email: "a@example.com", password: "nope-nope" })).status,
    ).toBe(401);
    expect((await request("/me")).status).toBe(401);
    expect(
      (await post("/auth/sign-in/email", { email: "a@example.com", password: "a-long-password" }))
        .status,
    ).toBe(200);
    expect((await request("/me")).status).toBe(200);

    await post("/auth/sign-out", {});
    expect((await request("/me")).status).toBe(401);
  });

  it("ignores the dev header and rejects short passwords", async () => {
    const { request, post } = await createAuthApp();
    expect((await request("/me", { headers: { "x-dev-user": "mallory" } })).status).toBe(401);
    const short = await post("/auth/sign-up/email", {
      email: "b@example.com",
      password: "short",
      name: "B",
    });
    expect(short.status).toBe(400);
  });

  it("reports the available sign-in options", async () => {
    const { request } = await createAuthApp();
    expect(await (await request("/auth-config")).json()).toEqual({
      mode: "better-auth",
      google: false,
    });
  });

  it("refuses an unconfirmed sign-in and re-sends the link", async () => {
    const { request, post, emails, clearCookies } = await createAuthApp();
    await post("/auth/sign-up/email", {
      email: "c@example.com",
      password: "a-long-password",
      name: "C",
      callbackURL: `${ORIGIN}/signin?next=/onboarding`,
    });
    expect(emails).toHaveLength(1);
    expect(emails[0]!.subject).toMatch(/confirm/i);

    const signIn = await post("/auth/sign-in/email", {
      email: "c@example.com",
      password: "a-long-password",
    });
    expect(signIn.status).toBe(403);
    expect(await signIn.json()).toMatchObject({ code: "EMAIL_NOT_VERIFIED" });
    expect(emails).toHaveLength(2);

    // The sign-up link signs them in and lands on its callback.
    const signUpLink = new URL(emails[0]!.text.match(/https?:\/\/\S+/)![0]);
    const verify = await request(signUpLink.pathname.replace(/^\/api/, "") + signUpLink.search);
    expect(verify.status).toBe(302);
    expect(verify.headers.get("location")).toBe(`${ORIGIN}/signin?next=/onboarding`);
    expect((await request("/me")).status).toBe(200);

    clearCookies();
    const bad = await request("/auth/verify-email?token=nope&callbackURL=%2Fsignin");
    expect(bad.headers.get("location")).toMatch(/error=INVALID_TOKEN/);
  });

  it("resets a forgotten password by email and signs out old sessions", async () => {
    const { request, post, signUp, emails, linkFor, clearCookies } = await createAuthApp();
    await signUp("d@example.com");
    const oldSession = await request("/me");
    expect(oldSession.status).toBe(200);

    // Unknown emails get the same answer and no email.
    const sent = emails.length;
    const unknown = await post("/auth/request-password-reset", {
      email: "nobody@example.com",
      redirectTo: `${ORIGIN}/reset-password`,
    });
    expect(unknown.status).toBe(200);
    expect(emails).toHaveLength(sent);

    await post("/auth/request-password-reset", {
      email: "d@example.com",
      redirectTo: `${ORIGIN}/reset-password`,
    });
    expect(emails.at(-1)!.subject).toMatch(/reset/i);
    const landing = await request(linkFor("d@example.com"));
    expect(landing.status).toBe(302);
    const location = new URL(landing.headers.get("location")!);
    expect(location.pathname).toBe("/reset-password");
    const token = location.searchParams.get("token");
    expect(token).toBeTruthy();

    const reset = await post("/auth/reset-password", { token, newPassword: "a-new-password" });
    expect(reset.status).toBe(200);
    expect((await request("/me")).status).toBe(401); // the old session was revoked
    // Tokens are single-use.
    const again = await post("/auth/reset-password", { token, newPassword: "another-password" });
    expect(again.status).toBe(400);

    clearCookies();
    expect(
      (await post("/auth/sign-in/email", { email: "d@example.com", password: "a-long-password" }))
        .status,
    ).toBe(401);
    expect(
      (await post("/auth/sign-in/email", { email: "d@example.com", password: "a-new-password" }))
        .status,
    ).toBe(200);
  });

  it("refuses to start in production without an email provider", async () => {
    const { app } = await createAuthApp();
    const res = await app.request("/api/health", {}, { ...authBindings, APP_ENV: "production" });
    expect(res.status).toBe(500);
  });

  it("refuses to start without a secret", async () => {
    const { app } = await createAuthApp();
    const res = await app.request("/api/health", {}, { ...authBindings, BETTER_AUTH_SECRET: "" });
    expect(res.status).toBe(500);
  });
});
