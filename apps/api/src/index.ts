import { createApp, type DepsFactory } from "./app";
import { createNeonDb } from "./db/client";
import { parseEnv } from "./env";
import { dbCallRecorder, LlmClient } from "./llm/client";
import { createEnvModelResolver } from "./llm/providers";
import { runHourly } from "./services/scheduler";

const makeDeps: DepsFactory = (env) => {
  const { db, dispose } = createNeonDb(env.DATABASE_URL);
  return { db, dispose, llm: new LlmClient(createEnvModelResolver(env), dbCallRecorder(db)) };
};

const app = createApp(makeDeps);

export default {
  fetch: app.fetch,
  /** Cron Triggers (wrangler.jsonc): decay catch-up hourly, auto-recaps at 4am local. */
  async scheduled(controller, bindings, ctx) {
    const deps = makeDeps(parseEnv(bindings));
    ctx.waitUntil(
      runHourly(deps.db, deps.llm, new Date(controller.scheduledTime))
        .then((results) =>
          console.log(`scheduled: ${results.length} users`, JSON.stringify(results)),
        )
        .finally(() => deps.dispose?.()),
    );
  },
} satisfies ExportedHandler<Record<string, unknown>>;
