import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Each test boots an in-memory Postgres (PGlite) and runs migrations; under parallel
    // load (30+ files, each migrating its own database) a test can exceed 20s.
    testTimeout: 60_000,
  },
});
