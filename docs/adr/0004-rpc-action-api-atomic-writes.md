# ADR-0004 — RPC action API + atomic batched writes

**Status:** Accepted (2026-07-20)

## Context

The store interface is **action-shaped**, not CRUD-shaped: `openTransaction`, `closeTransaction`,
`addItem`, `createReservation`. Critically, `openTransaction` is one logical action that writes
**four tables** (upsert `customer`; insert `booking` + `booking_items`; insert `transaction` +
`transaction_items`; update `inventory_items`). A partial failure would corrupt state (item
`rented` with no transaction, booking with no customer).

## Decision

**RPC action endpoints mirroring the store's verbs** — `POST /api/pos/open`, `POST /api/pos/close`,
`POST /api/inventory/add`, `POST /api/bookings/reserve`, etc. Each store method's body becomes a
`fetch()` to its matching route: a mechanical 1:1 swap.

Two rules baked in:

1. **Atomicity** — every multi-table action executes as a single D1 `batch()` (all-or-nothing).
2. **Server-side invariant re-validation** — the route re-checks "these items belong to this
   tenant *and* are `available`" *inside* the write, reading `tenant_id` from the session
   ([ADR-0001](./0001-identity-and-tenancy-model.md)), never trusting the client's optimistic
   check. In Free (same-day only) this collapses to a `status = 'available'` guard.

## Consequences

- The `localStorage` → `fetch()` swap is mechanical because routes match existing store verbs.
- Composite writes have a natural single home; no client-side orchestration of multiple calls.
- REST was rejected: `openTransaction` spans four resources, forcing either multiple client
  calls (loses atomicity) or a non-RESTy composite endpoint anyway.
