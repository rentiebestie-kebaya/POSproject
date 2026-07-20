---
title: RENTIE Phase 0 + Phase 1 — Make it real & free-tier POS on D1
status: ready-for-agent
created: 2026-07-20
sources:
  - CONCEPT.md
  - CONTEXT.md
  - docs/adr/0001-identity-and-tenancy-model.md
  - docs/adr/0002-data-flow-and-caching.md
  - docs/adr/0003-seed-and-demo-data.md
  - docs/adr/0004-rpc-action-api-atomic-writes.md
  - docs/adr/0005-migration-strategy.md
  - docs/adr/0006-pessimistic-writes.md
  - docs/research/better-auth-on-d1.md
---

# RENTIE Phase 0 + Phase 1 — Spec

## Problem Statement

RENTIE today is a polished front-end demo, not a product. Every screen works, but all data
lives in the browser's `localStorage` on a single device, and "logging in" means picking a name
off a list. A real kebaya butik owner cannot trust this with their business: close the tab on a
different computer and the data is gone; anyone can "become" any staff member; there is no real
account and no real record of a rental. The owner needs RENTIE to be a genuine, multi-user,
persistent system they can run their shop's daily same-day rentals through — a real **book of
record** for money taken — before they will rely on it.

## Solution

Make RENTIE real for one tenant, end-to-end, without adding new user-facing features beyond what
the demo already shows.

- **Phase 0 (foundation, invisible to users):** replace fake auth with real accounts
  (`better-auth` on D1), move the source of truth from `localStorage` to the D1 database, and
  wire the existing client store to a real backend through one bootstrap read and a set of
  server-side action endpoints — all scoped to the signed-in tenant on the server.
- **Phase 1 (free-tier POS end-to-end):** the owner and their cashiers log in with real
  accounts and run **same-day, record-only** rentals through the POS against real, persisted
  data: checking items out, recording how the customer paid, taking a deposit, printing a
  receipt, and later closing the rental (recording late/damage fees and returning the deposit).
  Inventory, customers, and basic finance all read and write real data. The owner can provision
  staff accounts.

When Phase 1 lands, the design-partner butik can run real rentals on RENTIE from any device, and
the data is safe, private to their shop, and correct.

## User Stories

### Authentication & accounts (Phase 0 + Phase 1)

1. As a butik owner, I want to sign in with a real email and password, so that only I and my
   staff can access my shop's data.
2. As a butik owner, I want my session to persist across page reloads and devices, so that I can
   run my shop from the counter, the back office, or my phone.
3. As a butik owner, I want to sign out, so that I can leave a shared computer safely.
4. As a butik owner, I want my account to be tied to exactly one shop (tenant), so that I only
   ever see and touch my own shop's data.
5. As a butik owner, I want to add a staff member (cashier or fitting) by creating their account
   with an initial password, so that my team can use RENTIE without me sharing my own login.
6. As a cashier, I want to sign in with the account my owner created for me, so that my actions
   (e.g. who rang up a sale) are recorded under my name.
7. As a fitting staff member, I want to sign in with my own account, so that my role's
   permissions and my name are correctly attributed.
8. As a butik owner, I do not want random people on the internet to be able to self-register into
   my shop, so that my team stays controlled (staff are provisioned by me, not self-service).
9. As a butik owner, I want to run RENTIE in Phase 0/1 without setting up email delivery, so that
   I am not blocked on a mail provider before going live (email verification off for now).
10. As a founder/developer, I want to provision the one design-partner tenant and owner account
    directly (not via a public signup funnel), so that onboarding one known shop takes minutes.

### Persistence & tenant isolation (Phase 0)

11. As a butik owner, I want everything I enter to be saved in a real database, so that my data
    survives closing the tab, switching devices, and clearing the browser.
12. As a butik owner, I want my shop's data to be completely invisible to any other shop on
    RENTIE, so that my customers and finances stay private.
13. As a butik owner, I want the system to load my shop's current data when I sign in, so that I
    see an accurate, up-to-date picture immediately.
14. As a cashier, I want two people working the shop to see each other's changes after a refresh,
    so that we don't step on each other during a busy day.

### Free-tier POS — checkout / open (Phase 1)

