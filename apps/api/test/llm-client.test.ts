import { describe, expect, it } from "vitest";
import { z } from "zod";
import { llmCalls } from "../src/db/schema";
import { dbCallRecorder, LlmClient, LlmError } from "../src/llm/client";
import { estimateCostUsd } from "../src/llm/models";
import { parseModelSpec } from "../src/llm/providers";
import { createTestDb, jsonResult, mockResolver } from "./helpers";

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
