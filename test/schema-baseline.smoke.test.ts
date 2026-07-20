import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";

/**
 * Smoke test: proves the harness + schema baseline are wired together — a real
 * local D1, migrated to the clean baseline, that we can write to and read back.
 */
describe("schema baseline smoke", () => {
  it("inserts a tenant and reads it back (with plan defaults applied)", async () => {
    await env.DB.prepare(
      `INSERT INTO tenants (id, name, subdomain, location, whatsapp, booking_deposit_amount, booking_deposit_policy)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        "demo",
        "Kebaya Demo",
        "demo.rentie.id",
        "Kemang, Jakarta Selatan",
        "+62 812-0000-1234",
        150000,
        "non_refundable",
      )
      .run();

    const row = await env.DB.prepare(
      `SELECT id, name, subdomain, plan, billing_status, status, onboarding_status
       FROM tenants WHERE id = ?`,
    )
      .bind("demo")
      .first();

    expect(row).toMatchObject({
      id: "demo",
      name: "Kebaya Demo",
      subdomain: "demo.rentie.id",
      // Column defaults from the baseline (folded from the old plans migration).
      plan: "free",
      billing_status: "active",
      status: "active",
      onboarding_status: "incomplete",
    });
  });

  it("starts each test from a clean, migrated database (writes are rolled back)", async () => {
    // The tenant inserted by the previous test must not leak into this one —
    // this is the "reset between tests" guarantee the harness provides.
    const row = await env.DB.prepare(
      `SELECT COUNT(*) AS count FROM tenants`,
    ).first<{ count: number }>();

    expect(row?.count).toBe(0);
  });

  it("has the single better-auth identity table carrying tenant_id and role", async () => {
    // No standalone `users` table (ADR-0001); identity is the better-auth `user`
    // table with tenant_id + role columns.
    const oldUsers = await env.DB.prepare(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='users'`,
    ).first();
    expect(oldUsers).toBeNull();

    const columns = await env.DB.prepare(
      `PRAGMA table_info('user')`,
    ).all<{ name: string }>();
    const columnNames = columns.results.map((c) => c.name);
    expect(columnNames).toContain("tenant_id");
    expect(columnNames).toContain("role");
  });
});
