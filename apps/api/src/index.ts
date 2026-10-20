import { createApp } from "./app";
import { createNeonDb } from "./db/client";
import { dbCallRecorder, LlmClient } from "./llm/client";
import { createEnvModelResolver } from "./llm/providers";

const app = createApp((env) => {
  const { db, dispose } = createNeonDb(env.DATABASE_URL);
  return { db, dispose, llm: new LlmClient(createEnvModelResolver(env), dbCallRecorder(db)) };
});

export default app;
