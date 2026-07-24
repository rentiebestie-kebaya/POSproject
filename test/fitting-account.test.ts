import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { createAuth, type DomainRole } from "../src/lib/auth";
import {
  getTenantBootstrap,
  handleAccountPasswordRequest,
  handleMeasurementRequest,
  recordMeasurement,
} from "../src/lib/tenant-data";
import { DEMO_OWNER, DEMO_TENANT_ID, seedDemo, type DemoSource } from "../src/lib/seed-demo";
import { seedData, tenants, type User } from "../src/data/mock";

const TEST_SECRET = "test-only-secret-do-not-use-in-prod";
const BASE_URL = "http://localhost:3000";

function auth() {
  return createAuth(env.DB, { secret: TEST_SECRET, baseURL: BASE_URL });
}

const demoSource: DemoSource = {
  tenant: tenants.find((t) => t.id === "melati")!,
  dataset: seedData.melati,
};

const OTHER_TENANT = "other-fit";

function appSession(role: User["role"] = "fitting") {
  return {
    userId: `demo-${role}`,
    email: `${role}@tenant.test`,
    name: `${role[0].toUpperCase()}${role.slice(1)} User`,
    tenantId: DEMO_TENANT_ID,
    role,
  };
}

async function signedIn(email: string, password: string) {
  const res = await auth().api.signInEmail({ body: { email, password }, asResponse: true });
  const cookie = res.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
  const headers = new Headers({ cookie });
  const session = await auth().api.getSession({ headers });
  const validSession = session!;
  const user = validSession.user as typeof validSession.user & { tenant_id?: string; role?: DomainRole };
  return { headers, session: { userId: user.id, email: user.email, name: user.name, tenantId: user.tenant_id!, role: user.role! } };
}

async function canSignIn(email: string, password: string): Promise<boolean> {
  try {
    const res = await auth().api.signInEmail({ body: { email, password }, asResponse: true });
    return res.status === 200;
  } catch {
    return false;
  }
}

async function firstCustomerId(): Promise<string> {
  const boot = await getTenantBootstrap(env.DB, DEMO_TENANT_ID);
  return boot.dataset.customers[0].id;
}

