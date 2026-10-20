import { z } from "zod";

const optionalKey = z
  .string()
  .optional()
  .transform((v) => (v ? v : undefined));

/** Bindings come from wrangler vars/secrets (`.dev.vars` locally). */
export const envSchema = z.object({
  APP_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1),
  /** Real auth is deferred (DESIGN.md §8.5); "dev" trusts the x-dev-user header. */
  AUTH_MODE: z.enum(["dev"]).default("dev"),
  CORS_ORIGINS: z.string().default("http://localhost:5173"),
  /** "provider:modelId", e.g. "anthropic:claude-haiku-5-5". */
  LLM_FAST_MODEL: optionalKey,
  LLM_SMART_MODEL: optionalKey,
  ANTHROPIC_API_KEY: optionalKey,
  OPENAI_API_KEY: optionalKey,
  GOOGLE_GENERATIVE_AI_API_KEY: optionalKey,
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(bindings: unknown): Env {
  const env = envSchema.parse(bindings);
  if (env.APP_ENV === "production" && env.AUTH_MODE === "dev") {
    throw new Error("AUTH_MODE=dev is not allowed in production");
  }
  return env;
}
