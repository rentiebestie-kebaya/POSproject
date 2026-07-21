import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { createAuth } from "../src/lib/auth";
import {
  closePosTransaction,
  getTenantBootstrap,
  handlePosCloseRequest,
  openPosTransaction,
  type PosCloseInput,
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

function appSession(role: User["role"] = "cashier", tenantId = DEMO_TENANT_ID) {
  return {
    userId: `demo-${role}`,
    email: `${role}@tenant.test`,
    name: `${role[0].toUpperCase()}${role.slice(1)} User`,
    tenantId,
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
    customerName: "Return Customer",
    whatsapp: "+62 812-7777-2222",
    startDate: "2026-07-21",
    endDate: "2026-07-23",
    baseRental: 700000,
    extraDayFee: 0,
    rentalTotal: 700000,
    deposit: 200000,
    method: "QRIS",
    notes: "Open rental for return tests",
    ...overrides,
  };
}

function closeInput(overrides: Partial<PosCloseInput> = {}): PosCloseInput {
  return {
    bookingId: "",
    returnDate: "2026-07-26",
    lateFee: 100000,
    damageFee: 50000,
    method: "Cash",
    notes: "Returned with small stain",
    returnDisposition: "available",
    ...overrides,
  };
}

async function openRental(itemCount = 2) {
  const itemIds = await availableItemIds(itemCount);
  return openPosTransaction(env.DB, appSession("cashier"), openInput({ itemIds }));
}

describe("POS close transaction action", () => {
  beforeEach(async () => {
    await seedDemo(env.DB, auth(), demoSource);
  });

  it("closes an active rental with fees, deposit return, amount due, and authoritative receipt rows", async () => {
    const openReceipt = await openRental(2);

    const receipt = await closePosTransaction(
      env.DB,
      appSession("cashier"),
      closeInput({ bookingId: openReceipt.booking.id }),
    );

    expect(receipt.booking).toMatchObject({
      id: openReceipt.booking.id,
      tenantId: DEMO_TENANT_ID,
      status: "returned",
      itemIds: openReceipt.booking.itemIds,
      deposit: 200000,
    });
    expect(receipt.transaction.id).toMatch(/^T-[A-Z0-9]{6}$/);
    expect(receipt.transaction).toMatchObject({
      tenantId: DEMO_TENANT_ID,
      bookingId: openReceipt.booking.id,
      transactionType: "close",
      date: "2026-07-26",
      deposit: 200000,
      lateFee: 100000,
      damageFee: 50000,
      total: 0,
      method: "Cash",
      paymentStatus: "refunded",
      itemIds: openReceipt.booking.itemIds,
      customerName: "Return Customer",
      customerWhatsapp: "+62 812-7777-2222",
      cashierName: "Cashier User",
      rentalTotal: 700000,
      returnNotes: "Returned with small stain",
      depositReturned: 50000,
      amountDue: 0,
    });
    expect(receipt.items.map((item) => item.status)).toEqual(["available", "available"]);

    const boot = await getTenantBootstrap(env.DB, DEMO_TENANT_ID);
    expect(receipt.financeSummary).toEqual(boot.financeSummary);
    expect(boot.dataset.bookings.find((row) => row.id === openReceipt.booking.id)?.status).toBe("returned");
    expect(boot.dataset.transactions.find((row) => row.id === receipt.transaction.id)?.itemIds).toEqual(
      openReceipt.booking.itemIds,
    );
    for (const id of openReceipt.booking.itemIds) {
      expect(boot.dataset.inventory.find((item) => item.id === id)?.status).toBe("available");
    }
  });

  it("sends returned items to maintenance when cleaning is flagged", async () => {
    const openReceipt = await openRental(1);

    const receipt = await closePosTransaction(
      env.DB,
      appSession("cashier"),
      closeInput({ bookingId: openReceipt.booking.id, lateFee: 0, damageFee: 0, returnDisposition: "maintenance" }),
    );

    expect(receipt.transaction.depositReturned).toBe(200000);
    expect(receipt.transaction.amountDue).toBe(0);
    expect(receipt.items).toHaveLength(1);
    expect(receipt.items[0].status).toBe("maintenance");

    const boot = await getTenantBootstrap(env.DB, DEMO_TENANT_ID);
    expect(boot.dataset.inventory.find((item) => item.id === openReceipt.booking.itemIds[0])?.status).toBe(
      "maintenance",
    );
  });

  it("rejects a non-active booking and leaves no partial write", async () => {
    const confirmedBooking = demoSource.dataset.bookings.find((booking) => booking.status === "confirmed")!;
    const before = await getTenantBootstrap(env.DB, DEMO_TENANT_ID);

    await expect(
      closePosTransaction(env.DB, appSession("cashier"), closeInput({ bookingId: confirmedBooking.id })),
    ).rejects.toThrow("Only active rentals can be returned.");

    const after = await getTenantBootstrap(env.DB, DEMO_TENANT_ID);
    expect(after.dataset.bookings).toEqual(before.dataset.bookings);
    expect(after.dataset.transactions).toEqual(before.dataset.transactions);
    expect(after.dataset.inventory).toEqual(before.dataset.inventory);
  });

  it("rolls back if a later batch statement fails after the close transaction insert", async () => {
    const openReceipt = await openRental(1);
    const before = await getTenantBootstrap(env.DB, DEMO_TENANT_ID);
    await env.DB.prepare(`DROP TRIGGER IF EXISTS fail_close_transaction_items`).run();
    await env.DB
      .prepare(
        `CREATE TRIGGER fail_close_transaction_items
         BEFORE INSERT ON transaction_items
         WHEN NEW.transaction_id LIKE 'T-%'
         BEGIN
           SELECT RAISE(ABORT, 'forced close rollback');
         END`,
      )
      .run();

    try {
      await expect(
        closePosTransaction(env.DB, appSession("cashier"), closeInput({ bookingId: openReceipt.booking.id })),
      ).rejects.toThrow("Return could not be recorded.");
    } finally {
      await env.DB.prepare(`DROP TRIGGER IF EXISTS fail_close_transaction_items`).run();
    }

    const after = await getTenantBootstrap(env.DB, DEMO_TENANT_ID);
    expect(after.dataset.bookings.find((row) => row.id === openReceipt.booking.id)?.status).toBe("active");
    expect(after.dataset.transactions).toHaveLength(before.dataset.transactions.length);
    expect(after.dataset.inventory.find((item) => item.id === openReceipt.booking.itemIds[0])?.status).toBe("rented");
  });

  it("rejects cross-tenant close attempts and leaves the rental active", async () => {
    const openReceipt = await openRental(1);
    const before = await getTenantBootstrap(env.DB, DEMO_TENANT_ID);

    await expect(
      closePosTransaction(env.DB, appSession("cashier", "other-tenant"), closeInput({ bookingId: openReceipt.booking.id })),
    ).rejects.toThrow("Only active rentals can be returned.");

    const after = await getTenantBootstrap(env.DB, DEMO_TENANT_ID);
    expect(after.dataset.bookings.find((row) => row.id === openReceipt.booking.id)?.status).toBe("active");
    expect(after.dataset.transactions).toHaveLength(before.dataset.transactions.length);
    expect(after.dataset.inventory.find((item) => item.id === openReceipt.booking.itemIds[0])?.status).toBe("rented");
  });

  it("closes through the route handler for owner and cashier sessions", async () => {
    const openReceipt = await openRental(1);
    const cashierRes = await handlePosCloseRequest(
      new Request("http://localhost/api/pos/close", {
        method: "POST",
        body: JSON.stringify(closeInput({ bookingId: openReceipt.booking.id, returnDisposition: "maintenance" })),
      }),
      appSession("cashier"),
      env.DB,
    );

    expect(cashierRes.status).toBe(200);
    const cashierBody = (await cashierRes.json()) as { receipt: Awaited<ReturnType<typeof closePosTransaction>> };
    expect(cashierBody.receipt.booking.status).toBe("returned");
    expect(cashierBody.receipt.items[0].status).toBe("maintenance");
    expect(cashierBody.receipt.cashierName).toBe("Cashier User");

    const ownerOpenReceipt = await openRental(1);
    const ownerRes = await handlePosCloseRequest(
      new Request("http://localhost/api/pos/close", {
        method: "POST",
        body: JSON.stringify(closeInput({ bookingId: ownerOpenReceipt.booking.id, returnDisposition: "available" })),
      }),
      appSession("owner"),
      env.DB,
    );

    expect(ownerRes.status).toBe(200);
    const ownerBody = (await ownerRes.json()) as { receipt: Awaited<ReturnType<typeof closePosTransaction>> };
    expect(ownerBody.receipt.items[0].status).toBe("available");
    expect(ownerBody.receipt.cashierName).toBe("Owner User");
  });

  it("rejects fitting staff at the route handler", async () => {
    const openReceipt = await openRental(1);
    const res = await handlePosCloseRequest(
      new Request("http://localhost/api/pos/close", {
        method: "POST",
        body: JSON.stringify(closeInput({ bookingId: openReceipt.booking.id })),
      }),
      appSession("fitting"),
      env.DB,
    );

    expect(res.status).toBe(403);
  });
});
