import { createApp, type DepsFactory } from "./app";
import { createNeonDb } from "./db/client";
import { parseEnv, type Env } from "./env";
import { dbBudgetGuard, dbCallRecorder, dbVoiceResolver, LlmClient } from "./llm/client";
import { createEnvModelResolver } from "./llm/providers";
import { runHourly } from "./services/scheduler";

/** Requests are held to each user's daily LLM budget; the hourly job (recaps, reviews) isn't. */
const makeDeps = (env: Env, { capped }: { capped: boolean }) => {
  const { db, dispose } = createNeonDb(env.DATABASE_URL);
  return {
    db,
    dispose,
    llm: new LlmClient(
      createEnvModelResolver(env),
      dbCallRecorder(db),
      dbVoiceResolver(db),
      capped ? dbBudgetGuard(db, env.LLM_USER_DAILY_BUDGET_USD) : undefined,
    ),
  };
};

const app = createApp(((env) => makeDeps(env, { capped: true })) satisfies DepsFactory);

export default {
  fetch: app.fetch,
  /** Cron Triggers (wrangler.jsonc): decay catch-up hourly, auto-recaps at 4am local. */
  async scheduled(controller, bindings, ctx) {
    const deps = makeDeps(parseEnv(bindings), { capped: false });
    ctx.waitUntil(
      runHourly(deps.db, deps.llm, new Date(controller.scheduledTime))
        .then((results) =>
          console.log(`scheduled: ${results.length} users`, JSON.stringify(results)),
        )
        .finally(() => deps.dispose?.()),
    );
  },
} satisfies ExportedHandler<Record<string, unknown>>;
