# 01 — Prefactor: test harness + clean schema baseline

**What to build:** A working automated-test setup and a single, clean database schema that the
rest of Phase 0/1 is built on. There is no test framework in the repo today and the schema is
about to change substantially (retire the hand-rolled users table, add real auth tables, put
tenant and role on the user). This ticket lays both foundations so every later ticket can be
verified against a real local database.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] A test runner (Vitest) is configured with an integration harness that runs against a **real
      local D1** (Cloudflare Workers test pool / Miniflare), seedable per test and reset between tests.
- [ ] `npm test` (or equivalent) runs green in a clean checkout.
- [ ] better-auth's schema is generated via its CLI (Kysely/SQLite adapter → plain SQL) and the
      emitted SQL is **folded into a single clean migration baseline** alongside the domain tables.
- [ ] The domain schema no longer has a standalone `users` table; `tenant_id` and `role`
      (`owner` | `cashier` | `fitting`) live on the identity/user model (per ADR-0001).
- [ ] The baseline applies cleanly to **both** local and remote D1 (existing fictional seed data
      may be discarded — pre-launch, per ADR-0005).
- [ ] A smoke test proves the harness + schema: insert a tenant and read it back.
- [ ] `better-auth migrate` is NOT used against D1; all schema changes flow through
      `wrangler d1 migrations` (per ADR-0005 research update).
