import type { AdminUserDto, MeDto } from "@rlo/shared";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { authAccounts, authSessions, authUsers, users } from "../src/db/schema";
import { isBootstrapAdmin } from "../src/middleware/auth";
import { createAuthApp } from "./auth-helpers";
import { createRatedApp, json } from "./flows";

const body = async <T>(res: Response) => (await res.json()) as T;
const BOSS = "boss@example.com";

/** Better Auth mode with BOSS bootstrapped as the first admin, signed in. */
async function setupAdmin() {
  const t = await createAuthApp({ ADMIN_EMAILS: ` someone@else.com, ${BOSS.toUpperCase()} ` });
  await t.signUp(BOSS, "a-long-password", "Boss");
  const admin = t.cookies();
  const create = (account: Record<string, unknown>) =>
    t.post("/admin/users", { name: "New", password: "a-long-password", ...account });
  const signIn = (email: string, password = "a-long-password") =>
    t.post("/auth/sign-in/email", { email, password });
  return { ...t, admin, create, signIn };
}

describe("first admin from ADMIN_EMAILS", () => {
  it("only counts a confirmed email on the list", () => {
    const list = "a@x.com, B@x.com";
    expect(isBootstrapAdmin(list, { email: "b@x.com", emailVerified: true })).toBe(true);
    expect(isBootstrapAdmin(list, { email: "b@x.com", emailVerified: false })).toBe(false);
    expect(isBootstrapAdmin(list, { email: "c@x.com", emailVerified: true })).toBe(false);
    expect(isBootstrapAdmin("", { email: "", emailVerified: true })).toBe(false);
  });

  it("promotes a listed email on sign-in, and nobody else", async () => {
    const { request, signUp } = await setupAdmin();
    expect((await body<MeDto>(await request("/me"))).role).toBe("admin");
    await signUp("player@example.com");
    expect((await body<MeDto>(await request("/me"))).role).toBe("user");
    expect((await request("/admin/users")).status).toBe(404);
  });
});

