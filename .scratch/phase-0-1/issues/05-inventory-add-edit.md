# 05 — Inventory add/edit (establishes the write pattern)

**What to build:** The owner can add a new kebaya item and edit an existing one, and the changes
persist to the real database, scoped to their shop. This is the simplest write, so it establishes
the write pattern (data-service action → RPC route → pessimistic store update → server-generated
IDs) that the POS tickets reuse.

**Blocked by:** 04 (bootstrap read + store read-swap).

**Status:** ready-for-agent

- [ ] Adding an item writes it to D1 through an RPC **action** endpoint backed by the data service,
      scoped to the session's tenant; it appears in inventory and **survives a reload**.
- [ ] Editing an item persists the change.
- [ ] IDs are **server-generated, readable, prefixed** (per CONTEXT rule 4).
- [ ] The write is **pessimistic** (ADR-0006): the UI awaits the server, applies the returned
      authoritative row to the cache, disables the control while saving, and surfaces a clear error
      on failure without corrupting the cache.
- [ ] The store's `addItem`/edit internals are swapped from in-memory mutation to the RPC call;
      `useTenant()` interface unchanged.
- [ ] Data-service tests: add persists and is tenant-scoped; edit persists; another tenant cannot
      add/edit into this tenant.
