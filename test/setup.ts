import { applyD1Migrations, env, reset } from "cloudflare:test";
import { beforeEach } from "vitest";

/**
 * Gives every test a fresh database migrated to the clean baseline.
 *
 * The Workers test pool no longer isolates storage per test automatically, so we
 * do it explicitly: `reset()` wipes all binding storage (including D1), then we
 * re-apply the migration baseline. Each test therefore starts seedable and fully
 * reset from the previous one.
 */
beforeEach(async () => {
  await reset();
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
});
