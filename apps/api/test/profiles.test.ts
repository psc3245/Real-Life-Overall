import { DEFAULT_PREFERENCES, type DayDto, type MeDto, type ProfileDto } from "@rlo/shared";
import { describe, expect, it } from "vitest";
import { createRatedApp, json } from "./flows";
import { jsonResult, testBindings } from "./helpers";

const body = async <T>(res: Response) => (await res.json()) as T;

describe("profiles", () => {
  it("are private by default: only the owner can see them", async () => {
    const t = await createRatedApp();
    const own = await t.request("/profiles/tester");
    expect(own.status).toBe(200);
    const profile = await body<ProfileDto>(own);
    expect(profile).toMatchObject({ username: "tester", isSelf: true, visibility: "private" });
    expect(profile.card?.overall).toBeGreaterThan(0);

    expect((await t.request("/profiles/tester", { user: "stranger" })).status).toBe(404);
    // Signed out (no dev header): same answer as a missing user.
    expect((await t.app.request("/api/profiles/tester", {}, testBindings)).status).toBe(404);
    expect((await t.request("/profiles/nobody-here", { user: "stranger" })).status).toBe(404);
  });

  it("share only the top of the tree once public", async () => {
    const t = await createRatedApp();
    await t.request("/me", { method: "PATCH", ...json({ profileVisibility: "public" }) });

    const res = await t.app.request("/api/profiles/tester", {}, testBindings);
    expect(res.status).toBe(200);
    const profile = await body<ProfileDto>(res);
    expect(profile.isSelf).toBe(false);
    expect(profile.visibility).toBeNull();
    expect(profile.card).toMatchObject({ archetype: "Desk Athlete", recappedDays: 0 });
    expect(profile.card!.categories.map((c) => c.name).sort()).toEqual(["Career", "Fitness"]);

    // Attribute names, rationales and summaries never leave the owner's account.
    const raw = JSON.stringify(profile);
    for (const secret of ["Cardio", "Strength", "Because of", "Career leads"]) {
      expect(raw).not.toContain(secret);
    }
  });

  it("keep the shared card current after a recap", async () => {
    const t = await createRatedApp([
      jsonResult({
        changes: [{ ref: "n3", delta: 3, reason: "Ran.", evidence: "run" }],
        narrative: "Good day.",
        flags: [],
        nextPrompts: [],
      }),
    ]);
    await t.request("/me", { method: "PATCH", ...json({ profileVisibility: "public" }) });
    const before = (await body<ProfileDto>(await t.request("/profiles/tester", { user: "x" })))
      .card!;

    const today = (await body<DayDto>(await t.request("/days/today"))).today;
    await t.request(`/days/${today}/journal`, {
      method: "PUT",
      ...json({ journal: "Went for a run." }),
    });
    await t.request(`/days/${today}/recap`, { method: "POST" });
    await t.request("/ratings"); // the owner's next view refreshes the card

    const after = (await body<ProfileDto>(await t.request("/profiles/tester", { user: "x" })))
      .card!;
    expect(after.recappedDays).toBe(1);
    expect(after.overall).toBeGreaterThan(before.overall);
  });
});

describe("usernames", () => {
  it("can be changed, normalized to lowercase, and must be unique and not reserved", async () => {
    const t = await createRatedApp();
    await t.request("/me", { user: "taken" }); // creates the dev user "taken"

    const renamed = await t.request("/me", { method: "PATCH", ...json({ username: "Jordan_23" }) });
    expect(renamed.status).toBe(200);
    expect(await body<{ username: string }>(renamed)).toMatchObject({ username: "jordan_23" });

    // Dev mode identifies users by username, so later requests use the new one.
    const user = "jordan_23";
    const clash = await t.request("/me", { user, method: "PATCH", ...json({ username: "taken" }) });
    expect(clash.status).toBe(409);
    for (const bad of ["admin", "ab", "has space", "-dash"]) {
      const res = await t.request("/me", { user, method: "PATCH", ...json({ username: bad }) });
      expect(res.status, bad).toBe(400);
    }
  });

  it("store personalization, merging each top-level preference", async () => {
    const t = await createRatedApp();
    const fresh = await body<MeDto>(await t.request("/me"));
    expect(fresh.preferences).toEqual(DEFAULT_PREFERENCES);

    await t.request("/me", { method: "PATCH", ...json({ preferences: { theme: "oled" } }) });
    const features = { ...DEFAULT_PREFERENCES.features, goals: false };
    const res = await t.request("/me", {
      method: "PATCH",
      ...json({ preferences: { accent: "gold", features } }),
    });
    expect(res.status).toBe(200);
    const me = await body<MeDto>(res);
    expect(me.preferences).toMatchObject({ theme: "oled", accent: "gold" });
    expect(me.preferences.features.goals).toBe(false);
    expect(me.preferences.features.habits).toBe(true);

    for (const bad of [{ theme: "neon" }, { colour: "red" }, { features: { goals: false } }]) {
      const rejected = await t.request("/me", { method: "PATCH", ...json({ preferences: bad }) });
      expect(rejected.status, JSON.stringify(bad)).toBe(400);
    }
  });
});
