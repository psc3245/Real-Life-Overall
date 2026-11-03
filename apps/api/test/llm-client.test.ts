import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { llmCalls, users } from "../src/db/schema";
import {
  dbBudgetGuard,
  dbCallRecorder,
  LlmBudgetError,
  LlmClient,
  LlmError,
} from "../src/llm/client";
import { estimateCostUsd } from "../src/llm/models";
import { parseModelSpec } from "../src/llm/providers";
import { createTestApp, createTestDb, jsonResult, mockResolver } from "./helpers";

const schema = z.object({ answer: z.number() });
const request = {
  purpose: "onboarding.weights" as const,
  userId: null,
  schema,
  system: "test",
  prompt: "test",
  promptVersion: "test-v1",
};

describe("LlmClient", () => {
  it("returns parsed structured output and logs the call", async () => {
    const db = await createTestDb();
    const { resolver } = mockResolver(jsonResult({ answer: 42 }));
    const llm = new LlmClient(resolver, dbCallRecorder(db));

    await expect(llm.generateStructured(request)).resolves.toEqual({ answer: 42 });
    const [call] = await db.select().from(llmCalls);
    expect(call).toMatchObject({
      purpose: "onboarding.weights",
      provider: "mock",
      model: "mock-model",
      promptVersion: "test-v1",
      inputTokens: 100,
      outputTokens: 20,
      error: null,
    });
  });

  it("retries invalid output, then succeeds", async () => {
    const db = await createTestDb();
    const { resolver, model } = mockResolver([
      jsonResult({ answer: "not a number" }),
      jsonResult({ answer: 7 }),
    ]);
    const llm = new LlmClient(resolver, dbCallRecorder(db));

    await expect(llm.generateStructured(request)).resolves.toEqual({ answer: 7 });
    expect(model.doGenerateCalls).toHaveLength(2);
    const calls = await db.select().from(llmCalls);
    expect(calls.filter((c) => c.error)).toHaveLength(1);
  });

  it("gives up after three bad attempts", async () => {
    const db = await createTestDb();
    const bad = jsonResult({ nope: true });
    const { resolver } = mockResolver([bad, bad, bad]);
    const llm = new LlmClient(resolver, dbCallRecorder(db));

    await expect(llm.generateStructured(request)).rejects.toBeInstanceOf(LlmError);
    expect(await db.select().from(llmCalls)).toHaveLength(3);
  });
});

describe("model config", () => {
  it("parses provider:model specs", () => {
    expect(parseModelSpec("anthropic:claude-haiku-5-5")).toEqual({
      provider: "anthropic",
      modelId: "claude-haiku-5-5",
    });
    expect(() => parseModelSpec("claude-haiku-5-5")).toThrow();
  });

  it("estimates cost for known models only", () => {
    expect(estimateCostUsd("anthropic:claude-haiku-5-5", 1_000_000, 1_000_000)).toBeCloseTo(0.6);
    expect(estimateCostUsd("mystery:model", 10, 10)).toBeNull();
  });
});

describe("daily budget", () => {
  const call = (userId: string, costUsd: number, createdAt = new Date()) => ({
    userId,
    purpose: "coach.chat",
    provider: "mock",
    model: "mock-model",
    promptVersion: "test-v1",
    costUsd,
    latencyMs: 1,
    createdAt,
  });

  it("refuses a user's call over budget without reaching the model", async () => {
    const db = await createTestDb();
    const { resolver, model } = mockResolver(jsonResult({ answer: 1 }));
    const llm = new LlmClient(resolver, dbCallRecorder(db), undefined, async () => false);

    await expect(llm.generateStructured({ ...request, userId: "u1" })).rejects.toBeInstanceOf(
      LlmBudgetError,
    );
    expect(model.doGenerateCalls).toHaveLength(0);
    // Calls with no user (e.g. setup helpers) aren't capped.
    await expect(llm.generateStructured(request)).resolves.toEqual({ answer: 1 });
  });

  it("counts only the last 24 hours of the user's own spend", async () => {
    const { request: get, db } = await createTestApp();
    await get("/me", { user: "spender" });
    await get("/me", { user: "other" });
    const idOf = async (username: string) =>
      (await db.select().from(users).where(eq(users.username, username)))[0]!.id;
    const spender = await idOf("spender");
    const other = await idOf("other");
    const guard = dbBudgetGuard(db, 1);
    const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
    await db.insert(llmCalls).values([call(spender, 0.6), call(spender, 5, twoDaysAgo)]);
    await db.insert(llmCalls).values(call(other, 5));
    expect(await guard(spender)).toBe(true);

    await db.insert(llmCalls).values(call(spender, 0.4));
    expect(await guard(spender)).toBe(false);
  });
});
