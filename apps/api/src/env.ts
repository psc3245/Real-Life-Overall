import { z } from "zod";

const optionalKey = z
  .string()
  .optional()
  .transform((v) => (v ? v : undefined));

/** Bindings come from wrangler vars/secrets (`.dev.vars` locally). */
export const envSchema = z.object({
  APP_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1),
  /** "better-auth": real sign-in. "dev": trusts the x-dev-user header (tests, local only). */
  AUTH_MODE: z.enum(["dev", "better-auth"]).default("better-auth"),
  /** Signs session cookies; required for better-auth. `openssl rand -base64 32`. */
  BETTER_AUTH_SECRET: optionalKey,
  /** The origin users load the app from; auth callbacks and cookies are issued for it. */
  PUBLIC_URL: z.string().url().default("http://localhost:5173"),
  GOOGLE_CLIENT_ID: optionalKey,
  GOOGLE_CLIENT_SECRET: optionalKey,
  PASSWORD_HASH_ITERATIONS: z.coerce.number().int().min(10_000).default(100_000),
  CORS_ORIGINS: z.string().default("http://localhost:5173"),
  /** "provider:modelId", e.g. "anthropic:claude-haiku-5-5". */
  LLM_FAST_MODEL: optionalKey,
  LLM_SMART_MODEL: optionalKey,
  ANTHROPIC_API_KEY: optionalKey,
  /** Required by Anthropic when the API key is not scoped to a single workspace. */
  ANTHROPIC_WORKSPACE_ID: optionalKey,
  OPENAI_API_KEY: optionalKey,
  GOOGLE_GENERATIVE_AI_API_KEY: optionalKey,
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(bindings: unknown): Env {
  const env = envSchema.parse(bindings);
  if (env.APP_ENV === "production" && env.AUTH_MODE === "dev") {
    throw new Error("AUTH_MODE=dev is not allowed in production");
  }
  if (env.AUTH_MODE === "better-auth" && (env.BETTER_AUTH_SECRET?.length ?? 0) < 32) {
    throw new Error("BETTER_AUTH_SECRET (32+ characters) is required for AUTH_MODE=better-auth");
  }
  return env;
}