15. As a cashier, I want to select one or more available kebaya items for a same-day rental, so
    that I can ring up a walk-in customer.
16. As a cashier, I want the system to refuse to rent an item that is not currently available, so
    that I never accidentally double-rent a piece that is already out.
17. As a cashier, I want to enter or look up the customer by WhatsApp number, so that repeat
    customers are recognized instead of duplicated.
18. As a cashier, I want a new customer to be created automatically at checkout when their
    WhatsApp number is not on file, so that I don't do separate data entry.
19. As a cashier, I want to record how the customer paid (QRIS, GoPay, OVO, DANA, Cash, or Card),
    so that RENTIE is an accurate record of the money taken.
20. As a cashier, I want to take a deposit and record its amount, so that the shop is protected
    against damage or non-return.
21. As a cashier, I want to record the rental total, base rental, and any extra-day fee, so that
    the receipt and finance figures are correct.
22. As a cashier, I want to attach evidence (e.g. an ID photo / client photo reference) to a
    checkout, so that the shop has proof for high-value rentals.
23. As a cashier, I want the checked-out items to immediately show as "rented", so that nobody
    else can rent them while they're out.
24. As a cashier, I want a receipt for the transaction, so that I can give the customer proof of
    payment and deposit.
25. As a cashier, I want the whole checkout to either fully succeed or fully fail, so that I never
    end up with an item marked rented but no recorded payment (or vice versa).
26. As a cashier, I want the checkout button to be disabled while the sale is being saved and to
    show me a clear error if it fails, so that I don't submit twice or assume a failed sale
    succeeded.

### Free-tier POS — return / close (Phase 1)

27. As a cashier, I want to close an active rental when the customer returns the items, so that
    the pieces become available again.
28. As a cashier, I want to record a late fee when items are returned late, so that the finance
    record reflects the extra charge.
29. As a cashier, I want to record a damage fee and how much of the deposit is returned, so that
    deductions are documented.
30. As a cashier, I want the returned items to move back to "available" (or to "maintenance" if
    they need cleaning), so that inventory status stays truthful.
31. As a cashier, I want the close transaction to be atomic too, so that a return is never half
    recorded.

### Inventory (Phase 1)

32. As a butik owner, I want to add a kebaya item with its details (name, code, size, model,
    color, wear style, measurements, rental price, condition grade, etc.), so that it's available
    to rent.
33. As a butik owner, I want to edit an item's details, so that I can correct mistakes or update
    pricing.
34. As a butik owner, I want to see my full inventory with current status, so that I know what's
    available, rented, or in maintenance.
35. As a cashier, I want inventory to reflect real-time status from the database, so that I never
    try to rent something that's already out.

### Customers (Phase 1)

36. As a butik owner, I want customers to be de-duplicated by their normalized WhatsApp number,
    so that one person isn't split across many records.
37. As a butik owner, I want a customer's total rentals and last-rental date to update when they
    rent, so that I can recognize my repeat customers.
38. As a butik owner, I want to see my customer list, so that I know who my shop serves.

### Finance (basic, Phase 1)

39. As a butik owner, I want to see the transactions recorded through POS, so that I can reconcile
    the day's takings.
40. As a butik owner, I want basic revenue figures derived from real transactions, so that I have
    an honest picture of income.

### Demo / test (Phase 0)

41. As a founder/developer, I want a reproducible seed script that creates one fully-populated
    demo tenant and a known owner login on my local database, so that I can click through a
    realistic shop instantly and reset it anytime.
42. As a founder/developer, I want the demo data to look real (reshaped from the existing
    realistic seed), so that the product is convincing when I eventually show it.

### Schema / migrations (Phase 0)

43. As a founder/developer, I want a single clean schema baseline (including the auth tables and
    the domain tables with tenant/role on the user), so that the database is easy to reason about
    before launch.
44. As a founder/developer, I want to be able to reset and re-apply the database while pre-launch,
    so that I can iterate on the schema without migration scar tissue.

## Implementation Decisions

Grounded in the accepted ADRs; see each ADR for rationale.

### Authentication & identity (ADR-0001, research)

- Adopt **`better-auth`** with its **built-in Kysely adapter over native D1** — the D1 binding
  (`DB`) is passed directly to the auth instance; no separate `kysely-d1`/Drizzle dependency.
