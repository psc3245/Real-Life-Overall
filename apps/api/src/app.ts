import { Hono, type Context } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { ZodError } from "zod";
import type { AppEnv, Deps } from "./context";
import { parseEnv, type Env } from "./env";
import { LlmError } from "./llm/client";
import { requireUser } from "./middleware/auth";
import { meRoutes } from "./routes/me";
import { onboardingRoutes } from "./routes/onboarding";

export type DepsFactory = (env: Env) => Deps;

function hasExecutionCtx(c: Context): boolean {
  try {
    return Boolean(c.executionCtx);
  } catch {
    return false; // Hono throws when there is no ExecutionContext (tests, Node).
  }
}

export function createApp(makeDeps: DepsFactory) {
  const app = new Hono<AppEnv>();

  app.use("*", async (c, next) => {
    const env = parseEnv(c.env ?? {});
    c.set("env", env);
    const deps = makeDeps(env);
    c.set("db", deps.db);
    c.set("llm", deps.llm);
    try {
      await next();
    } finally {
      if (deps.dispose) {
        const done = deps.dispose().catch((err) => console.error("dispose failed", err));
        if (hasExecutionCtx(c)) c.executionCtx.waitUntil(done);
        else await done;
      }
    }
  });

  app.use("*", (c, next) =>
    cors({
      origin: c
        .get("env")
        .CORS_ORIGINS.split(",")
        .map((o) => o.trim()),
      allowHeaders: ["Content-Type", "x-dev-user"],
      allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    })(c, next),
  );

  app.onError((err, c) => {
    if (err instanceof HTTPException) return c.json({ error: err.message }, err.status);
    if (err instanceof LlmError) {
      console.error(err, err.cause);
      return c.json({ error: err.message, retryable: true }, 502);
    }
    if (err instanceof ZodError) {
      return c.json({ error: "Validation failed", issues: err.issues }, 400);
    }
    console.error(err);
    return c.json({ error: "Internal server error" }, 500);
  });

  app.notFound((c) => c.json({ error: "Not found" }, 404));

  const routes = app
    .get("/health", (c) => c.json({ ok: true }))
    .use("/me", requireUser)
    .use("/me/*", requireUser)
    .use("/onboarding", requireUser)
    .use("/onboarding/*", requireUser)
    .route("/me", meRoutes)
    .route("/onboarding", onboardingRoutes);

  return routes;
}

export type AppType = ReturnType<typeof createApp>;
