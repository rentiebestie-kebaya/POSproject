import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { createAuth } from "../src/lib/auth";
import {
  getTenantBootstrap,
  handlePosOpenRequest,
  openPosTransaction,
  type PosOpenInput,
} from "../src/lib/tenant-data";
import { seedData, tenants, type User } from "../src/data/mock";
import { seedDemo, DEMO_TENANT_ID, type DemoSource } from "../src/lib/seed-demo";

const TEST_SECRET = "test-only-secret-do-not-use-in-prod";

const demoSource: DemoSource = {
  tenant: tenants.find((t) => t.id === "melati")!,
  dataset: seedData.melati,
};

function auth() {
  return createAuth(env.DB, { secret: TEST_SECRET, baseURL: "http://localhost:3000" });
}

function appSession(role: User["role"] = "cashier") {
  return {
    userId: `demo-${role}`,
    email: `${role}@tenant.test`,
    name: `${role[0].toUpperCase()}${role.slice(1)} User`,
    tenantId: DEMO_TENANT_ID,
    role,
  };
}

async function availableItemIds(count: number) {
  const boot = await getTenantBootstrap(env.DB, DEMO_TENANT_ID);
  return boot.dataset.inventory
    .filter((item) => item.status === "available")
    .slice(0, count)
    .map((item) => item.id);
}

function openInput(overrides: Partial<PosOpenInput> = {}): PosOpenInput {
  return {
    itemIds: [],
    customerName: "Walk In Customer",
    whatsapp: "+62 812-7000-1111",
    instagram: "@walkin",
    email: "walkin@example.test",
    startDate: "2026-07-21",
    endDate: "2026-07-23",
    baseRental: 700000,
    extraDayFee: 0,
    rentalTotal: 700000,
    deposit: 200000,
    method: "QRIS",
    notes: "Pickup after lunch",
    evidence: {
      idPhotoName: "ktp.jpg",
      clientPhotoName: "customer.jpg",
    },
    ...overrides,
  };
}

