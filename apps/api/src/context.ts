import type { Database } from "./db/client";
import type { Env } from "./env";
import type { LlmClient } from "./llm/client";

export interface Deps {
  db: Database;
  llm: LlmClient;
  /** Releases per-request resources (e.g. the Neon pool) after the response. */
  dispose?: () => Promise<void>;
}

/** Hono generics shared by every route module. */
export interface AppEnv {
  Bindings: Record<string, unknown>;
  Variables: Omit<Deps, "dispose"> & { env: Env; userId: string };
}
