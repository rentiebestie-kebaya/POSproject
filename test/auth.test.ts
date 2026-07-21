import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { createAuth } from "../src/lib/auth";

/**
 * Auth-boundary tests (ticket 02). Exercised at the adapter/route seam — build a
 * real better-auth instance against the migrated local D1 and drive its server
 * API, per the spec's Testing Decisions ("auth-boundary tests at the
 * route/adapter level; DB-state tests at the highest seam").
 */

const TEST_SECRET = "test-only-secret-do-not-use-in-prod";
const BASE_URL = "http://localhost:3000";

function auth() {
  return createAuth(env.DB, { secret: TEST_SECRET, baseURL: BASE_URL });
}

const OWNER = {
  email: "owner@butik.test",
  password: "correct-horse-battery",
  name: "Bu Rina",
  tenantId: "demo",
};

/** Provisions the owner exactly as scripts/provision-owner.mts does. */
async function provisionOwner() {
  await auth().api.createUser({
    body: {
      email: OWNER.email,
      password: OWNER.password,
      name: OWNER.name,
      role: "owner",
      data: { tenant_id: OWNER.tenantId },
    },
  });
}

/** Signs in and returns a Cookie header carrying the session token. */
async function signInCookie(password = OWNER.password): Promise<string> {
  const res = await auth().api.signInEmail({
    body: { email: OWNER.email, password },
    asResponse: true,
  });
  const setCookies = res.headers.getSetCookie();
  expect(setCookies.length, "sign-in should set a session cookie").toBeGreaterThan(0);
  return setCookies.map((c) => c.split(";")[0]).join("; ");
}

describe("auth: provisioned owner login", () => {
  beforeEach(provisionOwner);

  it("writes the owner to the single identity table with tenant_id + role", async () => {
    const row = await env.DB.prepare(
      `SELECT email, name, role, tenant_id FROM "user" WHERE email = ?`,
    )
      .bind(OWNER.email)
      .first<{ email: string; name: string; role: string; tenant_id: string }>();

    expect(row).toMatchObject({
      email: OWNER.email,
      name: OWNER.name,
      role: "owner",
      tenant_id: OWNER.tenantId,
    });
  });

  it("rejects an unauthenticated request (no session cookie → no session)", async () => {
    const session = await auth().api.getSession({ headers: new Headers() });
    expect(session).toBeNull();
  });

  it("rejects sign-in with the wrong password", async () => {
    await expect(
      auth().api.signInEmail({ body: { email: OWNER.email, password: "wrong" } }),
    ).rejects.toThrow();
  });

  it("round-trips a valid session and yields the correct tenant_id + role", async () => {
    const cookie = await signInCookie();

    const session = await auth().api.getSession({
      headers: new Headers({ cookie }),
    });

    expect(session).not.toBeNull();
    expect(session!.user.email).toBe(OWNER.email);
    // tenant_id + role are resolved server-side off the session user — never trusted from the client.
    expect((session!.user as { tenant_id?: string }).tenant_id).toBe(OWNER.tenantId);
    expect((session!.user as { role?: string }).role).toBe("owner");
  });

  it("does not let a client set tenant_id/role through public sign-up (input:false)", async () => {
    // Public sign-up must not be able to inject a tenant_id or elevate to owner.
    await expect(
      auth().api.signUpEmail({
        body: {
          email: "attacker@evil.test",
          password: "password123",
          name: "Mallory",
          // These are input:false + required — sign-up cannot supply them and
          // cannot succeed without them.
          tenant_id: "victim-tenant",
          role: "owner",
        } as unknown as { email: string; password: string; name: string },
      }),
    ).rejects.toThrow();
  });
});
