import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { createAuth } from "../src/lib/auth";
import { seedDemo, DEMO_OWNER, DEMO_TENANT_ID, type DemoSource } from "../src/lib/seed-demo";
import { seedData, tenants } from "../src/data/mock";

/**
 * Demo-seed tests (ticket 03). Runs the real seed against the migrated local D1
 * and proves it (a) populates one demo tenant, (b) resets deterministically when
 * re-run, and (c) creates an owner that can log in via the ticket-02 auth.
 */

const TEST_SECRET = "test-only-secret-do-not-use-in-prod";

function auth() {
  return createAuth(env.DB, { secret: TEST_SECRET, baseURL: "http://localhost:3000" });
}

const source: DemoSource = {
  tenant: tenants.find((t) => t.id === "melati")!,
  dataset: seedData["melati"],
};

async function countFor(table: string): Promise<number> {
  const row = await env.DB.prepare(`SELECT COUNT(*) AS c FROM ${table} WHERE tenant_id = ?`)
    .bind(DEMO_TENANT_ID)
    .first<{ c: number }>();
  return Number(row?.c ?? 0);
}

describe("demo seed", () => {
  it("populates one demo tenant with the expected domain data", async () => {
    const result = await seedDemo(env.DB, auth(), source);

    expect(result.tenantId).toBe(DEMO_TENANT_ID);
    expect(result.counts.inventory).toBe(source.dataset.inventory.length);
    expect(result.counts.inventory).toBeGreaterThan(0);

    // Only the demo tenant exists; the source id is not leaked into D1.
    const tenantRows = await env.DB.prepare(`SELECT id, name FROM tenants`).all<{ id: string; name: string }>();
    expect(tenantRows.results).toHaveLength(1);
    expect(tenantRows.results[0]).toMatchObject({ id: DEMO_TENANT_ID, name: "Kebaya Demo" });

    // Row counts match the source dataset, scoped to the demo tenant.
    expect(await countFor("inventory_items")).toBe(source.dataset.inventory.length);
    expect(await countFor("customers")).toBe(source.dataset.customers.length);
    expect(await countFor("bookings")).toBe(source.dataset.bookings.length);
    expect(await countFor("transactions")).toBe(source.dataset.transactions.length);
  });

  it("resets deterministically when re-run (no duplicates, stable counts)", async () => {
    const first = await seedDemo(env.DB, auth(), source);
    const second = await seedDemo(env.DB, auth(), source);

    expect(second.counts).toEqual(first.counts);
    expect(await countFor("inventory_items")).toBe(source.dataset.inventory.length);
    // Exactly one owner account after re-seeding (no accumulation).
    const users = await env.DB.prepare(`SELECT COUNT(*) AS c FROM "user" WHERE email = ?`)
      .bind(DEMO_OWNER.email)
      .first<{ c: number }>();
    expect(Number(users?.c)).toBe(1);
  });

  it("creates a demo owner that can log in with the known credentials", async () => {
    await seedDemo(env.DB, auth(), source);

    const res = await auth().api.signInEmail({
      body: { email: DEMO_OWNER.email, password: DEMO_OWNER.password },
      asResponse: true,
    });
    const cookie = res.headers
      .getSetCookie()
      .map((c) => c.split(";")[0])
      .join("; ");
    expect(cookie).not.toBe("");

    const session = await auth().api.getSession({ headers: new Headers({ cookie }) });
    expect(session).not.toBeNull();
    expect(session!.user.email).toBe(DEMO_OWNER.email);
    expect((session!.user as { tenant_id?: string }).tenant_id).toBe(DEMO_TENANT_ID);
    expect((session!.user as { role?: string }).role).toBe("owner");
  });
});
