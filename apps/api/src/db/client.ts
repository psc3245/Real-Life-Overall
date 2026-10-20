import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "./schema";

/** Driver-agnostic handle so tests can swap Neon for PGlite. */
export type Database = PgDatabase<PgQueryResultHKT, typeof schema>;

export const DB_CASING = "snake_case" as const;

export function createNeonDb(databaseUrl: string): Database {
  return drizzle(neon(databaseUrl), { schema, casing: DB_CASING });
}

export { schema };