function jsonRequest(path: string, body: Record<string, unknown>) {
  return new Request(`http://localhost:3000${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("fitting measurements", () => {
  beforeEach(async () => {
    await seedDemo(env.DB, auth(), demoSource);
  });

  it("records a measurement and returns the customer's full history", async () => {
    const customerId = await firstCustomerId();
    const before = (await getTenantBootstrap(env.DB, DEMO_TENANT_ID)).dataset.customers.find(
      (c) => c.id === customerId,
    )!;

    const { customer } = await recordMeasurement(env.DB, appSession("fitting"), {
      customerId,
      bust: 88,
      waist: 70,
      hip: 94,
    });

    expect(customer.id).toBe(customerId);
    expect(customer.measurements).toHaveLength(before.measurements.length + 1);
    const latest = customer.measurements[customer.measurements.length - 1];
    expect(latest).toMatchObject({ bust: 88, waist: 70, hip: 94 });

    // Persisted, not just echoed back.
    const boot = await getTenantBootstrap(env.DB, DEMO_TENANT_ID);
    expect(boot.dataset.customers.find((c) => c.id === customerId)!.measurements).toHaveLength(
      before.measurements.length + 1,
    );
  });

  it("rejects nonsense measurements", async () => {
    const customerId = await firstCustomerId();
    await expect(
      recordMeasurement(env.DB, appSession("fitting"), { customerId, bust: 0, waist: 70, hip: 94 }),
    ).rejects.toThrow("Bust is required.");
    await expect(
      recordMeasurement(env.DB, appSession("fitting"), { customerId, bust: 88, waist: 900, hip: 94 }),
    ).rejects.toThrow("between 20 and 250");
  });

  it("cannot reach another shop's customer", async () => {
    await env.DB.prepare(
      `INSERT INTO tenants (id, name, subdomain, location, whatsapp, plan, booking_deposit_policy)
       VALUES (?, 'Other Fit Shop', 'other-fit.rentie.id', 'Bandung', '+62 811', 'pro', 'refundable')`,
    )
      .bind(OTHER_TENANT)
      .run();
    await env.DB.prepare(
      `INSERT INTO customers (id, tenant_id, name, whatsapp, normalized_whatsapp, total_rentals, last_rental)
       VALUES ('C-OTHER', ?, 'Other Customer', '+62 899', '62899', 0, '2026-07-01')`,
    )
      .bind(OTHER_TENANT)
      .run();

    await expect(
      recordMeasurement(env.DB, appSession("fitting"), { customerId: "C-OTHER", bust: 88, waist: 70, hip: 94 }),
    ).rejects.toThrow("Customer not found.");

    const leaked = await env.DB.prepare(
      `SELECT COUNT(*) AS n FROM customer_measurements WHERE customer_id = 'C-OTHER'`,
    ).first<{ n: number }>();
    expect(Number(leaked?.n)).toBe(0);
  });

  it("allows owner and fitting staff, but not a cashier", async () => {
    const customerId = await firstCustomerId();
    for (const role of ["owner", "fitting"] as const) {
      const res = await handleMeasurementRequest(
        jsonRequest("/api/fitting/measurement", { customerId, bust: 90, waist: 72, hip: 96 }),
        appSession(role),
        env.DB,
      );
      expect(res.status).toBe(200);
    }

    const denied = await handleMeasurementRequest(
      jsonRequest("/api/fitting/measurement", { customerId, bust: 90, waist: 72, hip: 96 }),
      appSession("cashier"),
      env.DB,
    );
    expect(denied.status).toBe(403);
  });
});

describe("own account password", () => {
  beforeEach(async () => {
    await seedDemo(env.DB, auth(), demoSource);
  });

  it("changes the password when the current one is correct", async () => {
    const owner = await signedIn(DEMO_OWNER.email, DEMO_OWNER.password);
    const res = await handleAccountPasswordRequest(
      jsonRequest("/api/account/password", {
        currentPassword: DEMO_OWNER.password,
        newPassword: "a-brand-new-password",
      }),
      owner.session,
      auth(),
      owner.headers,
    );
    expect(res.status).toBe(200);

    expect(await canSignIn(DEMO_OWNER.email, "a-brand-new-password")).toBe(true);
    expect(await canSignIn(DEMO_OWNER.email, DEMO_OWNER.password)).toBe(false);
  });

  it("refuses a wrong current password and leaves the old one working", async () => {
    const owner = await signedIn(DEMO_OWNER.email, DEMO_OWNER.password);
    const res = await handleAccountPasswordRequest(
      jsonRequest("/api/account/password", {
        currentPassword: "not-my-password",
        newPassword: "a-brand-new-password",
      }),
      owner.session,
      auth(),
      owner.headers,
    );
    expect(res.status).toBe(400);
    expect(await canSignIn(DEMO_OWNER.email, DEMO_OWNER.password)).toBe(true);
    expect(await canSignIn(DEMO_OWNER.email, "a-brand-new-password")).toBe(false);
  });

  it("rejects a short or unchanged new password, and an anonymous caller", async () => {
    const owner = await signedIn(DEMO_OWNER.email, DEMO_OWNER.password);
    const short = await handleAccountPasswordRequest(
      jsonRequest("/api/account/password", { currentPassword: DEMO_OWNER.password, newPassword: "short" }),
      owner.session,
      auth(),
      owner.headers,
    );
    expect(short.status).toBe(400);

    const same = await handleAccountPasswordRequest(
      jsonRequest("/api/account/password", {
        currentPassword: DEMO_OWNER.password,
        newPassword: DEMO_OWNER.password,
      }),
      owner.session,
      auth(),
      owner.headers,
    );
    expect(same.status).toBe(400);

    const anon = await handleAccountPasswordRequest(
      jsonRequest("/api/account/password", { currentPassword: "x", newPassword: "yyyyyyyy" }),
      null,
      auth(),
      new Headers(),
    );
    expect(anon.status).toBe(401);
  });
});
