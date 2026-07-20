# 07 — POS return (`close`)

**What to build:** A cashier closes an active rental when the customer returns the items:
recording any late fee and damage fee, how much deposit is returned, and freeing the items back
into inventory — recorded as one atomic operation.

**Blocked by:** 06 (POS checkout — there must be an active rental to close).

**Status:** ready-for-agent

- [ ] Closing an active rental writes, in a **single atomic D1 `batch()`**: the close transaction
      (late fee, damage fee, deposit returned, amount due) and the item status change back to
      `available` (or `maintenance` if flagged for cleaning).
- [ ] The close is scoped to the session's tenant and re-validates the booking belongs to it.
- [ ] The write is pessimistic and returns authoritative rows; failures surface without corrupting
      the cache.
- [ ] Finance-relevant figures (late/damage fees, deposit return) are captured on the transaction
      record for ticket 08 to read.
- [ ] Data-service tests: close records fees + deposit return; item returns to available/
      maintenance; atomicity holds on failure; cross-tenant close is rejected.
