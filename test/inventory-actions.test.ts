import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { createAuth } from "../src/lib/auth";
import {
  addInventoryItem,
  editInventoryItem,
  getTenantBootstrap,
  handleInventoryAddRequest,
  handleInventoryEditRequest,
} from "../src/lib/tenant-data";
import { seedData, tenants, type KebayaItem } from "../src/data/mock";
import { seedDemo, DEMO_TENANT_ID, type DemoSource } from "../src/lib/seed-demo";

const TEST_SECRET = "test-only-secret-do-not-use-in-prod";
const OTHER_TENANT = "other";

const demoSource: DemoSource = {
  tenant: tenants.find((t) => t.id === "melati")!,
  dataset: seedData.melati,
};

function auth() {
  return createAuth(env.DB, { secret: TEST_SECRET, baseURL: "http://localhost:3000" });
}

async function seedOtherTenant() {
  await env.DB.prepare(
    `INSERT INTO tenants (id, name, subdomain, location, whatsapp, booking_deposit_policy)
     VALUES (?, 'Other Shop', 'other.rentie.id', 'Bandung', '+62 811-0000-0000', 'non_refundable')`,
  )
    .bind(OTHER_TENANT)
    .run();
}

function newItem(overrides: Partial<Omit<KebayaItem, "tenantId" | "dateAdded">> = {}) {
  return {
    name: "Test Kebaya",
    inventoryCode: "TST-001",
    sizeLabel: "M-L",
    model: "Kebaya Modern",
    color: "Pearl",
    wearStyle: "hijab",
    includes: ["Kebaya", "Rok"],
    occasions: ["Wisuda"],
    rentCondition: "both",
    size: { bust: 88, waist: 72, length: 120, sleeve: 56 },
    rentalPrice: 350000,
    cost: 1500000,
    description: "A test item",
    status: "available",
    conditionGrade: "A",
    qrCode: "QR-TST-001",
    photos: ["photo://test"],
    timesRented: 0,
    ...overrides,
  };
}

function appSession(tenantId: string, role: "owner" | "cashier" | "fitting" = "owner") {
  return {
    userId: `${tenantId}-owner`,
    email: `${tenantId}@tenant.test`,
    name: `${tenantId} Owner`,
    tenantId,
    role,
  };
}

