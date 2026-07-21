/**
 * Provision the one butik owner (ticket 02).
 *
 * Creates a real better-auth account with email + password and the domain
 * `role: "owner"` plus a `tenant_id`, so the owner can log in. `tenant_id` and
 * `role` are set here server-side — never from client input.
 *
 * Runs against the LOCAL D1 by default via wrangler's `getPlatformProxy()` (the
 * same `.wrangler/state` D1 the dev server uses); pass `--remote` to target the
 * deployed D1. Requires the baseline migration to be applied first.
 *
 * Usage:
 *   node scripts/provision-owner.mts \
 *     --email owner@butik.com --password 'secret123' \
 *     --name 'Bu Rina' --tenant demo --tenant-name 'Kebaya Demo'
 *
 *   # or via env: OWNER_EMAIL, OWNER_PASSWORD, OWNER_NAME, OWNER_TENANT_ID,
 *   #             OWNER_TENANT_NAME, BETTER_AUTH_SECRET
 */
import { getPlatformProxy } from "wrangler";
import { createAuth } from "../src/lib/auth.ts";

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const email = arg("--email") ?? process.env.OWNER_EMAIL;
const password = arg("--password") ?? process.env.OWNER_PASSWORD;
const name = arg("--name") ?? process.env.OWNER_NAME ?? "Owner";
const tenantId = arg("--tenant") ?? process.env.OWNER_TENANT_ID;
const tenantName = arg("--tenant-name") ?? process.env.OWNER_TENANT_NAME ?? tenantId;
const remote = process.argv.includes("--remote");

if (!email || !password || !tenantId) {
  console.error(
    "Missing required args. Need --email, --password and --tenant (or OWNER_EMAIL / OWNER_PASSWORD / OWNER_TENANT_ID).",
  );
  process.exit(1);
}

const { env, dispose } = await getPlatformProxy<{ DB: D1Database }>({
  experimental: { remoteBindings: remote },
});

try {
  const db = env.DB;
  if (!db) throw new Error("D1 binding DB not found — check wrangler.jsonc.");

  // Ensure a workspace row exists for this tenant (idempotent). tenant_id on the
  // user has no FK, but a real tenant row makes the workspace complete.
  await db
    .prepare(
      `INSERT INTO tenants (id, name, subdomain, location, whatsapp, booking_deposit_amount, booking_deposit_policy)
       VALUES (?, ?, ?, '', '', 0, 'non_refundable')
       ON CONFLICT(id) DO NOTHING`,
    )
    .bind(tenantId, tenantName, `${tenantId}.rentie.id`)
    .run();

  const auth = createAuth(db, { secret: process.env.BETTER_AUTH_SECRET });

  // Called with no headers/session → bypasses the admin gate (first-user
  // bootstrap). `data.tenant_id` + `role` are written despite being input:false,
  // because createUser goes through the internal adapter, not the public schema.
  const result = await auth.api.createUser({
    body: {
      email,
      password,
      name,
      role: "owner",
      data: { tenant_id: tenantId },
    },
  });

  console.log(
    `✓ Provisioned owner ${result.user.email} (id=${result.user.id}) for tenant "${tenantId}" on ${remote ? "REMOTE" : "LOCAL"} D1.`,
  );
} catch (err) {
  console.error("✗ Failed to provision owner:", err instanceof Error ? err.message : err);
  process.exitCode = 1;
} finally {
  await dispose();
}
