import { PGlite } from "@electric-sql/pglite";
import { MockLanguageModelV4 } from "ai/test";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { resolve } from "node:path";
import { createApp } from "../src/app";
import { DB_CASING, schema, type Database } from "../src/db/client";
import { dbCallRecorder, dbVoiceResolver, LlmClient } from "../src/llm/client";
import type { ModelResolver } from "../src/llm/providers";

const migrationsFolder = resolve(import.meta.dirname, "../drizzle");

/** A fresh in-memory Postgres with all migrations applied. */
export async function createTestDb(): Promise<Database> {
  const db = drizzle(new PGlite(), { schema, casing: DB_CASING });
  await migrate(db, { migrationsFolder });
  return db as unknown as Database;
}

type MockGenerate = ConstructorParameters<typeof MockLanguageModelV4>[0] extends infer O
  ? O extends { doGenerate?: infer G }
    ? G
    : never
  : never;

/** A mock model result whose text is the JSON of `value`. */
export function jsonResult(value: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(value) }],
    finishReason: { unified: "stop" as const, raw: "stop" },
    usage: {
      inputTokens: { total: 100, noCache: 100, cacheRead: 0, cacheWrite: 0 },
      outputTokens: { total: 20, text: 20, reasoning: 0 },
    },
    warnings: [],
  };
}

export function mockResolver(doGenerate: MockGenerate): {
  resolver: ModelResolver;
  model: MockLanguageModelV4;
} {
  const model = new MockLanguageModelV4({ provider: "mock", modelId: "mock-model", doGenerate });
  return {
    model,
    resolver: () => ({ spec: "mock:mock-model", provider: "mock", modelId: "mock-model", model }),
  };
}

export const testBindings = {
  APP_ENV: "test",
  DATABASE_URL: "pglite://memory",
  AUTH_MODE: "dev",
  CORS_ORIGINS: "http://localhost:5173",
};

export async function createTestApp(options: { doGenerate?: MockGenerate } = {}) {
  const db = await createTestDb();
  const { resolver, model } = mockResolver(options.doGenerate ?? []);
  const llm = new LlmClient(resolver, dbCallRecorder(db), dbVoiceResolver(db));
  const app = createApp(() => ({ db, llm }));
  const request = (path: string, init: RequestInit & { user?: string } = {}) => {
    const headers = new Headers(init.headers);
    headers.set("x-dev-user", init.user ?? "tester");
    if (init.body) headers.set("content-type", "application/json");
    return app.request(`/api${path}`, { ...init, headers }, testBindings);
  };
  return { app, db, llm, model, request };
}
