# ADR-0003 — Seed & demo-data strategy

**Status:** Accepted (2026-07-20)

## Context

[ADR-0001](./0001-identity-and-tenancy-model.md) retires the seeded `users` table, so the
current `melati`/`ayu` seed goes away. We need (a) a fast local test loop with a populated shop,
and (b) eventually a way to show prospects a filled-in product. `src/data/mock.ts` (781 lines)
already contains realistic kebaya inventory, customers, bookings, and transactions.

## Decision

**Dev-local seed now; production demo later ((A) now, (B) as an easy add).**

- **Now:** a reproducible seed script reshapes `mock.ts` into **one demo tenant** ("Kebaya Demo")
  + a demo **owner account** (better-auth, known email + password), applied to **local D1 only**.
  Production starts clean (only the real design partner). Re-running resets it. This seeded owner
  login is the developer's demo/test account from day one of Phase 0.
- **Later (Phase 3+, when pitching prospects):** promote the same seed to a **locked,
  nightly-reset production demo tenant** as a sales tool.

## Consequences

- `mock.ts` becomes the **canonical seed source** — keep it realistic.
- Production is never polluted with fake shops during Phase 0/1.
- The production demo (reset job + analytics isolation) is deferred until it earns its keep.
