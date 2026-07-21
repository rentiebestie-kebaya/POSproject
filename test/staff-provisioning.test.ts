import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { createAuth, type DomainRole } from "../src/lib/auth";
import {
  getSessionScopedBootstrap,
  handleInventoryAddRequest,
  handleStaffProvisionRequest,
  openPosTransaction,
  type StaffProvisionReceipt,
} from "../src/lib/tenant-data";
import { DEMO_OWNER, DEMO_TENANT_ID, seedDemo, type DemoSource } from "../src/lib/seed-demo";
import { seedData, tenants } from "../src/data/mock";

const TEST_SECRET = "test-only-secret-do-not-use-in-prod";
const BASE_URL = "http://localhost:3000";

function auth() {
  return createAuth(env.DB, { secret: TEST_SECRET, baseURL: BASE_URL });
}

const demoSource: DemoSource = {
  tenant: tenants.find((t) => t.id === "melati")!,
  dataset: seedData["melati"],
};

const OTHER_TENANT = "other";
const OTHER_ITEM = "OTHER-STAFF-ITEM";
const OTHER_OWNER = { email: "other-owner@staff.test", password: "password123", name: "Other Owner" };

async function seedOtherTenant() {
  await env.DB.batch([
    env.DB
      .prepare(
        `INSERT INTO tenants (id, name, subdomain, location, whatsapp, plan, booking_deposit_policy)
         VALUES (?, 'Other Staff Shop', 'other-staff.rentie.id', 'Bandung', '+62 811-0000-0000', 'starter', 'non_refundable')`,
      )
      .bind(OTHER_TENANT),
    env.DB
      .prepare(
        `INSERT INTO inventory_items
          (id, tenant_id, name, inventory_code, size_label, model, color, wear_style, rent_condition,
           bust, waist, length, sleeve, status, condition_grade, qr_code, date_added)
         VALUES (?, ?, 'Other Secret Item', 'OST-1', 'M', 'Kebaya', 'Red', 'hijab', 'both',
                 80, 60, 90, 50, 'available', 'A', 'QR-OST-1', '2026-06-01')`,
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

async function signedIn(email: string, password: string) {
  const res = await auth().api.signInEmail({
    body: { email, password },
    asResponse: true,
  });
  const cookie = res.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
  const headers = new Headers({ cookie });
  const session = await auth().api.getSession({ headers });
  expect(session).not.toBeNull();
  const validSession = session!;
  const user = validSession.user as typeof validSession.user & { tenant_id?: string; role?: DomainRole };
  return {
    headers,
    session: {
      userId: user.id,
      email: user.email,
      name: user.name,
      tenantId: user.tenant_id!,
      role: user.role!,
    },
  };
}

function staffRequest(body: Record<string, unknown>) {
  return new Request("http://localhost:3000/api/staff/provision", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function provisionStaffAs(
  actor: Awaited<ReturnType<typeof signedIn>>,
  body: Record<string, unknown>,
): Promise<Response> {
  return handleStaffProvisionRequest(staffRequest(body), actor.session, auth(), actor.headers, env.DB);
}

describe("owner staff provisioning", () => {
  beforeEach(async () => {
    await seedDemo(env.DB, auth(), demoSource);
    await seedOtherTenant();
  });

  it("lets an owner create a cashier who can log in, reads only their shop, and attributes POS actions", async () => {
    const owner = await signedIn(DEMO_OWNER.email, DEMO_OWNER.password);
    const response = await provisionStaffAs(
      owner,
      {
        email: "cashier.one@demo.test",
        password: "password123",
        name: "Cashier One",
        role: "cashier",
      },
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as StaffProvisionReceipt;
    expect(body.user).toMatchObject({
      tenantId: DEMO_TENANT_ID,
      name: "Cashier One",
      role: "cashier",
    });
    expect(body.team.map((user) => user.name)).toContain("Cashier One");

    const cashier = await signedIn("cashier.one@demo.test", "password123");
    const bootstrap = await getSessionScopedBootstrap(auth(), cashier.headers, env.DB);
    expect(bootstrap?.tenant?.id).toBe(DEMO_TENANT_ID);
    expect(bootstrap?.dataset.inventory.some((item) => item.id === OTHER_ITEM)).toBe(false);
    expect(bootstrap?.team.some((user) => user.name === "Cashier One" && user.role === "cashier")).toBe(true);

    const availableItem = bootstrap!.dataset.inventory.find((item) => item.status === "available")!;
    const receipt = await openPosTransaction(env.DB, cashier.session, {
      itemIds: [availableItem.id],
      customerName: "Walk In Customer",
      whatsapp: "+62 812-1111-2222",
      startDate: "2026-07-21",
      endDate: "2026-07-23",
      baseRental: availableItem.rentalPrice,
      extraDayFee: 0,
      rentalTotal: availableItem.rentalPrice,
      deposit: 150000,
      method: "QRIS",
    });
    expect(receipt.cashierName).toBe("Cashier One");
    expect(receipt.transaction.cashierName).toBe("Cashier One");

    const fittingResponse = await provisionStaffAs(
      owner,
      {
        email: "fitting.owner-created@demo.test",
        password: "password123",
        name: "Fitting Owner Created",
        role: "fitting",
      },
    );
    expect(fittingResponse.status).toBe(200);
    const fittingBody = (await fittingResponse.json()) as StaffProvisionReceipt;
    expect(fittingBody.user).toMatchObject({
      tenantId: DEMO_TENANT_ID,
      name: "Fitting Owner Created",
      role: "fitting",
    });
  });

  it("rejects cashier attempts to provision accounts", async () => {
    const owner = await signedIn(DEMO_OWNER.email, DEMO_OWNER.password);
    await provisionStaffAs(
      owner,
      {
        email: "cashier.two@demo.test",
        password: "password123",
        name: "Cashier Two",
        role: "cashier",
      },
    );

    const cashier = await signedIn("cashier.two@demo.test", "password123");
    const response = await provisionStaffAs(
      cashier,
      {
        email: "fitting.one@demo.test",
        password: "password123",
        name: "Fitting One",
        role: "fitting",
      },
    );

    expect(response.status).toBe(403);
    const row = await env.DB.prepare(`SELECT id FROM "user" WHERE email = ?`)
      .bind("fitting.one@demo.test")
      .first();
    expect(row).toBeNull();
  });

  it("rejects a tenant-A staff member trying to write tenant-B data through a route seam", async () => {
    const owner = await signedIn(DEMO_OWNER.email, DEMO_OWNER.password);
    await provisionStaffAs(
      owner,
      {
        email: "cashier.cross-tenant@demo.test",
        password: "password123",
        name: "Cross Tenant Cashier",
        role: "cashier",
      },
    );
    const cashier = await signedIn("cashier.cross-tenant@demo.test", "password123");

    const response = await handleInventoryAddRequest(
      new Request("http://localhost:3000/api/inventory/add", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tenantId: OTHER_TENANT, name: "Injected Item" }),
      }),
      cashier.session,
      env.DB,
    );

    expect(response.status).toBe(403);
    const otherTenantItems = await env.DB.prepare(`SELECT COUNT(*) AS count FROM inventory_items WHERE tenant_id = ?`)
      .bind(OTHER_TENANT)
      .first<{ count: number }>();
    expect(Number(otherTenantItems?.count)).toBe(1);
  });
});
