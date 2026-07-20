# 08 — Basic finance from real transactions

**What to build:** The owner sees an honest basic finance picture derived from the real
transactions recorded through POS — the day's takings and basic revenue — not mock numbers.

**Blocked by:** 07 (POS return — both open and close money flows must exist).

**Status:** ready-for-agent

- [ ] The Finance view's figures are derived from **real recorded transactions** for the tenant
      (checkout takings, deposits, late/damage fees), scoped server-side.
- [ ] Basic revenue is correct and reconciles with the transactions list (whether computed on the
      fly from transactions or via the monthly-revenue rollup — implementer's call, recorded).
- [ ] Reads go through the data service / bootstrap; no mock finance data remains in the free-tier
      view.
- [ ] Data-service test: given a set of seeded transactions, the finance figures match the expected
      totals and are tenant-scoped.
