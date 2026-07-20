# 04 — Bootstrap read + store read-swap

**What to build:** When the owner signs in, the app loads their real shop data from the database
instead of from `localStorage`. Every read screen (dashboard, inventory, customers, finance,
team) shows real, persisted, tenant-scoped data. A different shop sees only its own data.

**Blocked by:** 03 (dev seed — there must be real data to show).

**Status:** ready-for-agent

- [ ] A single `bootstrap` read endpoint returns the **signed-in tenant's entire dataset**
      (inventory, customers, bookings, transactions, monthly revenue, team, plan rules), scoped
      server-side by the session's tenant (per ADR-0002 / ADR-0004).
- [ ] The client store's **read** internals are swapped from `localStorage`/seed to the bootstrap
      fetch; the `useTenant()` interface is **unchanged** and the existing views are not
      restructured.
- [ ] Reads are backed by the **server-side tenant-scoped data service** (the single test seam),
      not ad-hoc queries in the route.
- [ ] Logging in as the demo owner shows the seeded shop; the data survives a reload.
- [ ] **Tenant isolation is proven**: seed a second tenant; assert bootstrap returns only the
      caller's data and nothing from the other tenant.
- [ ] Tests at the data-service seam cover the bootstrap read + isolation; a route-level test
      confirms a cross-tenant request cannot read another tenant's data.
