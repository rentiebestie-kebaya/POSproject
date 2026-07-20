# ADR-0005 — Migration strategy

**Status:** Accepted (2026-07-20)

## Context

`0001_initial_rentie_schema.sql` is already applied to local **and** remote D1, but holds only
fictional seed data (`melati`/`ayu`) — no real user data. [ADR-0001](./0001-identity-and-tenancy-model.md)
reshapes identity substantially (retire `users`, add better-auth tables, put `tenant_id`/`role`
on `user`), and better-auth generates its auth tables via its own CLI rather than hand-written SQL.

## Decision

**Rewrite the migration baseline now; switch to forward-only once real data exists.**

- Because we are pre-launch with zero real data, reset D1 (local + remote) and fold everything
  into **one clean baseline**: better-auth's generated auth tables + the domain tables, with
  `tenant_id`/`role` as better-auth additional fields on `user`, and no standalone `users` table.
- Sequence: better-auth CLI generates auth tables → hand-author domain tables → collapse into a
  fresh baseline → reset D1 → apply.
- **Hard rule:** the day Phase 1 goes live with the design partner's real rentals,
  **forward-only migrations** take over — applied migrations are never edited again.

## Consequences

- A single coherent schema instead of compensating migrations layered over a design we've
  already decided to change — easier for humans and agents to reason about.
- One-time cost: resetting the already-applied remote D1 (acceptable — data is fake).
- Migration discipline is deferred, not abandoned; it activates at first real data.

## Research update (2026-07-20)

Confirmed against primary sources — see
[`docs/research/better-auth-on-d1.md`](../research/better-auth-on-d1.md):

- `better-auth generate` with the Kysely/SQLite adapter emits a **`schema.sql`** file (plain SQL,
  not ORM model files). Fold that SQL into the hand-authored baseline, reset D1, then
  `wrangler d1 migrations apply`.
- **Do NOT use `better-auth migrate` against D1** — the CLI cannot reach the D1 binding. Schema
  changes flow through our own `wrangler d1 migrations`, with better-auth's generated SQL folded in.
- Re-run `better-auth generate` after any better-auth version bump and reconcile the emitted SQL
  into a new forward migration (once post-launch forward-only is in effect).
