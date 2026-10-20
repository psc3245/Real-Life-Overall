import { Hono } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { ZodError } from "zod";
import type { AppEnv, Deps } from "./context";
import { parseEnv, type Env } from "./env";
import { requireUser } from "./middleware/auth";
import { meRoutes } from "./routes/me";

export type DepsFactory = (env: Env) => Deps;

export function createApp(makeDeps: DepsFactory) {
  const app = new Hono<AppEnv>();

  app.use("*", async (c, next) => {
    const env = parseEnv(c.env ?? {});
    c.set("env", env);
    const deps = makeDeps(env);
    c.set("db", deps.db);
    c.set("llm", deps.llm);
    await next();
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
    if (err instanceof ZodError) {
      return c.json({ error: "Validation failed", issues: err.issues }, 400);
    }
    console.error(err);
    return c.json({ error: "Internal server error" }, 500);
  });

  app.notFound((c) => c.json({ error: "Not found" }, 404));

  const routes = app
    .get("/health", (c) => c.json({ ok: true }))
    .use("/me/*", requireUser)
    .use("/me", requireUser)
    .route("/me", meRoutes);

  return routes;
}

export type AppType = ReturnType<typeof createApp>;
