# ADR-0002 — Data-flow & caching strategy

**Status:** Accepted (2026-07-20)

## Context

The client store (`src/data/store.tsx`) currently holds a tenant's **entire** dataset in memory
(from `seedData`) and every view reads it **synchronously** — no loading states. We are swapping
the store's internals from `localStorage` to real persistence via API routes (architecture A,
chosen because it keeps the ~5,600 lines of views almost untouched). We must decide how the
in-memory cache gets filled. Target scale is ~80 items and a few hundred rows per tenant — tiny.

## Decision

**Bootstrap-and-cache.** On login, one request `GET /api/bootstrap` returns the tenant's full
dataset into the store, mirroring how it loads `seedData` today. Views keep reading
synchronously. Mutations go through RPC routes ([ADR-0004](./0004-rpc-action-api-atomic-writes.md))
and update the cache with the server's authoritative response
([ADR-0006](./0006-pessimistic-writes.md)).

## Consequences

- Near-zero changes to existing views — the whole point of architecture (A).
- "Fetch everything on login" is negligible at this scale.
- **Boundary to honor:** with a client-side cache, availability/conflict logic computed in the
  browser is acceptable **only** for Phase 1 (record-only, same-day, effectively one register).
  When the forward-booking availability engine lands in **Phase 2**, conflict checks MUST become
  **server-authoritative** (concurrent cashiers / race conditions cannot be trusted to client
  memory). Navigation-time refetch covers staleness in the interim.
