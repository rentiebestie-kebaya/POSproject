# ADR-0001 — Identity & tenancy model

**Status:** Accepted (2026-07-20)

## Context

Auth is currently faked ("pick a user from a list"). The `users` table carries only
`id, tenant_id, name, role` — no email, no password. We are adopting `better-auth` on D1,
which manages its own tables (`user`, `session`, `account`, `verification`). RENTIE also needs
two things better-auth doesn't model: **`tenant_id`** (which shop) and **`role`**
(owner / cashier / fitting). These two identity models must reconcile.

## Decision

**Use a single identity table.** Extend better-auth's `user` table with `tenant_id` and `role`
via its "additional fields" mechanism, and **retire the standalone app `users` table** (and its
seed rows). One source of truth for identity.

- Owner **self-signs-up** → writes `tenant_id` (new) + `role: owner`.
- Staff are **provisioned by the owner** via better-auth's admin create-user API, with the
  owner's `tenant_id` and `role: cashier | fitting`. Staff never self-register.
- Every tenant-scoped API route reads `tenant_id` + `role` off the authenticated session user.

## Consequences

- No two-row-per-person sync problem; `tenant_id`/`role` are just columns on the session user.
- The hand-rolled `users` table and its seed users are removed; references that named a user
  (e.g. `transactions.cashier_name`) resolve against the new identity table.
- Forces the schema rewrite handled in [ADR-0005](./0005-migration-strategy.md).
- Maps cleanly onto the owner-provisions-staff model already assumed in the product.

## Research update (2026-07-20)

Confirmed viable against primary sources — see
[`docs/research/better-auth-on-d1.md`](../research/better-auth-on-d1.md). Refinements:

- `tenant_id` + `role` go under **`user.additionalFields`** (not session-table additionalFields),
  which makes them appear on `session.user`.
- Owner self-signup passes `tenant_id` + `role: "owner"`; staff are provisioned by the owner via
  the **admin plugin**: `auth.api.createUser({ email, password, name, data: { tenant_id, role } })`.
  No self-registration for staff — exactly as specified.
- **OPEN RISK to resolve before/during spec:** better-auth's **admin plugin has its own
  `role`/authorization concept** (who may call `createUser`, etc.), which may collide with
  RENTIE's domain `role` (owner/cashier/fitting). Decide whether to (a) configure `adminRoles`
  so `owner` is authorized to create users, or (b) keep a **separate** admin-authorization field
  distinct from the domain `role`. This was not fully traceable to a primary source — verify it
  concretely when implementing auth.

## Resolution: admin-role vs domain-role collision (2026-07-21, ticket 02)

**Decision: option (a) — reuse the single `role` column; authorize the domain `owner` for admin
endpoints via the admin plugin's `adminRoles`, backed by an access-control `roles` map.**

Verified concretely against the installed `better-auth@1.6.23`, which the earlier research could not
trace to a primary source:

- `AdminOptions` does expose `adminRoles` (default `["admin"]`) and `defaultRole` (default `"user"`)
  — confirmed in `node_modules/better-auth/dist/plugins/admin/types.d.mts`.
- **Constraint found in code:** the admin plugin *throws at init* if any `adminRoles` value is not a
  key in the plugin's `roles` map (or the built-in defaults). So `adminRoles: ["owner"]` is only
  valid alongside a `roles` map that defines `owner`. (`admin.mjs`: `Invalid admin roles … must be
  defined in the 'roles' configuration`.)
- `createUser`/`setRole` also reject a role that isn't in `roles`, so every domain role the app uses
  must appear in the map.

**Implementation** (`src/lib/auth.ts`): a `createAccessControl` statement (a copy of better-auth's
default admin user/session verbs) backs three roles — `owner` gets the full permission set (so it can
provision staff in ticket 09), `cashier` and `fitting` get none. The plugin is configured with
`adminRoles: ["owner"]` and `defaultRole: "cashier"` (least-privilege fallback). One `role` column
therefore serves both the domain role and admin authorization, keeping the single-identity-table
decision above intact — no separate admin-authorization field is introduced.

`tenant_id` and `role` are `additionalFields` with `input: false` + `required: true`: no public
sign-up/update endpoint can set them, so a client-supplied `tenant_id` is never trusted. The owner is
bootstrapped server-side via `auth.api.createUser` (called with no session, which skips the admin
gate for the first user) in `scripts/provision-owner.mts`; that path writes `tenant_id`/`role`
through the internal adapter, bypassing the `input: false` restriction that blocks the public schema.
