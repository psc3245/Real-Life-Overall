import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import type { Database } from "../db/client";
import { authAccounts, authSessions, authUsers, authVerifications } from "../db/schema";
import type { Env } from "../env";
import { passwordHasher } from "./password";

export const MIN_PASSWORD_LENGTH = 8;

/** Better Auth instance for one request (Workers bindings and DB pool are per request). */
export function createAuth(env: Env, db: Database) {
  const google =
    env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
      ? { google: { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET } }
      : {};
  return betterAuth({
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: {
        user: authUsers,
        session: authSessions,
        account: authAccounts,
        verification: authVerifications,
      },
    }),
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.PUBLIC_URL,
    basePath: "/api/auth",
    trustedOrigins: [env.PUBLIC_URL, ...env.CORS_ORIGINS.split(",").map((o) => o.trim())],
    emailAndPassword: {
      enabled: true,
      minPasswordLength: MIN_PASSWORD_LENGTH,
      autoSignIn: true,
      password: passwordHasher(env.PASSWORD_HASH_ITERATIONS),
    },
    socialProviders: google,
  });
}

export type Auth = ReturnType<typeof createAuth>;
