import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { createAuth } from "../src/lib/auth";
import {
  checkoutReservation,
  getTenantBootstrap,
  handleReservationCheckoutRequest,
  type CheckoutReservationInput,
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

function checkoutInput(overrides: Partial<CheckoutReservationInput> = {}): CheckoutReservationInput {
  return {
    bookingId: "B103",
    method: "Cash",
    notes: "Reservation pickup",
    evidence: {
      idPhotoName: "ktp-reservation.jpg",
      clientPhotoName: "pickup.jpg",
    },
    ...overrides,
  };
}

async function bookingDayCount(bookingId: string): Promise<number> {
  const row = await env.DB.prepare(`SELECT COUNT(*) AS n FROM booking_days WHERE booking_id = ?`)
    .bind(bookingId)
    .first<{ n: number }>();
  return Number(row?.n ?? 0);
}

describe("reservation checkout action", () => {
  beforeEach(async () => {
    await seedDemo(env.DB, auth(), demoSource);
  });

  it("checks out a due confirmed reservation and returns authoritative receipt rows", async () => {
    const sourceBooking = demoSource.dataset.bookings.find((booking) => booking.id === "B103")!;
    const sourceCustomer = demoSource.dataset.customers.find((customer) => customer.id === sourceBooking.customerId)!;
    const sourceItem = demoSource.dataset.inventory.find((item) => item.id === sourceBooking.itemIds[0])!;
    const occupiedDays = await bookingDayCount(sourceBooking.id);

    const receipt = await checkoutReservation(env.DB, appSession("cashier"), checkoutInput());

    expect(receipt.booking).toMatchObject({
      id: sourceBooking.id,
      tenantId: DEMO_TENANT_ID,
      status: "active",
      itemIds: sourceBooking.itemIds,
      total: sourceBooking.total,
      deposit: sourceBooking.deposit,
    });
    expect(receipt.customer).toMatchObject({
      id: sourceCustomer.id,
      totalRentals: sourceCustomer.totalRentals + 1,
      lastRental: sourceBooking.startDate,
    });
    expect(receipt.transaction.id).toMatch(/^T-[A-Z0-9]{6}$/);
    expect(receipt.transaction).toMatchObject({
      tenantId: DEMO_TENANT_ID,
      bookingId: sourceBooking.id,
      transactionType: "open",
      deposit: sourceBooking.deposit,
      lateFee: 0,
      damageFee: 0,
      total: sourceBooking.total + sourceBooking.deposit,
      method: "Cash",
      paymentStatus: "paid",
      itemIds: sourceBooking.itemIds,
      customerName: sourceCustomer.name,
      customerWhatsapp: sourceCustomer.whatsapp,
      cashierName: "Cashier User",
      rentalTotal: sourceBooking.total,
      baseRental: sourceBooking.total,
      extraDayFee: 0,
      notes: "Reservation pickup",
      evidence: { idPhotoName: "ktp-reservation.jpg", clientPhotoName: "pickup.jpg" },
    });
    expect(receipt.items).toHaveLength(1);
    expect(receipt.items[0]).toMatchObject({
      id: sourceItem.id,
      status: "rented",
      timesRented: sourceItem.timesRented + 1,
    });
    expect(await bookingDayCount(sourceBooking.id)).toBe(occupiedDays);

    const boot = await getTenantBootstrap(env.DB, DEMO_TENANT_ID);
    expect(receipt.financeSummary).toEqual(boot.financeSummary);
    expect(boot.dataset.bookings.find((row) => row.id === sourceBooking.id)?.status).toBe("active");
    expect(boot.dataset.transactions.find((row) => row.id === receipt.transaction.id)?.itemIds).toEqual(
      sourceBooking.itemIds,
    );
    expect(boot.dataset.inventory.find((row) => row.id === sourceItem.id)?.status).toBe("rented");
  });

  it("rejects future reservations and leaves them confirmed", async () => {
    const sourceBooking = demoSource.dataset.bookings.find((booking) => booking.id === "B105")!;
    const sourceItem = demoSource.dataset.inventory.find((item) => item.id === sourceBooking.itemIds[0])!;
    const before = await getTenantBootstrap(env.DB, DEMO_TENANT_ID);

    await expect(
      checkoutReservation(env.DB, appSession("cashier"), checkoutInput({ bookingId: sourceBooking.id })),
    ).rejects.toThrow("Only due confirmed reservations can be checked out.");

    const after = await getTenantBootstrap(env.DB, DEMO_TENANT_ID);
    expect(after.dataset.bookings.find((row) => row.id === sourceBooking.id)?.status).toBe("confirmed");
    expect(after.dataset.transactions).toHaveLength(before.dataset.transactions.length);
    expect(after.dataset.inventory.find((row) => row.id === sourceItem.id)?.status).toBe("available");
  });

  it("rejects cross-tenant checkout attempts", async () => {
    const before = await getTenantBootstrap(env.DB, DEMO_TENANT_ID);

    await expect(
      checkoutReservation(env.DB, appSession("cashier", "other-tenant"), checkoutInput({ bookingId: "B103" })),
    ).rejects.toThrow("Only due confirmed reservations can be checked out.");

    const after = await getTenantBootstrap(env.DB, DEMO_TENANT_ID);
    expect(after.dataset.bookings.find((row) => row.id === "B103")?.status).toBe("confirmed");
    expect(after.dataset.transactions).toHaveLength(before.dataset.transactions.length);
  });

  it("checks out through the route handler for owner and cashier sessions, and rejects fitting", async () => {
    const cashierRes = await handleReservationCheckoutRequest(
      new Request("http://localhost/api/bookings/checkout", {
        method: "POST",
        body: JSON.stringify(checkoutInput({ bookingId: "B103" })),
      }),
      appSession("cashier"),
      env.DB,
    );
    expect(cashierRes.status).toBe(200);
    const cashierBody = (await cashierRes.json()) as { receipt: Awaited<ReturnType<typeof checkoutReservation>> };
    expect(cashierBody.receipt.booking.status).toBe("active");
    expect(cashierBody.receipt.cashierName).toBe("Cashier User");

    const ownerRes = await handleReservationCheckoutRequest(
      new Request("http://localhost/api/bookings/checkout", {
        method: "POST",
        body: JSON.stringify(checkoutInput({ bookingId: "B104", method: "QRIS" })),
      }),
      appSession("owner"),
      env.DB,
    );
    expect(ownerRes.status).toBe(200);
    const ownerBody = (await ownerRes.json()) as { receipt: Awaited<ReturnType<typeof checkoutReservation>> };
    expect(ownerBody.receipt.cashierName).toBe("Owner User");

    const fittingRes = await handleReservationCheckoutRequest(
      new Request("http://localhost/api/bookings/checkout", {
        method: "POST",
        body: JSON.stringify(checkoutInput({ bookingId: "B105" })),
      }),
      appSession("fitting"),
      env.DB,
    );
    expect(fittingRes.status).toBe(403);
  });
});
