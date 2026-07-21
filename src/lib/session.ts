import { headers } from "next/headers";
import { getAuth } from "./auth-server";
import { isDomainRole, type DomainRole } from "./auth";

/**
 * The authenticated identity as the app consumes it, derived **server-side** from
 * a validated better-auth session. `tenantId` and `role` come off the session
 * user — never from client input — so every tenant-scoped query can trust them
 * (ADR-0001, spec "Authentication & identity").
 */
export interface AppSession {
  userId: string;
  email: string;
  name: string;
  tenantId: string;
  role: DomainRole;
}

/**
 * Validates the request's session against D1 and returns the app identity, or
 * `null` if there is no valid session (or it is missing the required
 * `tenant_id`/`role`). Call from route handlers / server components — this hits
 * the database and must not run in edge middleware.
 */
export async function getAppSession(): Promise<AppSession | null> {
  const auth = await getAuth();
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;

  const user = session.user as typeof session.user & {
    tenant_id?: unknown;
    role?: unknown;
  };
  const tenantId = typeof user.tenant_id === "string" && user.tenant_id ? user.tenant_id : null;
  const role = isDomainRole(user.role) ? user.role : null;
  // A user without a tenant or a valid domain role can't be scoped safely.
  if (!tenantId || !role) return null;

  return {
    userId: user.id,
    email: user.email,
    name: user.name,
    tenantId,
    role,
  };
}
