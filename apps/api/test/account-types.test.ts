import type { AiUsageDto, BugReportDto, MeDto, OnboardingStateDto } from "@rlo/shared";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { llmCalls, users } from "../src/db/schema";
import {
  dbAccessGuard,
  dbCallRecorder,
  LlmBudgetError,
  LlmClient,
  LlmPremiumError,
} from "../src/llm/client";
import { createTestApp, jsonResult, mockResolver } from "./helpers";

const body = async <T>(res: Response) => (await res.json()) as T;
const json = (value: unknown) => ({ body: JSON.stringify(value) });

async function setup() {
  const t = await createTestApp();
  const me = await body<MeDto>(await t.request("/me"));
  const setRole = (role: "user" | "premium" | "dev" | "admin") =>
    t.db
      .update(users)
      .set({ role, premiumSince: role === "user" ? null : new Date() })
      .where(eq(users.id, me.id));
  await setRole("user");
  return { ...t, me, setRole };
}

describe("account types", () => {
  it("locks premium features for free accounts and unlocks them on upgrade", async () => {
    const { request, setRole } = await setup();
    const free = await body<MeDto>(await request("/me"));
    expect(free.role).toBe("user");
    expect(free.locked).toEqual({ coach: "premium" });
    expect(free.preferences.features.coach).toBe(false);

    const coach = await request("/coach");
    expect(coach.status).toBe(403);
    expect(await coach.json()).toMatchObject({ code: "premium_required" });
    const links = await request("/habits/suggest-links", {
      method: "POST",
      ...json({ name: "Run", type: "checkbox" }),
    });
    expect(links.status).toBe(403);

    expect(free.premiumSince).toBeNull();
    await setRole("dev");
    const dev = await body<MeDto>(await request("/me"));
    expect(dev.locked).toEqual({});
    expect(dev.preferences.features.coach).toBe(true);
    expect((await request("/coach")).status).toBe(200);
  });

  it("starts free accounts on a Growth season and refuses Rating", async () => {
    const { request, setRole } = await setup();
    const state = await body<OnboardingStateDto>(await request("/onboarding"));
    expect(state.season.mode).toBe("growth");
    const rating = await request("/onboarding/mode", {
      method: "PUT",
      ...json({ mode: "rating" }),
    });
    expect(rating.status).toBe(403);

    await setRole("premium");
    expect(
      (await request("/onboarding/mode", { method: "PUT", ...json({ mode: "rating" }) })).status,
    ).toBe(200);
  });

  it("keeps premium purposes from free accounts and holds them to the free budget", async () => {
    const { db, setRole, me } = await setup();
    const { resolver, model } = mockResolver(jsonResult({ answer: 1 }));
    const llm = new LlmClient(
      resolver,
      dbCallRecorder(db),
      undefined,
      dbAccessGuard(db, { premiumUsd: 1, freeUsd: 0.25 }),
    );
    const request = {
      purpose: "coach.chat" as const,
      userId: me.id,
      schema: z.object({ answer: z.number() }),
      system: "s",
      prompt: "p",
      promptVersion: "v1",
    };
    await expect(llm.generateStructured(request)).rejects.toBeInstanceOf(LlmPremiumError);
    // Recaps are for everyone.
    await expect(llm.generateStructured({ ...request, purpose: "recap.daily" })).resolves.toEqual({
      answer: 1,
    });
    expect(model.doGenerateCalls).toHaveLength(1);

    await db.insert(llmCalls).values({
      userId: me.id,
      purpose: "recap.daily",
      provider: "mock",
      model: "mock-model",
      promptVersion: "v1",
      costUsd: 0.3,
      latencyMs: 1,
    });
    await expect(
      llm.generateStructured({ ...request, purpose: "recap.daily" }),
    ).rejects.toBeInstanceOf(LlmBudgetError);
    await setRole("premium");
    await expect(llm.generateStructured(request)).resolves.toEqual({ answer: 1 });
  });

  it("takes bug reports from testers and lists them for admins", async () => {
    const { request, setRole } = await setup();
    const report = {
      message: "The chart doesn't load.",
      page: "/charts",
      platform: "web",
      device: "Firefox",
    };
    const post = () => request("/bug-reports", { method: "POST", ...json(report) });
    expect((await post()).status).toBe(404); // free accounts don't see it

    await setRole("dev");
    expect((await post()).status).toBe(201);
    expect((await request("/admin/bug-reports")).status).toBe(404);

    await setRole("admin");
    const [listed] = await body<BugReportDto[]>(await request("/admin/bug-reports?status=open"));
    expect(listed).toMatchObject({
      username: "tester",
      message: "The chart doesn't load.",
      page: "/charts",
      platform: "web",
      appVersion: null,
      status: "open",
    });
    const resolve = await request(`/admin/bug-reports/${listed!.id}`, {
      method: "PATCH",
      ...json({ status: "resolved" }),
    });
    expect(resolve.status).toBe(204);
    expect(await body<BugReportDto[]>(await request("/admin/bug-reports?status=open"))).toEqual([]);
  });

  it("starts the Premium clock when an admin upgrades someone, and stops it on Free", async () => {
    const { request, setRole } = await setup();
    await setRole("admin");
    await request("/me", { user: "other" });
    const other = (
      await body<{ id: string; username: string }[]>(await request("/admin/users"))
    ).find((u) => u.username === "other")!;
    const patch = (role: string) =>
      request(`/admin/users/${other.id}`, { method: "PATCH", ...json({ role }) });
    const since = async () =>
      (await body<MeDto>(await request("/me", { user: "other" }))).premiumSince;

    await patch("user");
    expect(await since()).toBeNull();
    await patch("premium");
    const started = await since();
    expect(started).not.toBeNull();
    await patch("dev"); // still premium: the clock keeps running
    expect(await since()).toBe(started);
    await patch("user");
    expect(await since()).toBeNull();
  });

  it("reports the share of the daily AI budget used, against the account's own budget", async () => {
    const { request, db, me, setRole } = await setup();
    const usage = async () => (await body<AiUsageDto>(await request("/me/ai-usage"))).usedPercent;
    expect(await usage()).toBe(0);
    await db.insert(llmCalls).values({
      userId: me.id,
      purpose: "recap.daily",
      provider: "mock",
      model: "mock-model",
      promptVersion: "v1",
      costUsd: 0.1,
      latencyMs: 1,
    });
    expect(await usage()).toBe(40); // $0.10 of the free $0.25 (the default)
    await setRole("premium");
    expect(await usage()).toBe(10); // of the premium $1
    const res = await request("/me/ai-usage");
    expect(JSON.stringify(await res.json())).not.toContain("0.1"); // no dollars
  });
});
