import path from "node:path";
import {
  cloudflareTest,
  readD1Migrations,
} from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

/**
 * Integration test harness — runs the suite inside the real Workers runtime
 * (workerd via Miniflare) against a real local D1, per the testing decisions in
 * the Phase 0/1 spec.
 *
 * The migration baseline is read at config time and handed to the worker as a
 * binding; `test/setup.ts` resets D1 and re-applies that baseline before every
 * test (the pool no longer isolates storage per test on its own), so each test
 * is seedable and reset between tests.
 */
export default defineConfig({
  plugins: [
    cloudflareTest(async () => {
      const migrations = await readD1Migrations(
        path.resolve("migrations"),
      );

      return {
        miniflare: {
          compatibilityDate: "2026-07-20",
          compatibilityFlags: ["nodejs_compat"],
          d1Databases: ["DB"],
          // Handed to the setup file via the test `env` so it can apply the
          // baseline to the local D1 before each test file runs.
          bindings: {
            TEST_MIGRATIONS: migrations,
          },
        },
      };
    }),
  ],
  test: {
    setupFiles: ["./test/setup.ts"],
  },
});
