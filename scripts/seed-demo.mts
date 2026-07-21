/**
 * Seed (and reset) the local demo shop + demo owner login (ticket 03, ADR-0003).
 *
 * Reshapes the "melati" tenant from src/data/mock.ts into one "Kebaya Demo"
 * shop and a real better-auth owner account, in the LOCAL D1 only. Re-running
 * resets it deterministically. This never touches production: `getPlatformProxy`
 * binds the local `.wrangler/state` D1 (no remote flag is offered), so the real
 * design partner's database stays clean.
 *
 * Usage:
 *   npm run db:seed
 *
 * Then log in at /login with:
 *   demo@rentie.id / demo12345
 */
import { getPlatformProxy } from "wrangler";
import { createAuth } from "../src/lib/auth.ts";
import { seedDemo, DEMO_OWNER } from "../src/lib/seed-demo.ts";
import { seedData, tenants } from "../src/data/mock.ts";

const SOURCE_TENANT_ID = "melati";

const source = {
  tenant: tenants.find((t) => t.id === SOURCE_TENANT_ID)!,
  dataset: seedData[SOURCE_TENANT_ID],
};

if (!source.tenant || !source.dataset) {
  console.error(`Source tenant "${SOURCE_TENANT_ID}" not found in mock.ts.`);
  process.exit(1);
}

const { env, dispose } = await getPlatformProxy<{ DB: D1Database }>();

try {
  if (!env.DB) throw new Error("D1 binding DB not found — check wrangler.jsonc.");
  const auth = createAuth(env.DB, { secret: process.env.BETTER_AUTH_SECRET });
  const result = await seedDemo(env.DB, auth, source);

  console.log(
    `✓ Seeded LOCAL demo shop "${result.tenantId}": ` +
      `${result.counts.inventory} items, ${result.counts.customers} customers, ` +
      `${result.counts.bookings} bookings, ${result.counts.bookingRequests} requests, ` +
      `${result.counts.transactions} transactions.`,
  );
  console.log(`✓ Demo owner login: ${DEMO_OWNER.email} / ${DEMO_OWNER.password}`);
} catch (err) {
  console.error("✗ Failed to seed demo:", err instanceof Error ? err.message : err);
  process.exitCode = 1;
} finally {
  await dispose();
}
