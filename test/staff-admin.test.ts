import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { createAuth, type DomainRole } from "../src/lib/auth";
import {
  handleStaffAccessRequest,
  handleStaffPasswordRequest,
  handleStaffProvisionRequest,
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
const OTHER_STAFF = { email: "other-cashier@staff.test", password: "password123", name: "Other Cashier" };
const CASHIER = { email: "cashier.admin@demo.test", password: "password123", name: "Cashier Admin" };

async function seedOtherTenantStaff() {
  await env.DB.prepare(
    `INSERT INTO tenants (id, name, subdomain, location, whatsapp, plan, booking_deposit_policy)
     VALUES (?, 'Other Shop', 'other-admin.rentie.id', 'Bandung', '+62 811-0000-0000', 'starter', 'non_refundable')`,
  )
    .bind(OTHER_TENANT)
    .run();
  await auth().api.createUser({
    body: {
      email: OTHER_STAFF.email,
      password: OTHER_STAFF.password,
      name: OTHER_STAFF.name,
      role: "cashier",
      data: { tenant_id: OTHER_TENANT },
    },
  });
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

/** Whether these credentials can still open a session (a banned account cannot). */
async function canSignIn(email: string, password: string): Promise<boolean> {
  try {
    const res = await auth().api.signInEmail({ body: { email, password }, asResponse: true });
    return res.status === 200;
  } catch {
    return false;
  }
}

function jsonRequest(path: string, body: Record<string, unknown>) {
  return new Request(`http://localhost:3000${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

type Actor = Awaited<ReturnType<typeof signedIn>>;

function setAccessAs(actor: Actor, body: Record<string, unknown>) {
  return handleStaffAccessRequest(jsonRequest("/api/staff/access", body), actor.session, auth(), actor.headers, env.DB);
}

function setPasswordAs(actor: Actor, body: Record<string, unknown>) {
  return handleStaffPasswordRequest(
    jsonRequest("/api/staff/password", body),
    actor.session,
    auth(),
    actor.headers,
    env.DB,
  );
}

/** Provision a cashier in the demo tenant and return their user id. */
async function provisionCashier(owner: Actor): Promise<string> {
  const res = await handleStaffProvisionRequest(
    jsonRequest("/api/staff/provision", { ...CASHIER, role: "cashier" }),
    owner.session,
    auth(),
    owner.headers,
    env.DB,
  );
  expect(res.status).toBe(200);
  const body = (await res.json()) as StaffProvisionReceipt;
  return body.user.id;
}

describe("owner staff administration", () => {
  beforeEach(async () => {
    await seedDemo(env.DB, auth(), demoSource);
    await seedOtherTenantStaff();
  });

  it("revokes a departed cashier's access without deleting the account", async () => {
    const owner = await signedIn(DEMO_OWNER.email, DEMO_OWNER.password);
    const cashierId = await provisionCashier(owner);
    expect(await canSignIn(CASHIER.email, CASHIER.password)).toBe(true);

    const res = await setAccessAs(owner, { userId: cashierId, active: false });
    expect(res.status).toBe(200);
    const body = (await res.json()) as StaffProvisionReceipt;
    expect(body.user).toMatchObject({ id: cashierId, name: CASHIER.name, active: false });
    expect(body.team.find((u) => u.id === cashierId)?.active).toBe(false);

    // The account still exists (attribution survives) but can no longer sign in.
    expect(await canSignIn(CASHIER.email, CASHIER.password)).toBe(false);
    const stillThere = await env.DB.prepare(`SELECT name FROM "user" WHERE id = ?`).bind(cashierId).first<{ name: string }>();
    expect(stillThere?.name).toBe(CASHIER.name);
  });

  it("restores access when the owner reactivates the account", async () => {
    const owner = await signedIn(DEMO_OWNER.email, DEMO_OWNER.password);
    const cashierId = await provisionCashier(owner);
    await setAccessAs(owner, { userId: cashierId, active: false });
    expect(await canSignIn(CASHIER.email, CASHIER.password)).toBe(false);

    const res = await setAccessAs(owner, { userId: cashierId, active: true });
    expect(res.status).toBe(200);
    const body = (await res.json()) as StaffProvisionReceipt;
    expect(body.user.active).toBe(true);
    expect(await canSignIn(CASHIER.email, CASHIER.password)).toBe(true);
  });

  it("refuses to revoke across tenants, the owner's own account, or another owner", async () => {
    const owner = await signedIn(DEMO_OWNER.email, DEMO_OWNER.password);

    // Another shop's staff is invisible, even with a valid id.
    const otherId = await env.DB.prepare(`SELECT id FROM "user" WHERE email = ?`)
      .bind(OTHER_STAFF.email)
      .first<{ id: string }>();
    const crossTenant = await setAccessAs(owner, { userId: otherId!.id, active: false });
    expect(crossTenant.status).toBe(404);
    expect(await canSignIn(OTHER_STAFF.email, OTHER_STAFF.password)).toBe(true);

    // An owner cannot lock themselves out.
    const self = await setAccessAs(owner, { userId: owner.session.userId, active: false });
    expect(self.status).toBe(400);
    expect(await canSignIn(DEMO_OWNER.email, DEMO_OWNER.password)).toBe(true);

    // Nor can one owner revoke another owner in the same shop.
    await auth().api.createUser({
      body: {
        email: "second.owner@demo.test",
        password: "password123",
        name: "Second Owner",
        role: "owner",
        data: { tenant_id: DEMO_TENANT_ID },
      },
    });
    const secondOwner = await env.DB.prepare(`SELECT id FROM "user" WHERE email = ?`)
      .bind("second.owner@demo.test")
      .first<{ id: string }>();
    const ownerTarget = await setAccessAs(owner, { userId: secondOwner!.id, active: false });
    expect(ownerTarget.status).toBe(403);
  });

  it("rejects a cashier trying to revoke anyone", async () => {
    const owner = await signedIn(DEMO_OWNER.email, DEMO_OWNER.password);
    const cashierId = await provisionCashier(owner);
    const cashier = await signedIn(CASHIER.email, CASHIER.password);

    const res = await setAccessAs(cashier, { userId: cashierId, active: false });
    expect(res.status).toBe(403);
    expect(await canSignIn(CASHIER.email, CASHIER.password)).toBe(true);
  });

  it("lets the owner reset a locked-out staff password", async () => {
    const owner = await signedIn(DEMO_OWNER.email, DEMO_OWNER.password);
    const cashierId = await provisionCashier(owner);

    const res = await setPasswordAs(owner, { userId: cashierId, password: "brand-new-pass" });
    expect(res.status).toBe(200);

    expect(await canSignIn(CASHIER.email, "brand-new-pass")).toBe(true);
    expect(await canSignIn(CASHIER.email, CASHIER.password)).toBe(false);
  });

  it("rejects a too-short password and a cashier resetting passwords", async () => {
    const owner = await signedIn(DEMO_OWNER.email, DEMO_OWNER.password);
    const cashierId = await provisionCashier(owner);

    const tooShort = await setPasswordAs(owner, { userId: cashierId, password: "short" });
    expect(tooShort.status).toBe(400);

    const cashier = await signedIn(CASHIER.email, CASHIER.password);
    const denied = await setPasswordAs(cashier, { userId: cashierId, password: "another-pass" });
    expect(denied.status).toBe(403);
    // The original password still works — neither attempt changed anything.
    expect(await canSignIn(CASHIER.email, CASHIER.password)).toBe(true);
  });
});
