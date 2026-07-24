import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { createAuth } from "../src/lib/auth";
import {
  createReservation,
  getTenantBootstrap,
  handleReservationRequest,
  openPosTransaction,
  closePosTransaction,
  type ReservationInput,
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

/** A date `offsetDays` ahead of today — always in the future, whatever the clock. */
function futureDate(offsetDays: number): string {
  return new Date(Date.now() + offsetDays * 86_400_000).toISOString().slice(0, 10);
}

async function availableItemIds(count: number) {
  const boot = await getTenantBootstrap(env.DB, DEMO_TENANT_ID);
  return boot.dataset.inventory
    .filter((item) => item.status === "available")
    .slice(0, count)
    .map((item) => item.id);
}

async function bookingDayCount(bookingId: string): Promise<number> {
  const row = await env.DB.prepare(`SELECT COUNT(*) AS n FROM booking_days WHERE booking_id = ?`)
    .bind(bookingId)
    .first<{ n: number }>();
  return Number(row?.n ?? 0);
}

function reservationInput(overrides: Partial<ReservationInput> = {}): ReservationInput {
  return {
    itemIds: [],
    customerName: "Future Bride",
    whatsapp: "+62 813-5000-2222",
    instagram: "@futurebride",
    email: "bride@example.test",
    eventType: "Wedding",
    eventDate: futureDate(30),
    startDate: futureDate(20),
    endDate: futureDate(22),
    rentalTotal: 900000,
    deposit: 300000,
    notes: "Akad pagi",
    ...overrides,
  };
}

describe("forward reservation action", () => {
  beforeEach(async () => {
    await seedDemo(env.DB, auth(), demoSource);
  });

  it("creates a confirmed booking, occupies its days, and does not flip inventory status", async () => {
    const [itemId] = await availableItemIds(1);
    const receipt = await createReservation(
      env.DB,
      appSession("owner"),
      reservationInput({ itemIds: [itemId], startDate: futureDate(10), endDate: futureDate(12) }),
    );

    expect(receipt.booking.id).toMatch(/^B-[A-Z0-9]{6}$/);
    expect(receipt.customer.id).toMatch(/^C-[A-Z0-9]{6}$/);
    expect(receipt.booking).toMatchObject({
      tenantId: DEMO_TENANT_ID,
      itemIds: [itemId],
      status: "confirmed",
      total: 900000,
      deposit: 300000,
    });
    // A forward reservation is not a completed rental.
    expect(receipt.customer.totalRentals).toBe(0);
    // Three inclusive days occupied for the one item.
    expect(await bookingDayCount(receipt.booking.id)).toBe(3);

    const boot = await getTenantBootstrap(env.DB, DEMO_TENANT_ID);
    expect(boot.dataset.bookings.find((b) => b.id === receipt.booking.id)?.status).toBe("confirmed");
    // The piece is booked for next week but still available to rent today.
    expect(boot.dataset.inventory.find((i) => i.id === itemId)?.status).toBe("available");
  });

  it("rejects an overlapping reservation for the same item and leaves no partial write", async () => {
    const [itemId] = await availableItemIds(1);
    await createReservation(
      env.DB,
      appSession("owner"),
      reservationInput({ itemIds: [itemId], startDate: futureDate(10), endDate: futureDate(12) }),
    );
    const before = await getTenantBootstrap(env.DB, DEMO_TENANT_ID);

    await expect(
      createReservation(
        env.DB,
        appSession("owner"),
        reservationInput({
          itemIds: [itemId],
          whatsapp: "+62 813-9999-0000",
          customerName: "Clashing Booking",
          startDate: futureDate(11),
          endDate: futureDate(13),
        }),
      ),
    ).rejects.toThrow("already reserved");

    const after = await getTenantBootstrap(env.DB, DEMO_TENANT_ID);
    expect(after.dataset.bookings).toHaveLength(before.dataset.bookings.length);
    expect(after.dataset.customers).toHaveLength(before.dataset.customers.length);
  });

  it("allows a non-overlapping reservation for the same item", async () => {
    const [itemId] = await availableItemIds(1);
    await createReservation(
      env.DB,
      appSession("owner"),
      reservationInput({ itemIds: [itemId], startDate: futureDate(10), endDate: futureDate(12) }),
    );
    const second = await createReservation(
      env.DB,
      appSession("owner"),
      reservationInput({
        itemIds: [itemId],
        whatsapp: "+62 813-1111-2222",
        customerName: "Later Booking",
        startDate: futureDate(20),
        endDate: futureDate(22),
      }),
    );
    expect(second.booking.status).toBe("confirmed");
    expect(await bookingDayCount(second.booking.id)).toBe(3);
  });

  it("blocks a POS checkout whose dates overlap an existing reservation", async () => {
    const [itemId] = await availableItemIds(1);
    await createReservation(
      env.DB,
      appSession("owner"),
      reservationInput({ itemIds: [itemId], startDate: futureDate(10), endDate: futureDate(12) }),
    );
    const before = await getTenantBootstrap(env.DB, DEMO_TENANT_ID);

    await expect(
      openPosTransaction(env.DB, appSession("cashier"), {
        itemIds: [itemId],
        customerName: "Overlapping Walk In",
        whatsapp: "+62 813-7777-8888",
        startDate: futureDate(11),
        endDate: futureDate(11),
        baseRental: 350000,
        extraDayFee: 0,
        rentalTotal: 350000,
        deposit: 100000,
        method: "Cash",
      }),
    ).rejects.toThrow();

    const after = await getTenantBootstrap(env.DB, DEMO_TENANT_ID);
    expect(after.dataset.transactions).toHaveLength(before.dataset.transactions.length);
    expect(after.dataset.inventory.find((i) => i.id === itemId)?.status).toBe("available");
  });

  it("frees an item's days when a rental is returned", async () => {
    const [itemId] = await availableItemIds(1);
    const opened = await openPosTransaction(env.DB, appSession("cashier"), {
      itemIds: [itemId],
      customerName: "Same Day Renter",
      whatsapp: "+62 813-3333-4444",
      startDate: futureDate(2),
      endDate: futureDate(4),
      baseRental: 350000,
      extraDayFee: 0,
      rentalTotal: 350000,
      deposit: 100000,
      method: "Cash",
    });
    expect(await bookingDayCount(opened.booking.id)).toBe(3);

    await closePosTransaction(env.DB, appSession("cashier"), {
      bookingId: opened.booking.id,
      returnDate: futureDate(4),
      lateFee: 0,
      damageFee: 0,
      method: "Cash",
      returnDisposition: "available",
    });
    // Returned pieces release their days.
    expect(await bookingDayCount(opened.booking.id)).toBe(0);
  });

  it("reserves through the route handler for owner and cashier, and rejects fitting", async () => {
    const [itemId] = await availableItemIds(1);
    const ok = await handleReservationRequest(
      new Request("http://localhost/api/bookings/reserve", {
        method: "POST",
        body: JSON.stringify(reservationInput({ itemIds: [itemId], startDate: futureDate(40), endDate: futureDate(41) })),
      }),
      appSession("cashier"),
      env.DB,
    );
    expect(ok.status).toBe(200);

    const denied = await handleReservationRequest(
      new Request("http://localhost/api/bookings/reserve", {
        method: "POST",
        body: JSON.stringify(reservationInput({ itemIds: [itemId] })),
      }),
      appSession("fitting"),
      env.DB,
    );
    expect(denied.status).toBe(403);
  });
});