describe("POS open transaction action", () => {
  beforeEach(async () => {
    await seedDemo(env.DB, auth(), demoSource);
  });

  it("writes a same-day rental atomically and returns an authoritative receipt", async () => {
    const itemIds = await availableItemIds(2);
    const receipt = await openPosTransaction(env.DB, appSession("cashier"), openInput({ itemIds }));

    expect(receipt.transaction.id).toMatch(/^T-[A-Z0-9]{6}$/);
    expect(receipt.booking.id).toMatch(/^B-[A-Z0-9]{6}$/);
    expect(receipt.customer.id).toMatch(/^C-[A-Z0-9]{6}$/);
    expect(receipt.cashierName).toBe("Cashier User");
    expect(receipt.booking).toMatchObject({
      tenantId: DEMO_TENANT_ID,
      itemIds,
      status: "active",
      total: 700000,
      deposit: 200000,
    });
    expect(receipt.transaction).toMatchObject({
      tenantId: DEMO_TENANT_ID,
      bookingId: receipt.booking.id,
      transactionType: "open",
      deposit: 200000,
      lateFee: 0,
      damageFee: 0,
      total: 900000,
      method: "QRIS",
      paymentStatus: "paid",
      itemIds,
      customerName: "Walk In Customer",
      customerWhatsapp: "+62 812-7000-1111",
      cashierName: "Cashier User",
      rentalTotal: 700000,
      baseRental: 700000,
      extraDayFee: 0,
      notes: "Pickup after lunch",
      evidence: { idPhotoName: "ktp.jpg", clientPhotoName: "customer.jpg" },
    });

    const boot = await getTenantBootstrap(env.DB, DEMO_TENANT_ID);
    expect(boot.dataset.bookings.find((row) => row.id === receipt.booking.id)?.itemIds).toEqual(itemIds);
    expect(boot.dataset.transactions.find((row) => row.id === receipt.transaction.id)?.itemIds).toEqual(itemIds);
    for (const id of itemIds) {
      const item = boot.dataset.inventory.find((row) => row.id === id)!;
      const original = demoSource.dataset.inventory.find((row) => row.id === id)!;
      expect(item.status).toBe("rented");
      expect(item.timesRented).toBe(original.timesRented + 1);
    }
  });

  it("updates an existing customer by normalized WhatsApp instead of duplicating", async () => {
    const existing = demoSource.dataset.customers[0];
    const itemIds = await availableItemIds(1);
    const receipt = await openPosTransaction(
      env.DB,
      appSession("cashier"),
      openInput({
        itemIds,
        customerName: "Dewi Updated",
        whatsapp: "0812 3456 7890",
        instagram: "@dewi-updated",
        email: "dewi@example.test",
        startDate: "2026-07-22",
      }),
    );

    expect(receipt.customer.id).toBe(existing.id);
    expect(receipt.customer).toMatchObject({
      name: "Dewi Updated",
      whatsapp: "0812 3456 7890",
      totalRentals: existing.totalRentals + 1,
      lastRental: "2026-07-22",
    });

    const boot = await getTenantBootstrap(env.DB, DEMO_TENANT_ID);
    const matches = boot.dataset.customers.filter((row) => row.id === existing.id || row.whatsapp.includes("3456"));
    expect(matches).toHaveLength(1);
  });

  it("creates a new customer when WhatsApp is unknown", async () => {
    const itemIds = await availableItemIds(1);
    const receipt = await openPosTransaction(
      env.DB,
      appSession("owner"),
      openInput({ itemIds, whatsapp: "+62 899-0000-0001", customerName: "New Walk In" }),
    );

    expect(receipt.customer.id).toMatch(/^C-[A-Z0-9]{6}$/);
    expect(receipt.customer).toMatchObject({
      tenantId: DEMO_TENANT_ID,
      name: "New Walk In",
      whatsapp: "+62 899-0000-0001",
      totalRentals: 1,
      lastRental: "2026-07-21",
    });
  });

  it("rejects unavailable items and leaves no partial write", async () => {
    const rentedItem = demoSource.dataset.inventory.find((item) => item.status === "rented")!;
    const before = await getTenantBootstrap(env.DB, DEMO_TENANT_ID);

    await expect(
      openPosTransaction(
        env.DB,
        appSession("cashier"),
        openInput({ itemIds: [rentedItem.id], whatsapp: "+62 899-9999-9999", customerName: "Should Not Persist" }),
      ),
    ).rejects.toThrow("Only available items can be rented.");

    const after = await getTenantBootstrap(env.DB, DEMO_TENANT_ID);
    expect(after.dataset.customers).toHaveLength(before.dataset.customers.length);
    expect(after.dataset.bookings).toHaveLength(before.dataset.bookings.length);
    expect(after.dataset.transactions).toHaveLength(before.dataset.transactions.length);
    expect(after.dataset.inventory.find((item) => item.id === rentedItem.id)).toMatchObject({
      status: rentedItem.status,
      timesRented: rentedItem.timesRented,
    });
  });

  it("rejects another tenant's available item and leaves no partial write", async () => {
    const ayuItem = seedData.ayu.inventory.find((item) => item.status === "available")!;
    await env.DB.batch([
      env.DB
        .prepare(
          `INSERT OR REPLACE INTO tenants
            (id, name, subdomain, location, whatsapp, booking_deposit_amount, booking_deposit_policy,
             plan, billing_status, status, onboarding_status, limit_overrides_json)
           VALUES (?, ?, ?, ?, ?, 0, 'refundable', 'free', 'active', 'active', 'complete', '{}')`,
        )
        .bind("other-tenant", "Other Tenant", "other.example.test", "Jakarta", "+62 800"),
      env.DB
        .prepare(
          `INSERT OR REPLACE INTO inventory_items
            (id, tenant_id, name, inventory_code, size_label, model, color, wear_style,
             includes_json, occasions_json, rent_condition, bust, waist, length, sleeve,
             rental_price, cost, description, status, condition_grade, qr_code, photos_json,
             date_added, times_rented)
           VALUES (?, 'other-tenant', ?, ?, ?, ?, ?, ?, '[]', '[]', 'in-town',
             ?, ?, ?, ?, ?, ?, ?, 'available', ?, ?, '[]', ?, ?)`,
        )
        .bind(
          ayuItem.id,
          ayuItem.name,
          ayuItem.inventoryCode,
          ayuItem.sizeLabel,
          ayuItem.model,
          ayuItem.color,
          ayuItem.wearStyle,
          ayuItem.size.bust,
          ayuItem.size.waist,
          ayuItem.size.length,
          ayuItem.size.sleeve,
          ayuItem.rentalPrice,
          ayuItem.cost,
          ayuItem.description,
          ayuItem.conditionGrade,
          ayuItem.qrCode,
          ayuItem.dateAdded,
          ayuItem.timesRented,
        ),
    ]);
    const before = await getTenantBootstrap(env.DB, DEMO_TENANT_ID);

    await expect(
      openPosTransaction(
        env.DB,
        appSession("cashier"),
        openInput({ itemIds: [ayuItem.id], whatsapp: "+62 899-8888-8888", customerName: "Wrong Tenant" }),
      ),
    ).rejects.toThrow("Only available items can be rented.");

    const after = await getTenantBootstrap(env.DB, DEMO_TENANT_ID);
    expect(after.dataset.customers).toHaveLength(before.dataset.customers.length);
    expect(after.dataset.bookings).toHaveLength(before.dataset.bookings.length);
    expect(after.dataset.transactions).toHaveLength(before.dataset.transactions.length);
    expect(after.dataset.inventory).toEqual(before.dataset.inventory);
    const otherItem = await env.DB
      .prepare(`SELECT status, times_rented FROM inventory_items WHERE tenant_id = 'other-tenant' AND id = ?`)
      .bind(ayuItem.id)
      .first<{ status: string; times_rented: number }>();
    expect(otherItem).toEqual({ status: "available", times_rented: ayuItem.timesRented });
  });

  it("opens through the route handler for owner and cashier sessions", async () => {
    const itemIds = await availableItemIds(1);
    const res = await handlePosOpenRequest(
      new Request("http://localhost/api/pos/open", {
        method: "POST",
        body: JSON.stringify(openInput({ itemIds, tenantId: "other-tenant" } as Partial<PosOpenInput>)),
      }),
      appSession("cashier"),
      env.DB,
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { receipt: Awaited<ReturnType<typeof openPosTransaction>> };
    expect(body.receipt.booking.tenantId).toBe(DEMO_TENANT_ID);
    expect(body.receipt.cashierName).toBe("Cashier User");
  });

  it("rejects fitting staff at the route handler", async () => {
    const itemIds = await availableItemIds(1);
    const res = await handlePosOpenRequest(
      new Request("http://localhost/api/pos/open", {
        method: "POST",
        body: JSON.stringify(openInput({ itemIds })),
      }),
      appSession("fitting"),
      env.DB,
    );

    expect(res.status).toBe(403);
  });
});
