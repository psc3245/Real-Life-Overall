import { describe, expect, it } from "vitest";
import { users } from "../src/db/schema";
import { createTestApp, testBindings } from "./helpers";

describe("app", () => {
  it("serves health without auth", async () => {
    const { app } = await createTestApp();
    const res = await app.request("/health", {}, testBindings);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("returns JSON 404s", async () => {
    const { request } = await createTestApp();
    const res = await request("/nope");
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Not found" });
  });

  it("refuses dev auth in production", async () => {
    const { app } = await createTestApp();
    const res = await app.request("/health", {}, { ...testBindings, APP_ENV: "production" });
    expect(res.status).toBe(500);
  });
});

describe("/me", () => {
  it("creates the dev user on first request and never leaks private columns", async () => {
    const { request, db } = await createTestApp();
    const res = await request("/me", { user: "peter" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ username: "peter", displayName: "peter", timezone: "UTC" });
    expect(body).not.toHaveProperty("email");
    expect(body).not.toHaveProperty("authSubject");

    await request("/me", { user: "peter" });
    expect(await db.select().from(users)).toHaveLength(1);
  });

  it("rejects malformed dev usernames", async () => {
    const { request } = await createTestApp();
    const res = await request("/me", { user: "Robert'); DROP TABLE" });
    expect(res.status).toBe(400);
  });

  it("updates profile fields with validation", async () => {
    const { request } = await createTestApp();
    const ok = await request("/me", {
      method: "PATCH",
      body: JSON.stringify({ timezone: "America/Chicago", displayName: "Peter" }),
    });
    expect(await ok.json()).toMatchObject({ timezone: "America/Chicago", displayName: "Peter" });

    const bad = await request("/me", {
      method: "PATCH",
      body: JSON.stringify({ timezone: "Mars/Base" }),
    });
    expect(bad.status).toBe(400);
  });
});
