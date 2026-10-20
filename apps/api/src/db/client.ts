import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "./schema";

/** Driver-agnostic handle so tests can swap Neon for PGlite. */
export type Database = PgDatabase<PgQueryResultHKT, typeof schema>;

/** Anything that can run queries: the database or a transaction inside it. */
export type Executor = Pick<Database, "select" | "insert" | "update" | "delete">;

export const DB_CASING = "snake_case" as const;

/**
 * Neon over WebSockets, which supports transactions. Workers can't share sockets across
 * requests, so each request gets its own pool and must call `dispose` when it finishes.
 */
export function createNeonDb(databaseUrl: string): { db: Database; dispose: () => Promise<void> } {
  const pool = new Pool({ connectionString: databaseUrl });
  return {
    db: drizzle(pool, { schema, casing: DB_CASING }),
    dispose: () => pool.end(),
  };
}

export { schema };