describe("account management", () => {
  it("creates a confirmed account that can sign in at once, with its type", async () => {
    const { create, signIn, request, useCookies, admin, emails } = await setupAdmin();
    const res = await create({ email: " Pre@Example.com ", role: "premium" });
    expect(res.status).toBe(201);
    const created = await body<AdminUserDto>(res);
    expect(created).toMatchObject({
      email: "pre@example.com",
      username: "pre",
      displayName: "New",
      role: "premium",
      emailVerified: true,
      signIn: ["credential"],
    });
    expect(emails.some((e) => e.to === "pre@example.com")).toBe(false);

    expect((await create({ email: "pre@example.com" })).status).toBe(409);
    expect((await create({ email: "x@example.com", password: "short" })).status).toBe(400);

    expect((await signIn("pre@example.com")).status).toBe(200);
    expect((await body<MeDto>(await request("/me"))).role).toBe("premium");
    // A non-admin can't create accounts.
    expect((await request("/admin/users", { method: "POST", body: "{}" })).status).toBe(404);
    useCookies(admin);
  });

  it("emails a confirmation link to an unconfirmed account", async () => {
    const { create, signIn, linkFor, request } = await setupAdmin();
    expect((await create({ email: "later@example.com", verified: false })).status).toBe(201);
    expect(linkFor("later@example.com")).toContain("/auth/verify-email");
    expect((await signIn("later@example.com")).status).toBe(403);
    expect((await request(linkFor("later@example.com"))).status).toBe(302);
    expect((await body<MeDto>(await request("/me"))).username).toBe("later");
  });

  it("searches by name, email or username and filters by type", async () => {
    const { create, request } = await setupAdmin();
    await create({ email: "jordan@example.com", name: "Michael J", role: "premium" });
    await create({ email: "bird@example.com", name: "Larry" });
    const search = async (query: string) =>
      (await body<AdminUserDto[]>(await request(`/admin/users?${query}`))).map((u) => u.username);
    expect(await search("q=michael")).toEqual(["jordan"]);
    expect(await search("q=BIRD@")).toEqual(["bird"]);
    expect(await search("q=%25")).toEqual([]); // a literal %, not a wildcard
    expect(await search("role=premium")).toEqual(["jordan"]);
    expect((await search("")).sort()).toEqual(["bird", "boss", "jordan"]);
  });

  it("marks an email confirmed, sends resets and signs out every device", async () => {
    const { create, signIn, request, post, useCookies, cookies, admin, emails, db } =
      await setupAdmin();
    const later = await body<AdminUserDto>(
      await create({ email: "later@example.com", verified: false }),
    );
    const act = (id: string, action: string) => post(`/admin/users/${id}/actions`, { action });

    expect((await act(later.id, "resend-verification")).status).toBe(204);
    expect(emails.filter((e) => e.to === "later@example.com")).toHaveLength(2);
    expect((await act(later.id, "verify-email")).status).toBe(204);
    expect((await act(later.id, "resend-verification")).status).toBe(400);

    expect((await act(later.id, "send-password-reset")).status).toBe(204);
    expect(emails.at(-1)!.text).toContain("/reset-password");

    expect((await signIn("later@example.com")).status).toBe(200);
    const player = cookies();
    expect((await request("/me")).status).toBe(200);
    useCookies(admin);
    expect((await act(later.id, "sign-out-everywhere")).status).toBe(204);
    const [identity] = await db.select().from(authUsers).where(eq(authUsers.email, later.email));
    expect(
      await db.select().from(authSessions).where(eq(authSessions.userId, identity!.id)),
    ).toEqual([]);
    useCookies(player);
    expect((await request("/me")).status).toBe(401);
    useCookies(admin);
    expect((await act(later.id, "nope")).status).toBe(400);
  });

  it("deletes an account and its sign-in, after the username is typed back", async () => {
    const { create, signIn, request, db, useCookies, admin } = await setupAdmin();
    const gone = await body<AdminUserDto>(await create({ email: "gone@example.com" }));
    expect((await signIn("gone@example.com")).status).toBe(200);
    useCookies(admin);
    const del = (id: string, confirm: string) =>
      request(`/admin/users/${id}`, { method: "DELETE", body: JSON.stringify({ confirm }) });

    expect((await del(gone.id, "wrong")).status).toBe(400);
    expect((await del(gone.id, "GONE")).status).toBe(204);
    expect(await db.select().from(users).where(eq(users.id, gone.id))).toEqual([]);
    expect(await db.select().from(authUsers).where(eq(authUsers.email, gone.email))).toEqual([]);
    expect((await db.select().from(authAccounts)).length).toBe(1); // only the admin's
    expect((await signIn("gone@example.com")).status).toBe(401);
    useCookies(admin);
    expect((await del(gone.id, "gone")).status).toBe(404);

    const me = await body<MeDto>(await request("/me"));
    expect((await del(me.id, me.username)).status).toBe(400);
  });
});

describe("account management in dev mode", () => {
  it("deletes dev users and refuses sign-in actions they don't have", async () => {
    const t = await createRatedApp([]);
    const me = await body<MeDto>(await t.request("/me"));
    await t.db.update(users).set({ role: "admin" }).where(eq(users.id, me.id));
    const other = await body<MeDto>(await t.request("/me", { user: "other" }));

    expect(
      (
        await t.request(`/admin/users/${other.id}/actions`, {
          method: "POST",
          ...json({ action: "verify-email" }),
        })
      ).status,
    ).toBe(400);
    const list = await body<AdminUserDto[]>(await t.request("/admin/users?q=oth"));
    expect(list).toMatchObject([{ username: "other", emailVerified: null, signIn: [] }]);
    expect(
      (
        await t.request("/admin/users", {
          method: "POST",
          ...json({ email: "n@example.com", name: "N", password: "a-long-password" }),
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await t.request(`/admin/users/${other.id}`, {
          method: "DELETE",
          ...json({ confirm: "other" }),
        })
      ).status,
    ).toBe(204);
    expect(await t.db.select().from(users).where(eq(users.id, other.id))).toEqual([]);
    // Non-admins can't delete anyone.
    expect(
      (
        await t.request(`/admin/users/${me.id}`, {
          method: "DELETE",
          user: "mallory",
          ...json({ confirm: "tester" }),
        })
      ).status,
    ).toBe(404);
  });
});
