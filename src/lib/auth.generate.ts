import Database from "better-sqlite3";
import { betterAuth } from "better-auth";
import { admin } from "better-auth/plugins";

/**
 * Schema-generation-only better-auth config (ADR-0005).
 *
 * This file exists solely so `@better-auth/cli generate` can emit the auth-table
 * SQL (Kysely/SQLite adapter) that we fold into the clean migration baseline. It
 * is NOT the runtime auth instance — the per-request `getCloudflareContext()`
 * factory that wires the real D1 binding is built in the auth ticket (02).
 *
 * The `database` here is a throwaway in-memory better-sqlite3 handle only so the
 * CLI selects the Kysely/SQLite adapter; D1 is SQLite under the hood, so the
 * emitted DDL matches what D1 wants.
 *
 * Identity model (ADR-0001): a single user table carries `tenant_id` and the
 * domain `role` (owner | cashier | fitting). The admin plugin (which the owner
 * uses to provision staff) supplies the `role` column; marking `role` required
 * only tightens it to NOT NULL so every user always has one — the actual role
 * VALUES, `adminRoles` authorization, and the binding wiring are runtime
 * concerns deliberately left to the auth ticket (02). No default is set here so
 * the schema never bakes in a privilege default; `tenant_id` is the one field we
 * add outright.
 */
export const auth = betterAuth({
  database: new Database(":memory:"),
  emailAndPassword: {
    enabled: true,
  },
  user: {
    additionalFields: {
      tenant_id: { type: "string", required: true, input: false },
      role: { type: "string", required: true, input: false },
    },
  },
  plugins: [admin()],
});
