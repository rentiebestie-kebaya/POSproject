import { betterAuth } from "better-auth";
import { admin } from "better-auth/plugins";
import { createAccessControl } from "better-auth/plugins/access";
import { nextCookies } from "better-auth/next-js";

/**
 * Runtime better-auth config (ADR-0001, ADR-0005).
 *
 * This is the real auth instance builder — distinct from `auth.generate.ts`,
 * which exists only so the CLI can emit the schema SQL. `createAuth` binds a
 * concrete D1 database; the per-request OpenNext wrapper that reads the binding
 * from `getCloudflareContext()` lives in `auth-server.ts`, so this module has no
 * OpenNext/Workers-only imports and can be used from Node scripts and tests too.
 *
 * Identity model: a single `user` table carries `tenant_id` and the domain
 * `role` (owner | cashier | fitting). Both are `additionalFields`, so they ride
 * on `session.user` and are read server-side for tenant scoping — a
 * client-supplied `tenant_id` is never trusted (they are `input: false`, so no
 * public sign-up/update endpoint can set them; they are written only through the
 * server-side provisioning path).
 */

/** The domain roles a user can hold. The single `role` column stores one of these. */
export const DOMAIN_ROLES = ["owner", "cashier", "fitting"] as const;
export type DomainRole = (typeof DOMAIN_ROLES)[number];

export function isDomainRole(value: unknown): value is DomainRole {
  return typeof value === "string" && (DOMAIN_ROLES as readonly string[]).includes(value);
}

// Access-control statements — a copy of better-auth's default admin statements
// (user + session management verbs). We restate them here so the domain `owner`
// can be granted the full set without importing better-auth internals.
const statement = {
  user: [
    "create",
    "list",
    "set-role",
    "ban",
    "impersonate",
    "delete",
    "set-password",
    "set-email",
    "get",
    "update",
  ],
  session: ["list", "revoke", "delete"],
} as const;

const ac = createAccessControl(statement);

// ADR-0001 (resolved in ticket 02): the single `role` column serves both the
// domain role and the admin-plugin authorization. `owner` gets the full
// staff-management permission set so it can provision staff (ticket 09);
// `cashier`/`fitting` are domain roles with no admin capabilities. Every role
// the app uses must be a key here, or `adminRoles` validation throws at init.
export const roles = {
  owner: ac.newRole({
    user: [...statement.user],
    session: [...statement.session],
  }),
  cashier: ac.newRole({}),
  fitting: ac.newRole({}),
};

interface CreateAuthOptions {
  /** Signing secret. Required in production; a dev fallback is used otherwise. */
  secret?: string;
  /** Canonical origin, e.g. https://app.rentie.id. Inferred from the request when omitted. */
  baseURL?: string;
}

/**
 * Builds a better-auth instance bound to a specific D1 database. Exported so the
 * test harness can construct an instance against the test D1 directly, without
 * the OpenNext request context that `getAuth()` depends on.
 */
export function createAuth(db: D1Database, options: CreateAuthOptions = {}) {
  return betterAuth({
    // better-auth's built-in Kysely adapter detects the D1 binding and uses its
    // bundled D1 dialect — no extra adapter package needed.
    database: db,
    baseURL: options.baseURL,
    secret: options.secret ?? "dev-only-insecure-secret-change-me",
    emailAndPassword: {
      enabled: true,
      // No mail provider in Phase 0/1 — verification stays off.
      requireEmailVerification: false,
    },
    user: {
      additionalFields: {
        tenant_id: { type: "string", required: true, input: false },
        role: { type: "string", required: true, input: false },
      },
    },
    plugins: [
      admin({
        ac,
        roles,
        // Only the domain `owner` is authorized for admin endpoints (createUser, …).
        adminRoles: ["owner"],
        // Least-privilege fallback if a user is ever created without a role
        // (normal flows always set one explicitly).
        defaultRole: "cashier",
      }),
      // Must be last so it can persist Set-Cookie headers from Server Actions.
      nextCookies(),
    ],
  });
}

export type Auth = ReturnType<typeof createAuth>;
