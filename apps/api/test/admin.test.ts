import type {
  AdminOverviewDto,
  AdminUserDto,
  LlmCallDto,
  MeDto,
  RecapDebugDto,
  DayDto,
} from "@rlo/shared";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { users } from "../src/db/schema";
import { createRatedApp, json } from "./flows";
import { jsonResult } from "./helpers";

const body = async <T>(res: Response) => (await res.json()) as T;

async function setup() {
  const t = await createRatedApp([
    jsonResult({ changes: [], narrative: "Ok.", flags: [], nextPrompts: [] }),
  ]);
  const me = await body<MeDto>(await t.request("/me"));
  const promote = () => t.db.update(users).set({ role: "admin" }).where(eq(users.id, me.id));
  return { ...t, me, promote };
}

describe("admin", () => {
  it("hides admin routes from regular users and can't be self-granted", async () => {
    const { request, me } = await setup();
    expect(me.role).toBe("user");
    expect((await request("/admin/overview")).status).toBe(404);
    const patched = await body<MeDto>(
      await request("/me", { method: "PATCH", ...json({ role: "admin", displayName: "X" }) }),
    );
    expect(patched.role).toBe("user");
  });

  it("reports usage, calls and users to admins", async () => {
    const { request, promote } = await setup();
    await promote();
    const overview = await body<AdminOverviewDto>(await request("/admin/overview"));
    // Onboarding made two LLM calls (questionnaire and ratings).
    expect(overview.windows[0]).toMatchObject({ label: "24h", calls: 2 });
    expect(overview.byPurpose.map((r) => r.key).sort()).toEqual([
      "onboarding.initialRatings",
      "onboarding.questionnaire",
    ]);
    expect(overview).toMatchObject({ users: 1, admins: 1 });

    const calls = await body<LlmCallDto[]>(await request("/admin/llm-calls?limit=5"));
    expect(calls[0]).toMatchObject({ username: "tester", model: "mock-model" });

    const list = await body<AdminUserDto[]>(await request("/admin/users"));
    expect(list[0]).toMatchObject({ username: "tester", role: "admin", llmCalls: 2 });
  });

  it("changes roles, but never your own admin role", async () => {
    const { request, promote, me } = await setup();
    await promote();
    await request("/me", { user: "other" }); // creates a second user
    const other = (await body<AdminUserDto[]>(await request("/admin/users"))).find(
      (u) => u.username === "other",
    )!;
    expect(
      (await request(`/admin/users/${other.id}`, { method: "PATCH", ...json({ role: "admin" }) }))
        .status,
    ).toBe(204);
    expect((await body<MeDto>(await request("/me", { user: "other" }))).role).toBe("admin");
    const self = await request(`/admin/users/${me.id}`, {
      method: "PATCH",
      ...json({ role: "user" }),
    });
    expect(self.status).toBe(400);
  });

  it("shows a recap's raw output and the call behind it", async () => {
    const { request, promote } = await setup();
    await promote();
    const today = (await body<DayDto>(await request("/days/today"))).today;
    await request(`/days/${today}/journal`, { method: "PUT", ...json({ journal: "Ran 5k." }) });
    const day = await body<DayDto>(await request(`/days/${today}/recap`, { method: "POST" }));
    const debug = await body<RecapDebugDto>(await request(`/admin/recaps/${day.recap!.id}`));
    expect(debug).toMatchObject({ kind: "daily", status: "active", runs: [{ id: day.recap!.id }] });
    expect(debug.promptVersion).toMatch(/^daily-recap-/);
    expect(debug.calls[0]).toMatchObject({ purpose: "recap.daily" });
  });
});
