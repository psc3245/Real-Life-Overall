import { describe, expect, it } from "vitest";
import { authAccounts, users } from "../src/db/schema";
import { createApp } from "../src/app";
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
  const app = createApp(() => ({ db, llm: new LlmClient(resolver, dbCallRecorder(db)) }));
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
  return { db, app, request, post, clearCookies: () => (cookie = "") };
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
    const { request, post, db } = await createAuthApp();
    expect((await request("/me")).status).toBe(401);

    const signUp = await post("/auth/sign-up/email", {
      email: "Peter.Collins@example.com",
      password: "a-long-password",
      name: "Peter",
    });
    expect(signUp.status).toBe(200);

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
    const { request, post, clearCookies } = await createAuthApp();
    await post("/auth/sign-up/email", {
      email: "a@example.com",
      password: "a-long-password",
      name: "A",
    });
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

  it("refuses to start without a secret", async () => {
    const { app } = await createAuthApp();
    const res = await app.request("/api/health", {}, { ...authBindings, BETTER_AUTH_SECRET: "" });
    expect(res.status).toBe(500);
  });
});
