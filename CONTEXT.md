# RENTIE — CONTEXT

Working glossary and architecture reference for RENTIE. Pairs with [`CONCEPT.md`](./CONCEPT.md)
(what/who/why) — this file is the **how** and the **shared vocabulary**. Decisions with
hard-to-reverse consequences are recorded as ADRs in [`docs/adr/`](./docs/adr/).

Last updated: 2026-07-20.

## Where things are

| Area | Location |
|---|---|
| Views (UI, ~5,600 lines) | `src/views/*.tsx` |
| Client data store (the seam) | `src/data/store.tsx` — pages read via `useTenant()` |
| Domain types + realistic seed data | `src/data/mock.ts` |
| Plan rules / gating | `src/data/plans.ts` |
| DB schema | `migrations/*.sql` (to be rewritten — see [ADR-0005](./docs/adr/0005-migration-strategy.md)) |
| Cloudflare / D1 binding | `wrangler.jsonc` (binding `DB`, database `rentie-db`) |
| Health check | `app/api/d1/health/route.ts` |

## Glossary

- **Tenant** — one kebaya butik (shop). The unit of isolation. Identified by a slug
  (`melati`). Every domain row carries `tenant_id`.
- **Owner / Cashier / Fitting** — the three staff **roles**. The owner self-signs-up (creating
  the tenant) and provisions staff; staff never self-register. See
  [ADR-0001](./docs/adr/0001-identity-and-tenancy-model.md).
- **Plan** — `free` / `starter` / `pro`. Gates features via `plans.ts`. See `CONCEPT.md` for
  the tier logic (Free = today's cash register; Starter = booking-ahead; Pro = growth).
- **POS (record-only)** — RENTIE records *how* a customer paid (QRIS/GoPay/OVO/DANA/Cash/Card);
  it does **not** process payments. RENTIE is the **book of record**. (`CONCEPT.md`)
- **Open transaction** — a POS checkout: a single logical action that writes four tables
  (upsert `customer`, insert `booking` + `booking_items`, insert `transaction` +
  `transaction_items`, update `inventory_items` → `rented`). Must be atomic —
  [ADR-0004](./docs/adr/0004-rpc-action-api-atomic-writes.md).
- **Close transaction** — a return: records late/damage fees, deposit return, sets item back to
  `available` (or `maintenance`).
- **Booking request** — a Pro public-page reservation (reserve-only; deposit collected offline).
- **Availability / conflict engine** — prevents double-booking. In Free it collapses to
  `status = 'available'` (same-day only); the full forward-calendar engine is a Starter feature
  and becomes **server-authoritative in Phase 2**
  ([ADR-0002](./docs/adr/0002-data-flow-and-caching.md)).
- **The store seam** — `useTenant()` in `src/data/store.tsx`. Pages read *only* through it.
  Under architecture (A) its internals swap from `localStorage` to `fetch()` while the
  interface stays fixed.
- **Bootstrap** — `GET /api/bootstrap`: returns the signed-in tenant's *entire* dataset on
  login, hydrating the store cache ([ADR-0002](./docs/adr/0002-data-flow-and-caching.md)).
- **RPC action route** — a `POST /api/<domain>/<verb>` endpoint mirroring a store mutation
  (e.g. `/api/pos/open`). See [ADR-0004](./docs/adr/0004-rpc-action-api-atomic-writes.md).

## Architecture rules (inviolable)

1. **Tenant isolation is server-side.** Every route derives `tenant_id` from the better-auth
   session and scopes D1 queries with `WHERE tenant_id = <session tenant>`. Never trust a
   client-supplied `tenant_id`.
2. **Multi-table writes are atomic** D1 `batch()` calls, and re-validate their core invariant
   (items belong to this tenant *and* are available) server-side, inside the write.
3. **Writes are pessimistic** — the client awaits the batch and applies the server's returned
   authoritative rows to the cache. No optimistic mutation, no rollback code.
   ([ADR-0006](./docs/adr/0006-pessimistic-writes.md))
4. **IDs are server-generated, readable, prefixed** — `T-8F3K2`, `B-…`, `C-…` (prefix + short
   random). Tenant IDs are slugs. POS IDs get read aloud; keep them legible.
5. **Pre-launch: rewrite the schema baseline freely.** The day the design partner has real
   data, switch to forward-only migrations
   ([ADR-0005](./docs/adr/0005-migration-strategy.md)).

## Scope guardrails (Phase 0/1)

- **No public self-serve signup** — provision the one design-partner tenant manually; Phase 0
  auth is **login / session / logout** only. (Signup funnel = Phase 4.)
- **No payment processing, no online deposits, no automated billing** — all deferred; RENTIE is
  record-only.
- **Demo/test account** = the seeded owner login on a **dev-local** demo tenant (data reshaped
  from `mock.ts`). A locked, nightly-reset production demo is a Phase 3 add.
  ([ADR-0003](./docs/adr/0003-seed-and-demo-data.md))

## Build phases (from CONCEPT.md)

- **Phase 0** — make it real: auth, clean schema, seed script, bootstrap + RPC write layer, store swap.
- **Phase 1** — free-tier POS on D1 end-to-end + owner-provisions-staff. *Deliverable: real same-day rentals.*
- **Phase 2** — Starter: forward bookings + server-authoritative availability engine.
- **Phase 3** — Pro: public booking (reserve-only), analytics, branding, export; production demo tenant.
- **Phase 4** — SaaS ops: self-serve signup (Free default), manual plan upgrades, superadmin tooling.
