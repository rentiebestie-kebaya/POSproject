import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { createAuth } from "../src/lib/auth";
import {
  approveBookingRequest,
  createPublicBookingRequest,
  createReservation,
  getPublicStore,
  getTenantBootstrap,
  handleBookingRequestApproval,
  rejectBookingRequest,
  type PublicBookingRequestInput,
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

function appSession(role: User["role"] = "owner") {
  return {
    userId: `demo-${role}`,
    email: `${role}@tenant.test`,
    name: `${role[0].toUpperCase()}${role.slice(1)} User`,
    tenantId: DEMO_TENANT_ID,
    role,
  };
}

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

function requestInput(overrides: Partial<PublicBookingRequestInput> = {}): PublicBookingRequestInput {
  return {
    tenantId: DEMO_TENANT_ID,
    itemId: "",
    customerName: "Public Visitor",
    whatsapp: "+62 813-4000-5000",
    eventType: "Wisuda",
    eventDate: futureDate(32),
    startDate: futureDate(30),
    endDate: futureDate(32),
    notes: "Pickup sore",
    ...overrides,
  };
}

describe("public booking requests", () => {
  beforeEach(async () => {
    await seedDemo(env.DB, auth(), demoSource);
  });

  it("accepts a request from the public page and stores it pending", async () => {
    const [itemId] = await availableItemIds(1);
    const { request } = await createPublicBookingRequest(env.DB, requestInput({ itemId }));

    expect(request.id).toMatch(/^BR-[A-Z0-9]{6}$/);
    expect(request).toMatchObject({
      tenantId: DEMO_TENANT_ID,
      itemId,
      customerName: "Public Visitor",
      status: "pending",
      paymentStatus: "unpaid",
    });
    // Deposit terms come from the shop's settings, never from the visitor.
    const boot = await getTenantBootstrap(env.DB, DEMO_TENANT_ID);
    expect(request.depositAmount).toBe(boot.tenant!.bookingDepositAmount);
    expect(boot.dataset.bookingRequests.some((r) => r.id === request.id)).toBe(true);
  });

  it("hides the booking page for a non-Pro or suspended shop", async () => {
    await env.DB.prepare(`UPDATE tenants SET plan = 'free' WHERE id = ?`).bind(DEMO_TENANT_ID).run();
    const [itemId] = await availableItemIds(1);
    await expect(createPublicBookingRequest(env.DB, requestInput({ itemId }))).rejects.toThrow(
      "Booking page is not available.",
    );

    await env.DB.prepare(`UPDATE tenants SET plan = 'pro', status = 'suspended' WHERE id = ?`)
      .bind(DEMO_TENANT_ID)
      .run();
    await expect(createPublicBookingRequest(env.DB, requestInput({ itemId }))).rejects.toThrow(
      "Booking page is not available.",
    );
  });

  it("rejects an unknown shop, a foreign item, and a past date", async () => {
    const [itemId] = await availableItemIds(1);

    await expect(
      createPublicBookingRequest(env.DB, requestInput({ itemId, tenantId: "no-such-shop" })),
    ).rejects.toThrow("Booking page is not available.");

    await expect(
      createPublicBookingRequest(env.DB, requestInput({ itemId: "NOT-MY-ITEM" })),
    ).rejects.toThrow("Selected item is no longer available.");

    await expect(
      createPublicBookingRequest(
        env.DB,
        requestInput({ itemId, startDate: futureDate(-2), endDate: futureDate(-1) }),
      ),
    ).rejects.toThrow("future date");
  });

  it("caps how many pending requests one contact can pile up", async () => {
    const [itemId] = await availableItemIds(1);
    for (let i = 0; i < 3; i += 1) {
      await createPublicBookingRequest(
        env.DB,
        requestInput({ itemId, startDate: futureDate(40 + i), endDate: futureDate(41 + i) }),
      );
    }
    await expect(
      createPublicBookingRequest(env.DB, requestInput({ itemId, startDate: futureDate(60), endDate: futureDate(61) })),
    ).rejects.toThrow("already have booking requests waiting");
  });

  it("does not let a pending request block availability", async () => {
    const [itemId] = await availableItemIds(1);
    const start = futureDate(30);
    const end = futureDate(32);
    await createPublicBookingRequest(env.DB, requestInput({ itemId, startDate: start, endDate: end }));

    // A request is an enquiry, not a commitment — the piece is still bookable.
    const reservation = await createReservation(env.DB, appSession("owner"), {
      itemIds: [itemId],
      customerName: "Walk In First",
      whatsapp: "+62 813-1111-0000",
      startDate: start,
      endDate: end,
      rentalTotal: 500000,
      deposit: 100000,
    });
    expect(reservation.booking.status).toBe("confirmed");
  });

  it("turns an approved request into a confirmed booking that occupies its days", async () => {
    const [itemId] = await availableItemIds(1);
    const { request } = await createPublicBookingRequest(
      env.DB,
      requestInput({ itemId, startDate: futureDate(30), endDate: futureDate(32) }),
    );

    const receipt = await approveBookingRequest(env.DB, appSession("owner"), { requestId: request.id });
    expect(receipt.request.status).toBe("approved");
    expect(receipt.booking).toMatchObject({ status: "confirmed", itemIds: [itemId] });
    expect(receipt.customer.name).toBe("Public Visitor");
    expect(await bookingDayCount(receipt.booking.id)).toBe(3);

    const boot = await getTenantBootstrap(env.DB, DEMO_TENANT_ID);
    expect(boot.dataset.bookings.find((b) => b.id === receipt.booking.id)?.status).toBe("confirmed");
  });

  it("refuses approval when the piece was taken first, leaving the request pending", async () => {
    const [itemId] = await availableItemIds(1);
    const start = futureDate(30);
    const end = futureDate(32);
    const { request } = await createPublicBookingRequest(env.DB, requestInput({ itemId, startDate: start, endDate: end }));

    // Someone reserves the same piece for the same dates before the owner acts.
    await createReservation(env.DB, appSession("owner"), {
      itemIds: [itemId],
      customerName: "Faster Customer",
      whatsapp: "+62 813-2222-0000",
      startDate: start,
      endDate: end,
      rentalTotal: 500000,
      deposit: 100000,
    });
    const before = await getTenantBootstrap(env.DB, DEMO_TENANT_ID);

    await expect(
      approveBookingRequest(env.DB, appSession("owner"), { requestId: request.id }),
    ).rejects.toThrow("already booked");

    const after = await getTenantBootstrap(env.DB, DEMO_TENANT_ID);
    expect(after.dataset.bookings).toHaveLength(before.dataset.bookings.length);
    expect(after.dataset.bookingRequests.find((r) => r.id === request.id)?.status).toBe("pending");
  });

  it("rejects a request, and refuses to approve one that is no longer pending", async () => {
    const [itemId] = await availableItemIds(1);
    const { request } = await createPublicBookingRequest(env.DB, requestInput({ itemId }));

    const rejected = await rejectBookingRequest(env.DB, appSession("owner"), { requestId: request.id });
    expect(rejected.request.status).toBe("rejected");

    await expect(
      approveBookingRequest(env.DB, appSession("owner"), { requestId: request.id }),
    ).rejects.toThrow("Only pending booking requests can be approved.");
  });

  it("exposes only public fields on the public store read", async () => {
    const store = (await getPublicStore(env.DB, DEMO_TENANT_ID))!;
    expect(store).not.toBeNull();
    expect(store.tenant.name).toBe("Kebaya Demo");
    expect(store.items.length).toBeGreaterThan(0);

    // The privacy boundary: no internal cost, no customer or money data anywhere.
    const serialized = JSON.stringify(store);
    expect(serialized).not.toContain("cost");
    expect(serialized).not.toContain("timesRented");
    expect(Object.keys(store)).toEqual(["tenant", "items", "busy"]);
    expect(Object.keys(store.items[0]).sort()).toEqual(
      ["color", "id", "inventoryCode", "model", "name", "photos", "rentalPrice", "sizeLabel"].sort(),
    );
    // Busy ranges say what is taken, never by whom.
    for (const busy of store.busy) {
      expect(Object.keys(busy).sort()).toEqual(["endDate", "itemId", "startDate"]);
    }
  });

  it("hides the public store read for a non-Pro or unknown shop", async () => {
    expect(await getPublicStore(env.DB, "no-such-shop")).toBeNull();
    await env.DB.prepare(`UPDATE tenants SET plan = 'free' WHERE id = ?`).bind(DEMO_TENANT_ID).run();
    expect(await getPublicStore(env.DB, DEMO_TENANT_ID)).toBeNull();
  });

  it("scopes decisions to the caller's shop and role", async () => {
    const [itemId] = await availableItemIds(1);
    const { request } = await createPublicBookingRequest(env.DB, requestInput({ itemId }));

    // Another tenant's session cannot see, let alone decide, this request.
    await expect(
      approveBookingRequest(env.DB, { ...appSession("owner"), tenantId: "someone-else" }, { requestId: request.id }),
    ).rejects.toThrow("Booking request not found.");

    const denied = await handleBookingRequestApproval(
      new Request("http://localhost/api/bookings/requests/approve", {
        method: "POST",
        body: JSON.stringify({ requestId: request.id }),
      }),
      appSession("fitting"),
      env.DB,
    );
    expect(denied.status).toBe(403);
  });
});
