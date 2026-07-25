import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { seedData, tenants } from "../src/data/mock";
import { DEMO_TENANT_ID, DEMO_TENANT_NAME, seedDemo, type DemoSource } from "../src/lib/seed-demo";
import { createAuth } from "../src/lib/auth";
import { handleTenantProfileRequest, type TenantProfileReceipt } from "../src/lib/tenant-data";

const TEST_SECRET = "test-only-secret-do-not-use-in-prod";

function auth() {
  return createAuth(env.DB, { secret: TEST_SECRET, baseURL: "http://localhost:3000" });
}

const demoSource: DemoSource = {
  tenant: tenants.find((t) => t.id === "melati")!,
  dataset: seedData.melati,
};

function appSession(role: "owner" | "cashier" = "owner") {
  return {
    userId: `${role}-user`,
    email: `${role}@demo.test`,
    name: role === "owner" ? "Owner User" : "Cashier User",
    tenantId: DEMO_TENANT_ID,
    role,
  };
}

function profileRequest(body: Record<string, unknown>) {
  return new Request("http://localhost:3000/api/tenant/profile", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function patchAs(role: "owner" | "cashier", body: Record<string, unknown>) {
  return handleTenantProfileRequest(profileRequest(body), appSession(role), env.DB);
}

describe("tenant profile updates", () => {
  beforeEach(async () => {
    await seedDemo(env.DB, auth(), demoSource);
  });

  it("lets an owner update editable shop profile fields and returns the authoritative tenant", async () => {
    const before = await env.DB.prepare(
      `SELECT subdomain, plan, billing_status, status, onboarding_status FROM tenants WHERE id = ?`,
    )
      .bind(DEMO_TENANT_ID)
      .first<Record<string, string>>();

    const response = await patchAs("owner", {
      name: "  Griya Melati Baru  ",
      location: "  Senopati, Jakarta Selatan  ",
      whatsapp: "  +62 812-9999-0000  ",
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as TenantProfileReceipt;
    expect(body.tenant).toMatchObject({
      id: DEMO_TENANT_ID,
      name: "Griya Melati Baru",
      location: "Senopati, Jakarta Selatan",
      whatsapp: "+62 812-9999-0000",
    });

    const after = await env.DB.prepare(
      `SELECT name, subdomain, location, whatsapp, plan, billing_status, status, onboarding_status
       FROM tenants WHERE id = ?`,
    )
      .bind(DEMO_TENANT_ID)
      .first<Record<string, string>>();
    expect(after).toMatchObject({
      name: "Griya Melati Baru",
      subdomain: before!.subdomain,
      location: "Senopati, Jakarta Selatan",
      whatsapp: "+62 812-9999-0000",
      plan: before!.plan,
      billing_status: before!.billing_status,
      status: before!.status,
      onboarding_status: before!.onboarding_status,
    });
  });

  it("persists onboarding completion through the same owner-only profile endpoint", async () => {
    await env.DB.prepare(`UPDATE tenants SET onboarding_status = 'incomplete' WHERE id = ?`)
      .bind(DEMO_TENANT_ID)
      .run();

    const response = await patchAs("owner", { onboardingStatus: "complete" });
    expect(response.status).toBe(200);
    const body = (await response.json()) as TenantProfileReceipt;
    expect(body.tenant.onboardingStatus).toBe("complete");

    const row = await env.DB.prepare(`SELECT onboarding_status FROM tenants WHERE id = ?`)
      .bind(DEMO_TENANT_ID)
      .first<{ onboarding_status: string }>();
    expect(row?.onboarding_status).toBe("complete");
  });

  it("rejects staff, invalid editable fields, and attempts to patch read-only fields", async () => {
    const staff = await patchAs("cashier", { name: "Staff Edit" });
    expect(staff.status).toBe(403);

    const invalidWhatsapp = await patchAs("owner", { whatsapp: "12345" });
    expect(invalidWhatsapp.status).toBe(400);

    const readonly = await patchAs("owner", { plan: "pro" });
    expect(readonly.status).toBe(400);

    const row = await env.DB.prepare(`SELECT name, whatsapp, plan FROM tenants WHERE id = ?`)
      .bind(DEMO_TENANT_ID)
      .first<Record<string, string>>();
    expect(row).toMatchObject({
      name: DEMO_TENANT_NAME,
      whatsapp: demoSource.tenant.whatsapp,
      plan: demoSource.tenant.plan,
    });
  });
});
