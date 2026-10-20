import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";
import type { Env } from "../env";
import { DEFAULT_MODELS, PURPOSE_TIERS, type LlmPurpose } from "./models";

export interface ResolvedModel {
  /** "provider:modelId", the key used for pricing and logging. */
  spec: string;
  provider: string;
  modelId: string;
  model: LanguageModel;
}

export type ModelResolver = (purpose: LlmPurpose) => ResolvedModel;

export function parseModelSpec(spec: string): { provider: string; modelId: string } {
  const separator = spec.indexOf(":");
  if (separator <= 0 || separator === spec.length - 1) {
    throw new Error(`Invalid model spec "${spec}", expected "provider:modelId"`);
  }
  return { provider: spec.slice(0, separator), modelId: spec.slice(separator + 1) };
}

function requireKey(key: string | undefined, name: string): string {
  if (!key) throw new Error(`${name} is not set`);
  return key;
}

export function createEnvModelResolver(env: Env): ModelResolver {
  const specs = {
    fast: env.LLM_FAST_MODEL ?? DEFAULT_MODELS.fast,
    smart: env.LLM_SMART_MODEL ?? DEFAULT_MODELS.smart,
  };

  return (purpose) => {
    const spec = specs[PURPOSE_TIERS[purpose]];
    const { provider, modelId } = parseModelSpec(spec);
    let model: LanguageModel;
    switch (provider) {
      case "anthropic":
        model = createAnthropic({
          apiKey: requireKey(env.ANTHROPIC_API_KEY, "ANTHROPIC_API_KEY"),
          ...(env.ANTHROPIC_WORKSPACE_ID
            ? { headers: { "anthropic-workspace-id": env.ANTHROPIC_WORKSPACE_ID } }
            : {}),
        })(modelId);
        break;
      case "openai":
        model = createOpenAI({ apiKey: requireKey(env.OPENAI_API_KEY, "OPENAI_API_KEY") })(modelId);
        break;
      case "google":
        model = createGoogleGenerativeAI({
          apiKey: requireKey(env.GOOGLE_GENERATIVE_AI_API_KEY, "GOOGLE_GENERATIVE_AI_API_KEY"),
        })(modelId);
        break;
      default:
        throw new Error(`Unsupported LLM provider "${provider}"`);
    }
    return { spec, provider, modelId, model };
  };
}
