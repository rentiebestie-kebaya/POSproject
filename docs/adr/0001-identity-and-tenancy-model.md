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
