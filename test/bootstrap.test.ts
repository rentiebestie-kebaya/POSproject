import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { createAuth } from "../src/lib/auth";
import { getSessionScopedBootstrap, getTenantBootstrap } from "../src/lib/tenant-data";
import { seedDemo, DEMO_OWNER, DEMO_TENANT_ID, type DemoSource } from "../src/lib/seed-demo";
import { seedData, tenants } from "../src/data/mock";

/**
 * Bootstrap read + tenant-isolation tests (ticket 04). The demo tenant is seeded
 * via ticket 03's seed; a second tenant is added so we can prove a caller only
 * ever reads its own tenant's data — both at the data-service seam and through
 * the session-scoped route seam.
 */

const TEST_SECRET = "test-only-secret-do-not-use-in-prod";

function auth() {
  return createAuth(env.DB, { secret: TEST_SECRET, baseURL: "http://localhost:3000" });
}

const demoSource: DemoSource = {
  tenant: tenants.find((t) => t.id === "melati")!,
  dataset: seedData["melati"],
};

const OTHER_TENANT = "other";
const OTHER_ITEM = "OTHER-ITEM-1";
const OTHER_OWNER = { email: "other-owner@other.test", password: "password123", name: "Other Owner" };

/** Seeds a minimal second tenant with one distinctive item + its owner account. */
async function seedOtherTenant() {
  await env.DB.batch([
    env.DB
      .prepare(
        `INSERT INTO tenants (id, name, subdomain, location, whatsapp, booking_deposit_policy)
         VALUES (?, 'Other Shop', 'other.rentie.id', 'Bandung', '+62 811-0000-0000', 'non_refundable')`,
      )
      .bind(OTHER_TENANT),
    env.DB
      .prepare(
        `INSERT INTO inventory_items
          (id, tenant_id, name, inventory_code, size_label, model, color, wear_style, rent_condition,
           bust, waist, length, sleeve, status, condition_grade, qr_code, date_added)
         VALUES (?, ?, 'Secret Item', 'OTH-1', 'M', 'Kebaya', 'Red', 'hijab', 'both',
                 80, 60, 90, 50, 'available', 'A', 'QR-OTH-1', '2026-06-01')`,
      )
      .bind(OTHER_ITEM, OTHER_TENANT),
  ]);
  await auth().api.createUser({
    body: {
      email: OTHER_OWNER.email,
      password: OTHER_OWNER.password,
      name: OTHER_OWNER.name,
      role: "owner",
      data: { tenant_id: OTHER_TENANT },
    },
  });
}

async function signInCookie(email: string, password: string): Promise<string> {
  const res = await auth().api.signInEmail({ body: { email, password }, asResponse: true });
  return res.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
}

describe("bootstrap read", () => {
  beforeEach(async () => {
    await seedDemo(env.DB, auth(), demoSource);
    await seedOtherTenant();
  });

  it("returns the tenant's full dataset, reverse-mapped from D1", async () => {
    const boot = await getTenantBootstrap(env.DB, DEMO_TENANT_ID);

    expect(boot.tenant?.id).toBe(DEMO_TENANT_ID);
    expect(boot.tenant?.name).toBe("Kebaya Demo");
    expect(boot.dataset.inventory).toHaveLength(demoSource.dataset.inventory.length);
    expect(boot.dataset.customers).toHaveLength(demoSource.dataset.customers.length);
    expect(boot.dataset.bookings).toHaveLength(demoSource.dataset.bookings.length);
    expect(boot.dataset.transactions).toHaveLength(demoSource.dataset.transactions.length);
    expect(boot.dataset.monthlyRevenue.length).toBeGreaterThan(0);
    expect(boot.team.some((u) => u.role === "owner")).toBe(true);

    // Reverse-mapping fidelity: an item round-trips its structured fields.
    const first = demoSource.dataset.inventory[0];
    const mapped = boot.dataset.inventory.find((i) => i.id === first.id)!;
    expect(mapped).toMatchObject({
      id: first.id,
      tenantId: DEMO_TENANT_ID,
      includes: first.includes,
      size: first.size,
    });
    // Bookings carry their item ids from the join table.
    const bookingWithItems = boot.dataset.bookings.find((b) => b.itemIds.length > 0);
    expect(bookingWithItems).toBeTruthy();
  });

  it("isolates tenants at the data-service seam", async () => {
    const demo = await getTenantBootstrap(env.DB, DEMO_TENANT_ID);
    const other = await getTenantBootstrap(env.DB, OTHER_TENANT);

    // The other tenant's item never appears in the demo bootstrap...
    expect(demo.dataset.inventory.some((i) => i.id === OTHER_ITEM)).toBe(false);
    expect(demo.dataset.inventory.every((i) => i.tenantId === DEMO_TENANT_ID)).toBe(true);
    // ...and the other tenant sees only its own single item.
    expect(other.dataset.inventory).toHaveLength(1);
    expect(other.dataset.inventory[0].id).toBe(OTHER_ITEM);
    expect(other.tenant?.id).toBe(OTHER_TENANT);
  });

  it("scopes the route seam to the caller's session — no cross-tenant reads", async () => {
    const demoCookie = await signInCookie(DEMO_OWNER.email, DEMO_OWNER.password);
    const otherCookie = await signInCookie(OTHER_OWNER.email, OTHER_OWNER.password);

    const asDemo = await getSessionScopedBootstrap(auth(), new Headers({ cookie: demoCookie }), env.DB);
    const asOther = await getSessionScopedBootstrap(auth(), new Headers({ cookie: otherCookie }), env.DB);

    expect(asDemo?.tenant?.id).toBe(DEMO_TENANT_ID);
    // The demo owner's session can never surface the other tenant's data.
    expect(asDemo?.dataset.inventory.some((i) => i.id === OTHER_ITEM)).toBe(false);

    expect(asOther?.tenant?.id).toBe(OTHER_TENANT);
    expect(asOther?.dataset.inventory).toHaveLength(1);
    expect(asOther?.dataset.inventory[0].id).toBe(OTHER_ITEM);
  });

  it("returns null for an unauthenticated request", async () => {
    const result = await getSessionScopedBootstrap(auth(), new Headers(), env.DB);
    expect(result).toBeNull();
  });
});
