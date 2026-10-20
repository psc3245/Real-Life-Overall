import { APICallError } from "ai";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { llmCalls } from "../src/db/schema";
import { dbCallRecorder, LlmClient } from "../src/llm/client";
import { createTestDb, mockResolver } from "./helpers";

describe("LlmClient error handling", () => {
  it("does not retry non-retryable API errors", async () => {
    const db = await createTestDb();
    const rejected = new APICallError({
      message: "This API key is not scoped to a workspace",
      url: "https://api.example/v1/messages",
      requestBodyValues: {},
      statusCode: 400,
      isRetryable: false,
    });
    const { resolver, model } = mockResolver(async () => {
      throw rejected;
    });
    const llm = new LlmClient(resolver, dbCallRecorder(db));

    await expect(
      llm.generateStructured({
        purpose: "onboarding.weights",
        userId: null,
        schema: z.object({}),
        system: "s",
        prompt: "p",
        promptVersion: "v",
      }),
    ).rejects.toThrow(/not scoped to a workspace/);
    expect(model.doGenerateCalls).toHaveLength(1);
    expect(await db.select().from(llmCalls)).toHaveLength(1);
  });
});
