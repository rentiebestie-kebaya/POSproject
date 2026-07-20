/// <reference path="../node_modules/@cloudflare/vitest-pool-workers/types/cloudflare-test.d.ts" />

import type { D1Migration } from "@cloudflare/vitest-pool-workers";

// The Workers test pool exposes `env` (from `cloudflare:test`) as `Cloudflare.Env`.
// `DB` already comes from the wrangler-generated cloudflare-env.d.ts; add the
// migrations binding the harness injects for the setup file.
declare global {
  namespace Cloudflare {
    interface Env {
      TEST_MIGRATIONS: D1Migration[];
    }
  }
}
