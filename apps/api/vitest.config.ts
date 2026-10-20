import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Each test boots an in-memory Postgres (PGlite) and runs migrations; under parallel
    // load the first test in a file can exceed the 5s default.
    testTimeout: 20_000,
  },
});