- **Single identity table.** `tenant_id` and `role` (`owner` | `cashier` | `fitting`) are added
  as **user additional fields**, surfaced on `session.user`. The standalone hand-rolled `users`
  table and its seed rows are retired.
- On the Workers/OpenNext runtime, bindings exist **per request**; the auth instance is built by
  a **lazy factory** that reads the binding via `getCloudflareContext().env.DB` inside the
  request handler — never at module top level. The better-auth Next handler is mounted at the
  App Router catch-all auth route, with the cookie and admin plugins enabled.
- **Owner self-signs-up** passing `tenant_id` + `role: "owner"`. **Staff are provisioned by the
  owner** through the **admin plugin's create-user API** with a preset `tenant_id` + role and an
  initial password. Staff never self-register. (Public self-serve signup is out of scope — see
  Out of Scope.)
- **Email + password only, email verification disabled** for Phase 0/1, so no mail provider is
  required.
- **OPEN IMPLEMENTATION DECISION (must be resolved during the auth work):** better-auth's admin
  plugin has its own `role`/authorization concept that may collide with RENTIE's domain `role`.
  Decide between (a) configuring `adminRoles` so the domain `owner` is authorized to call
  create-user, or (b) keeping a **separate admin-authorization field** distinct from the domain
  `role`. This was not traceable to a primary source; verify concretely in code.

### Data flow & the store seam (ADR-0002)

- Keep the client store's public interface (`useTenant()`) **unchanged**; swap its internals from
  `localStorage` to `fetch()`. The ~13 views are not restructured.
- **Bootstrap-and-cache:** on login, a single read endpoint returns the signed-in tenant's
  **entire** dataset (inventory, customers, bookings, transactions, monthly revenue, team, plan
  rules) to hydrate the store. Views continue to read synchronously.
- **Boundary recorded for later:** client-side availability checks are acceptable only for
  Phase 1 (record-only, same-day). The forward-booking availability engine (Phase 2) must be
  server-authoritative.

### Backend architecture & writes (ADR-0004, ADR-0006)

- **RPC action endpoints** mirror the store's verbs (e.g. an `open` action, a `close` action, an
  inventory `add`/`edit` action, a staff `provision` action, plus the `bootstrap` read).
- **The single test seam is a server-side tenant-scoped data service**: the D1-backed
  implementation of these verbs, with the shape
  `(db, sessionContext{ tenantId, role, userName }, input) → authoritative rows`. All domain
  logic, invariants, and atomicity live here. The route handlers are thin adapters that resolve
  the better-auth session, derive `tenantId`/`role`, call the service, and return its rows.
- **Tenant isolation is server-side and inviolable:** `tenantId` comes from the validated
  session; every query is scoped `WHERE tenant_id = <session tenant>`. A client-supplied tenant
  id is never trusted.
- **Multi-table actions are atomic** via a single D1 `batch()`. The checkout (`open`) action
  writes across customer (upsert), booking (+ join rows), transaction (+ join rows), and
  inventory status/`times_rented` in one all-or-nothing batch; the `close` action is likewise
  atomic. Each action **re-validates its core invariant server-side inside the write** — for the
  free tier, that items belong to the tenant and are `status = 'available'`.
- **Writes are pessimistic:** the client awaits the batch and applies the **server-returned
  authoritative rows** to the store cache; on failure it surfaces the error and leaves the cache
  untouched. No optimistic mutation, no rollback logic.
- **IDs are server-generated, readable, prefixed** (e.g. `T-…` transactions, `B-…` bookings,
  `C-…` customers) with enough randomness to avoid collisions; tenant ids remain slugs.

### Schema & migrations (ADR-0005, research)

- **Rewrite to a single clean baseline** while pre-launch (zero real data): better-auth's
  generated auth tables + the domain tables, with `tenant_id`/`role` on the user, and no
  standalone `users` table. Reset local + remote D1 and apply.
- Generate better-auth's schema with the CLI's **generate** command (Kysely/SQLite adapter emits
  plain `schema.sql`) and **fold that SQL into the baseline**. Do **not** run better-auth's
  `migrate` against D1 (the CLI cannot reach the binding); all schema changes flow through
  `wrangler d1 migrations`.