describe("inventory write actions", () => {
  beforeEach(async () => {
    await seedDemo(env.DB, auth(), demoSource);
    await seedOtherTenant();
  });

  it("adds inventory with a server-generated item id and returns the persisted row", async () => {
    const item = await addInventoryItem(env.DB, DEMO_TENANT_ID, newItem({ id: "CLIENT-ID" } as Partial<KebayaItem>));

    expect(item.id).toMatch(/^I-[A-Z0-9]{6}$/);
    expect(item.id).not.toBe("CLIENT-ID");
    expect(item.tenantId).toBe(DEMO_TENANT_ID);
    expect(item.name).toBe("Test Kebaya");

    const boot = await getTenantBootstrap(env.DB, DEMO_TENANT_ID);
    expect(boot.dataset.inventory.find((row) => row.id === item.id)).toMatchObject({
      id: item.id,
      tenantId: DEMO_TENANT_ID,
      inventoryCode: "TST-001",
      size: { bust: 88, waist: 72, length: 120, sleeve: 56 },
    });
  });

  it("scopes added inventory to the tenant argument, not client-supplied tenant data", async () => {
    const item = await addInventoryItem(
      env.DB,
      OTHER_TENANT,
      newItem({ inventoryCode: "OTH-ADD", tenantId: DEMO_TENANT_ID } as Partial<KebayaItem>),
    );

    expect(item.tenantId).toBe(OTHER_TENANT);

    const demo = await getTenantBootstrap(env.DB, DEMO_TENANT_ID);
    const other = await getTenantBootstrap(env.DB, OTHER_TENANT);
    expect(demo.dataset.inventory.some((row) => row.id === item.id)).toBe(false);
    expect(other.dataset.inventory.find((row) => row.id === item.id)?.inventoryCode).toBe("OTH-ADD");
  });

  it("edits an existing item and persists the authoritative row", async () => {
    const existing = demoSource.dataset.inventory[0];
    const edited = await editInventoryItem(env.DB, DEMO_TENANT_ID, {
      ...existing,
      name: "Edited Kebaya",
      rentalPrice: 475000,
      size: { ...existing.size, waist: 70 },
    });

    expect(edited.id).toBe(existing.id);
    expect(edited.name).toBe("Edited Kebaya");
    expect(edited.rentalPrice).toBe(475000);
    expect(edited.size.waist).toBe(70);

    const boot = await getTenantBootstrap(env.DB, DEMO_TENANT_ID);
    expect(boot.dataset.inventory.find((row) => row.id === existing.id)).toMatchObject({
      name: "Edited Kebaya",
      rentalPrice: 475000,
      size: { waist: 70 },
    });
  });

  it("does not let one tenant edit another tenant's item", async () => {
    const existing = demoSource.dataset.inventory[0];

    await expect(
      editInventoryItem(env.DB, OTHER_TENANT, { ...existing, name: "Cross Tenant Edit" }),
    ).rejects.toThrow("Inventory item not found.");

    const boot = await getTenantBootstrap(env.DB, DEMO_TENANT_ID);
    expect(boot.dataset.inventory.find((row) => row.id === existing.id)?.name).toBe(existing.name);
  });

  it("rejects route add attempts that name a different tenant", async () => {
    const res = await handleInventoryAddRequest(
      new Request("http://localhost/api/inventory/add", {
        method: "POST",
        body: JSON.stringify(newItem({ inventoryCode: "BAD-TENANT", tenantId: DEMO_TENANT_ID } as Partial<KebayaItem>)),
      }),
      appSession(OTHER_TENANT),
      env.DB,
    );

    expect(res.status).toBe(403);
    const demo = await getTenantBootstrap(env.DB, DEMO_TENANT_ID);
    const other = await getTenantBootstrap(env.DB, OTHER_TENANT);
    expect(demo.dataset.inventory.some((row) => row.inventoryCode === "BAD-TENANT")).toBe(false);
    expect(other.dataset.inventory.some((row) => row.inventoryCode === "BAD-TENANT")).toBe(false);
  });

  it("adds inventory through the route handler for the session tenant", async () => {
    const res = await handleInventoryAddRequest(
      new Request("http://localhost/api/inventory/add", {
        method: "POST",
        body: JSON.stringify(newItem({ inventoryCode: "RPC-ADD" })),
      }),
      appSession(DEMO_TENANT_ID),
      env.DB,
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { item: KebayaItem };
    expect(body.item.id).toMatch(/^I-[A-Z0-9]{6}$/);
    expect(body.item.tenantId).toBe(DEMO_TENANT_ID);

    const boot = await getTenantBootstrap(env.DB, DEMO_TENANT_ID);
    expect(boot.dataset.inventory.find((row) => row.id === body.item.id)?.inventoryCode).toBe("RPC-ADD");
  });

  it("edits inventory through the route handler for the session tenant", async () => {
    const existing = (await getTenantBootstrap(env.DB, DEMO_TENANT_ID)).dataset.inventory[0];
    const res = await handleInventoryEditRequest(
      new Request("http://localhost/api/inventory/edit", {
        method: "POST",
        body: JSON.stringify({ ...existing, name: "RPC Edited", rentalPrice: 525000 }),
      }),
      appSession(DEMO_TENANT_ID),
      env.DB,
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { item: KebayaItem };
    expect(body.item).toMatchObject({ id: existing.id, name: "RPC Edited", rentalPrice: 525000 });

    const boot = await getTenantBootstrap(env.DB, DEMO_TENANT_ID);
    expect(boot.dataset.inventory.find((row) => row.id === existing.id)).toMatchObject({
      name: "RPC Edited",
      rentalPrice: 525000,
    });
  });

  it("rejects route edit attempts against another tenant's item", async () => {
    const existing = demoSource.dataset.inventory[0];
    const res = await handleInventoryEditRequest(
      new Request("http://localhost/api/inventory/edit", {
        method: "POST",
        body: JSON.stringify({ ...existing, name: "Bad Edit" }),
      }),
      appSession(OTHER_TENANT),
      env.DB,
    );

    expect(res.status).toBe(403);
    const boot = await getTenantBootstrap(env.DB, DEMO_TENANT_ID);
    expect(boot.dataset.inventory.find((row) => row.id === existing.id)?.name).toBe(existing.name);
  });

  it("rejects non-owner route inventory writes", async () => {
    const res = await handleInventoryAddRequest(
      new Request("http://localhost/api/inventory/add", {
        method: "POST",
        body: JSON.stringify(newItem({ inventoryCode: "CASHIER-ADD" })),
      }),
      appSession(DEMO_TENANT_ID, "cashier"),
      env.DB,
    );

    expect(res.status).toBe(403);
    const boot = await getTenantBootstrap(env.DB, DEMO_TENANT_ID);
    expect(boot.dataset.inventory.some((row) => row.inventoryCode === "CASHIER-ADD")).toBe(false);
  });
});
