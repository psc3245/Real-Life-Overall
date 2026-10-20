import type { Database } from "./db/client";
import type { Env } from "./env";
import type { LlmClient } from "./llm/client";

export interface Deps {
  db: Database;
  llm: LlmClient;
}

/** Hono generics shared by every route module. */
export interface AppEnv {
  Bindings: Record<string, unknown>;
  Variables: Deps & { env: Env; userId: string };
}
