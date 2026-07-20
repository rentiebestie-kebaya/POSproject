# 06 — POS checkout (`open`) — atomic same-day rental

**What to build:** The wedge. A cashier rings up a walk-in same-day rental through the POS: pick
one or more available items, identify the customer by WhatsApp, record how they paid and the
deposit, and get a receipt. RENTIE records the money (record-only) and marks the items rented —
all as one all-or-nothing operation.

**Blocked by:** 05 (inventory add/edit — write pattern established).

**Status:** ready-for-agent

- [ ] Selecting items and completing checkout writes, in a **single atomic D1 `batch()`**
      (ADR-0004): customer upsert (by normalized WhatsApp — existing customer updated, new one
      created), booking (+ item join rows), transaction (+ item join rows), and item status →
      `rented` with `times_rented` incremented.
- [ ] The action **re-validates server-side, inside the write**, that the items belong to this
      tenant and are `status = 'available'`; renting an unavailable item is rejected with **no
      partial write** (atomicity holds).
- [ ] Payment method (QRIS/GoPay/OVO/DANA/Cash/Card), deposit, rental total, base rental, and
      extra-day fee are recorded; evidence references are stored if provided.
- [ ] A **receipt** (authoritative rows from the server) is returned and shown; the store updates
      pessimistically from it. Checkout button disables while saving; failures surface clearly.
- [ ] The customer's `total_rentals` / `last_rental` update; the rung-up sale attributes to the
      signed-in user.
- [ ] Data-service tests: happy path writes all four areas and returns a correct receipt;
      unavailable-item rejection leaves no partial write; existing customer updated not duplicated;
      new customer created; item flips to rented and count increments.
