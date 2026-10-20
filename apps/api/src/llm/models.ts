/** Every LLM call is tagged with a purpose; config maps purposes to a model tier. */
export const LLM_PURPOSES = [
  "onboarding.suggestAttributes",
  "onboarding.weights",
  "onboarding.questionnaire",
  "onboarding.followup",
  "onboarding.initialRatings",
] as const;
export type LlmPurpose = (typeof LLM_PURPOSES)[number];

export type ModelTier = "fast" | "smart";

export const PURPOSE_TIERS: Record<LlmPurpose, ModelTier> = {
  "onboarding.suggestAttributes": "fast",
  "onboarding.weights": "fast",
  "onboarding.questionnaire": "fast",
  "onboarding.followup": "fast",
  "onboarding.initialRatings": "smart",
};

/** "provider:modelId". Override per tier with LLM_FAST_MODEL / LLM_SMART_MODEL. */
export const DEFAULT_MODELS: Record<ModelTier, string> = {
  fast: "anthropic:claude-haiku-5-5",
  smart: "anthropic:claude-sonnet-5-5",
};

/** USD per 1M tokens, used for cost logging. Unknown models log a null cost. */
export const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  "anthropic:claude-haiku-5-5": { input: 0.1, output: 0.5 },
  "anthropic:claude-sonnet-5-5": { input: 2, output: 10 },
  "anthropic:claude-opus-5-5": { input: 4, output: 20 },
};

export function estimateCostUsd(
  modelSpec: string,
  inputTokens: number | undefined,
  outputTokens: number | undefined,
): number | null {
  const price = MODEL_PRICING[modelSpec];
  if (!price || inputTokens === undefined || outputTokens === undefined) return null;
  return (inputTokens * price.input + outputTokens * price.output) / 1_000_000;
}
