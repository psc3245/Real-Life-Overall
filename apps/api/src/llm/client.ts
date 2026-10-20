import { generateText, Output, type ModelMessage } from "ai";
import type { z } from "zod";
import type { Database } from "../db/client";
import { llmCalls } from "../db/schema";
import { estimateCostUsd, type LlmPurpose } from "./models";
import type { ModelResolver } from "./providers";

export interface StructuredRequest<T extends z.ZodType> {
  purpose: LlmPurpose;
  userId: string | null;
  schema: T;
  system: string;
  /** A single user prompt, or a full conversation (e.g. the onboarding follow-up chat). */
  prompt: string | ModelMessage[];
  promptVersion: string;
}

export interface LlmCallRecord {
  userId: string | null;
  purpose: LlmPurpose;
  provider: string;
  model: string;
  promptVersion: string;
  inputTokens: number | null;
  outputTokens: number | null;
  costUsd: number | null;
  latencyMs: number;
  error: string | null;
}

export class LlmError extends Error {
  constructor(
    message: string,
    readonly purpose: LlmPurpose,
    options?: { cause?: unknown },
  ) {
    super(message, options);
  }
}

/** Attempts per call: the first try plus retries on failed or invalid output (DESIGN.md §5). */
export const MAX_ATTEMPTS = 3;

export class LlmClient {
  constructor(
    private readonly resolveModel: ModelResolver,
    private readonly recordCall: (record: LlmCallRecord) => Promise<void>,
  ) {}

  async generateStructured<T extends z.ZodType>(req: StructuredRequest<T>): Promise<z.infer<T>> {
    let resolved: ReturnType<ModelResolver>;
    try {
      resolved = this.resolveModel(req.purpose);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new LlmError(`LLM is not configured: ${reason}`, req.purpose, { cause: error });
    }
    const { spec, provider, modelId, model } = resolved;
    let lastError: unknown;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const started = Date.now();
      const base = {
        userId: req.userId,
        purpose: req.purpose,
        provider,
        model: modelId,
        promptVersion: req.promptVersion,
      };
      try {
        const result = await generateText({
          model,
          system: req.system,
          ...(typeof req.prompt === "string" ? { prompt: req.prompt } : { messages: req.prompt }),
          output: Output.object({ schema: req.schema }),
          maxRetries: 1,
        });
        const { inputTokens, outputTokens } = result.usage;
        await this.recordCall({
          ...base,
          inputTokens: inputTokens ?? null,
          outputTokens: outputTokens ?? null,
          costUsd: estimateCostUsd(spec, inputTokens, outputTokens),
          latencyMs: Date.now() - started,
          error: null,
        });
        return result.output as z.infer<T>;
      } catch (error) {
        lastError = error;
        await this.recordCall({
          ...base,
          inputTokens: null,
          outputTokens: null,
          costUsd: null,
          latencyMs: Date.now() - started,
          error: error instanceof Error ? error.message.slice(0, 1000) : String(error),
        });
      }
    }

    throw new LlmError(
      `LLM call "${req.purpose}" failed after ${MAX_ATTEMPTS} attempts`,
      req.purpose,
      {
        cause: lastError,
      },
    );
  }
}

export function dbCallRecorder(db: Database) {
  return async (record: LlmCallRecord) => {
    try {
      await db.insert(llmCalls).values(record);
    } catch (error) {
      // Cost logging must never break the user-facing request.
      console.error("Failed to record LLM call", error);
    }
  };
}
