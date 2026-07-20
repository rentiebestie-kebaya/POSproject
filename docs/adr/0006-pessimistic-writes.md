# ADR-0006 — Pessimistic writes returning authoritative server state

**Status:** Accepted (2026-07-20)

## Context

With bootstrap-and-cache ([ADR-0002](./0002-data-flow-and-caching.md)), the in-memory cache and
D1 must reconcile on every mutation. The POS handles real money and item availability, and
`openTransaction` touches four tables ([ADR-0004](./0004-rpc-action-api-atomic-writes.md)), so an
optimistic-update-then-rollback approach would require fiddly, bug-prone rollback for composite
actions.

## Decision

**Pessimistic writes, uniformly.** The client disables the control, `await`s the server's atomic
batch, and on success applies the **server's returned authoritative rows** (created booking /
transaction, updated items) to the cache. On failure it surfaces the error and leaves the cache
untouched. No optimistic mutation, no rollback code.

## Consequences

- One write pattern; no rollback logic to get wrong; the cache is always exactly D1.
- Dissolves the ADR-0002 drift concern: since writes are never optimistic, the cache can only go
  stale from *another* user's concurrent write — handled by navigation-time refetch in Phase 1
  and the server-authoritative conflict engine in Phase 2.
- Cost accepted: a sub-second spinner during each write round-trip. Correctness over snappiness
  for a money-handling POS.
