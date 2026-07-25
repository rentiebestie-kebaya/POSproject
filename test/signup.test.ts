import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { createAuth } from "../src/lib/auth";
import { handleSignupRequest } from "../src/lib/signup";

const TEST_SECRET = "test-only-secret-do-not-use-in-prod";

function auth() {
  return createAuth(env.DB, { secret: TEST_SECRET, baseURL: "http://localhost:3000" });
}

function signupRequest(overrides: Record<string, unknown> = {}) {
  return new Request("http://localhost:3000/api/signup", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      storeName: "Griya Melati",
      ownerName: "Ayu Lestari",
      email: "ayu@griyamelati.test",
      password: "correct-horse",
      location: "Kemang, Jakarta Selatan",
      whatsapp: "+62 812-0000-1234",
      bookingSlug: "griya-melati",
      plan: "starter",
      ...overrides,
    }),
  });
}

describe("real D1-backed signup", () => {
  it("creates a tenant, owner identity, and usable session cookie", async () => {
    const response = await handleSignupRequest(signupRequest(), auth(), env.DB);

    expect(response.status).toBe(200);
    const cookies = response.headers.getSetCookie();
    expect(cookies.length).toBeGreaterThan(0);

    const tenant = await env.DB.prepare(
      `SELECT id, name, subdomain, location, whatsapp, plan, billing_status, onboarding_status
       FROM tenants WHERE id = ?`,
    )
      .bind("griya-melati")
      .first<Record<string, string>>();
    expect(tenant).toMatchObject({
      id: "griya-melati",
      name: "Griya Melati",
      subdomain: "griya-melati.rentie.id",
      location: "Kemang, Jakarta Selatan",
      whatsapp: "+62 812-0000-1234",
      plan: "starter",
      billing_status: "pending",
      onboarding_status: "incomplete",
    });

    const user = await env.DB.prepare(
      `SELECT email, name, tenant_id, role FROM "user" WHERE email = ?`,
    )
      .bind("ayu@griyamelati.test")
      .first<Record<string, string>>();
    expect(user).toMatchObject({
      email: "ayu@griyamelati.test",
      name: "Ayu Lestari",
      tenant_id: "griya-melati",
      role: "owner",
    });

    const session = await auth().api.getSession({
      headers: new Headers({ cookie: cookies.map((cookie) => cookie.split(";")[0]).join("; ") }),
    });
    expect(session?.user.email).toBe("ayu@griyamelati.test");
    expect((session?.user as { tenant_id?: string }).tenant_id).toBe("griya-melati");
    expect((session?.user as { role?: string }).role).toBe("owner");
  });

  it("reserves a different D1 slug when the requested one is occupied", async () => {
    await env.DB.prepare(
      `INSERT INTO tenants (id, name, subdomain, location, whatsapp, booking_deposit_policy)
       VALUES ('griya-melati', 'Existing Shop', 'griya-melati.rentie.id', 'Bandung', '+62 811-1111-1111', 'non_refundable')`,
    ).run();

    const response = await handleSignupRequest(
      signupRequest({
        email: "second@griyamelati.test",
        bookingSlug: "griya-melati",
      }),
      auth(),
      env.DB,
    );

    expect(response.status).toBe(200);
    const tenant = await env.DB.prepare(`SELECT id FROM tenants WHERE id = ?`)
      .bind("griya-melati-2")
      .first<{ id: string }>();
    expect(tenant?.id).toBe("griya-melati-2");
  });

  it("rolls back the tenant when better-auth rejects the owner email", async () => {
    const existing = await auth().api.createUser({
      body: {
        email: "existing@griyamelati.test",
        password: "correct-horse",
        name: "Existing Owner",
        role: "owner",
        data: { tenant_id: "existing-tenant" },
      },
    });
    expect(existing.user.email).toBe("existing@griyamelati.test");

    const response = await handleSignupRequest(
      signupRequest({
        email: "existing@griyamelati.test",
        bookingSlug: "rolled-back-shop",
      }),
      auth(),
      env.DB,
    );

    expect(response.status).toBe(409);
    const tenant = await env.DB.prepare(`SELECT id FROM tenants WHERE id = ?`)
      .bind("rolled-back-shop")
      .first();
    expect(tenant).toBeNull();
  });
});