- **Forward-only migrations activate the moment the design partner has real data.**

### Seed & demo (ADR-0003)

- A reproducible **dev-local seed script** reshapes the existing realistic seed data into **one
  demo tenant** + a **demo owner account** (known email + password), applied to **local D1 only**.
  This seeded owner login is the developer's demo/test account. Production starts clean.
- The production, nightly-reset demo tenant is deferred to Phase 3.

## Testing Decisions

- **What makes a good test here:** it asserts **external behavior** at a seam, not
  implementation details. For the data service, that means: given a starting D1 state and an
  input, the returned authoritative rows and the resulting persisted rows are correct — including
  the negative cases (invariant violations rejected) and atomicity (a rejected action leaves
  **no** partial writes). Tests should not assert on internal function calls or private structure.
- **Primary seam under test — the tenant-scoped data service.** Integration tests run the real
  service against a **real local D1** (via the Cloudflare Workers test pool / Miniflare), seeded
  per test. Coverage:
  - `open` (checkout): happy path writes all four areas correctly and returns an authoritative
    receipt; renting an unavailable item is rejected with **no** partial write (atomicity);
    an existing customer (by normalized WhatsApp) is updated not duplicated; a new customer is
    created; item status flips to `rented` and `times_rented` increments.
  - `close` (return): late fee / damage fee / deposit-return recorded; item returns to
    `available`/`maintenance`; atomic.
  - inventory `add`/`edit`: persisted and scoped to tenant.
  - `bootstrap`: returns exactly the calling tenant's data and nothing from another tenant.
- **Auth boundary — thin, targeted tests at the route/adapter level:** an unauthenticated request
  is rejected; a request scoped to tenant A cannot read or mutate tenant B's data
  (cross-tenant isolation); an owner can provision a staff account, a cashier cannot.
- **Tenant isolation is explicitly tested** by seeding two tenants and asserting no read or write
  crosses the boundary.
- **Prior art:** none — there is no test framework in the repo yet. This spec establishes the
  pattern: **Vitest** as the runner with a **local D1** integration harness. Keep the harness at
  the highest seam (the data service) so the suite stays fast and transport-independent; add HTTP
  route tests only for the auth boundary.
- The existing client store's thin `fetch()` wrappers and the unchanged views do not get new
  unit tests in this phase; their behavior is exercised end-to-end via the service + a manual
  smoke pass in the running app.

## Out of Scope

- **Public self-serve signup and the onboarding funnel** (deferred to Phase 4). The one tenant is
  provisioned manually.
- **Payment processing, online deposits, QRIS generation, gateways (Midtrans/Xendit), refunds
  through RENTIE** — RENTIE is record-only. Deferred indefinitely.
- **Automated subscription billing / plan-purchase flows.** Plans are set/changed manually.
- **Starter-tier forward bookings, the booking calendar, and the server-authoritative
  availability/conflict engine** (Phase 2).
- **Pro-tier features:** public booking page, customer analytics, receipt branding, export
  (Phase 3).
- **Superadmin / cross-tenant platform tooling** beyond what's needed to provision the one tenant
  (Phase 4).
- **Production demo tenant** with nightly reset (Phase 3).
- **Email delivery / verification, password reset via email, WhatsApp OTP** (later).
- **Rewriting the 13 views** — they stay behind the unchanged `useTenant()` interface.

## Further Notes

- The whole plan hinges on the `useTenant()` store interface holding steady. It is clean today;
  guard against interface drift during the first implementation slice.
- `better-auth` is pre-2.0 and fast-moving; **pin the version** and re-run schema `generate`
  after any upgrade, reconciling the emitted SQL into a new forward migration once post-launch.
- The smoothest OpenNext wiring is demonstrated by a community package; prefer **replicating its
  small `getCloudflareContext()` per-request wiring in-repo** over depending on a pre-1.0 package,
  to avoid a fragile dependency (decide during implementation).
- Suggested build order (blockers first) for the follow-on `to-tickets` pass: schema baseline +
  auth → data service + bootstrap → store swap → POS `open` → POS `close` → inventory/customers/
  finance reads/writes → owner-provisions-staff → dev seed script. Each slice should be a
  tracer-bullet that keeps the app runnable.
