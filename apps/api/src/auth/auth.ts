import { expo } from "@better-auth/expo";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import type { Database } from "../db/client";
import { authAccounts, authSessions, authUsers, authVerifications } from "../db/schema";
import type { Env } from "../env";
import { createMailer, passwordResetEmail, verificationEmail, type Mailer } from "./email";
import { passwordHasher } from "./password";

export const MIN_PASSWORD_LENGTH = 8;
/** The iOS app's URL scheme (apps/mobile/app.json); trusted as an origin for its requests. */
export const MOBILE_ORIGIN = "rlo://";

/** Better Auth instance for one request (Workers bindings and DB pool are per request). */
export function createAuth(env: Env, db: Database, mailer: Mailer = createMailer(env)) {
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
    trustedOrigins: [
      env.PUBLIC_URL,
      MOBILE_ORIGIN,
      ...env.CORS_ORIGINS.split(",").map((o) => o.trim()),
    ],
    emailAndPassword: {
      enabled: true,
      minPasswordLength: MIN_PASSWORD_LENGTH,
      autoSignIn: true,
      // No session until the email is confirmed; signing in unverified re-sends the link.
      requireEmailVerification: true,
      password: passwordHasher(env.PASSWORD_HASH_ITERATIONS),
      sendResetPassword: ({ user, url }) => mailer(passwordResetEmail(user, url)),
      resetPasswordTokenExpiresIn: 60 * 60,
      revokeSessionsOnPasswordReset: true,
    },
    emailVerification: {
      sendVerificationEmail: ({ user, url }) => mailer(verificationEmail(user, url)),
      sendOnSignUp: true,
      sendOnSignIn: true,
      autoSignInAfterVerification: true,
      expiresIn: 24 * 60 * 60,
    },
    socialProviders: google,
    // Lets the mobile app send its origin in a header and keep its session cookie in SecureStore.
    plugins: [expo()],
  });
}

export type Auth = ReturnType<typeof createAuth>;
