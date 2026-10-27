import { Hono, type Context } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { ZodError } from "zod";
import type { AppEnv, Deps } from "./context";
import { parseEnv, type Env } from "./env";
import { LlmError } from "./llm/client";
import { authFor, optionalUser, requireAdmin, requireUser } from "./middleware/auth";
import { adminRoutes } from "./routes/admin";
import { badgeRoutes } from "./routes/badges";
import { bodyRoutes } from "./routes/body";
import { coachRoutes } from "./routes/coach";
import { dayRoutes } from "./routes/days";
import { devRoutes } from "./routes/dev";
import { friendRoutes } from "./routes/friends";
import { goalRoutes } from "./routes/goals";
import { habitRoutes } from "./routes/habits";
import { leaderboardRoutes } from "./routes/leaderboards";
import { meRoutes } from "./routes/me";
import { chartViewRoutes, metricRoutes } from "./routes/metrics";
import { objectiveRoutes } from "./routes/objectives";
import { onboardingRoutes } from "./routes/onboarding";
import { pauseRoutes } from "./routes/pauses";
import { profileRoutes } from "./routes/profiles";
import { reportRoutes } from "./routes/reports";
import { seasonRoutes } from "./routes/seasons";
import { ratingsRoutes } from "./routes/ratings";
import { weeklyRoutes } from "./routes/weekly";
import { scoutingReportRoutes, treeProposalRoutes, weightRoutes } from "./routes/evolution";
import { exerciseRoutes, templateRoutes, workoutRoutes } from "./routes/workouts";

export type DepsFactory = (env: Env) => Deps;

function hasExecutionCtx(c: Context): boolean {
  try {
    return Boolean(c.executionCtx);
  } catch {
    return false; // Hono throws when there is no ExecutionContext (tests, Node).
  }
}

export function createApp(makeDeps: DepsFactory) {
  // Everything lives under /api so the web app and API can share one origin (and cookies).
  const app = new Hono<AppEnv>().basePath("/api");

  app.use("*", async (c, next) => {
    const env = parseEnv(c.env ?? {});
    c.set("env", env);
    const deps = makeDeps(env);
    c.set("db", deps.db);
    c.set("llm", deps.llm);
    if (deps.mailer) c.set("mailer", deps.mailer);
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
      credentials: true,
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
    // Better Auth's own endpoints: sign-up, sign-in, sign-out, session, OAuth callbacks.
    .on(["GET", "POST"], "/auth/*", (c) => authFor(c).handler(c.req.raw))
    // Tells the web app which sign-in options exist.
    .get("/auth-config", (c) => {
      const env = c.get("env");
      return c.json({
        mode: env.AUTH_MODE,
        google: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
      });
    })
    .use("/me", requireUser)
    .use("/me/*", requireUser)
    .use("/onboarding", requireUser)
    .use("/onboarding/*", requireUser)
    .use("/ratings", requireUser)
    .use("/ratings/*", requireUser)
    .use("/habits", requireUser)
    .use("/habits/*", requireUser)
    .use("/days/*", requireUser)
    .use("/objectives", requireUser)
    .use("/objectives/*", requireUser)
    .use("/workouts", requireUser)
    .use("/workouts/*", requireUser)
    .use("/workout-templates", requireUser)
    .use("/workout-templates/*", requireUser)
    .use("/exercises", requireUser)
    .use("/exercises/*", requireUser)
    .use("/metrics", requireUser)
    .use("/metrics/*", requireUser)
    .use("/reports", requireUser)
    .use("/reports/*", requireUser)
    .use("/chart-views", requireUser)
    .use("/chart-views/*", requireUser)
    .use("/body", requireUser)
    .use("/body/*", requireUser)
    .use("/pauses", requireUser)
    .use("/pauses/*", requireUser)
    .use("/dev/*", requireUser)
    .use("/goals/*", requireUser)
    .use("/badges", requireUser)
    .use("/seasons", requireUser)
    .use("/seasons/*", requireUser)
    .use("/weekly", requireUser)
    .use("/weekly/*", requireUser)
    .use("/friends", requireUser)
    .use("/friends/*", requireUser)
    .use("/leaderboards", requireUser)
    .use("/scouting-report", requireUser)
    .use("/coach", requireUser)
    .use("/coach/*", requireUser)
    .use("/weights", requireUser)
    .use("/weights/*", requireUser)
    .use("/tree-proposals", requireUser)
    .use("/tree-proposals/*", requireUser)
    .use("/profiles/*", optionalUser)
    .use("/admin/*", requireUser, requireAdmin)
    .route("/me", meRoutes)
    .route("/onboarding", onboardingRoutes)
    .route("/ratings", ratingsRoutes)
    .route("/habits", habitRoutes)
    .route("/days", dayRoutes)
    .route("/objectives", objectiveRoutes)
    .route("/workouts", workoutRoutes)
    .route("/workout-templates", templateRoutes)
    .route("/exercises", exerciseRoutes)
    .route("/body", bodyRoutes)
    .route("/metrics", metricRoutes)
    .route("/chart-views", chartViewRoutes)
    .route("/reports", reportRoutes)
    .route("/pauses", pauseRoutes)
    .route("/dev", devRoutes)
    .route("/weekly", weeklyRoutes)
    .route("/goals", goalRoutes)
    .route("/badges", badgeRoutes)
    .route("/seasons", seasonRoutes)
    .route("/profiles", profileRoutes)
    .route("/friends", friendRoutes)
    .route("/leaderboards", leaderboardRoutes)
    .route("/scouting-report", scoutingReportRoutes)
    .route("/coach", coachRoutes)
    .route("/weights", weightRoutes)
    .route("/tree-proposals", treeProposalRoutes)
    .route("/admin", adminRoutes);

  return routes;
}

export type AppType = ReturnType<typeof createApp>;
