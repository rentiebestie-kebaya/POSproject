# 03 — Dev seed + demo owner account

**What to build:** A reproducible way to fill a local database with one realistic, fully-populated
demo shop and a known owner login — so the product can be clicked through instantly and reset at
will. This is the developer's demo/test account from here on.

**Blocked by:** 02 (real auth — the demo owner needs a real account).

**Status:** ready-for-agent

- [ ] A seed script reshapes the existing realistic seed data (`src/data/mock.ts`) into **one demo
      tenant** with realistic inventory, customers, bookings, and transactions in **local D1 only**.
- [ ] The script creates a **demo owner account** (known email + password) that can log in via the
      real auth from ticket 02.
- [ ] Re-running the script **resets** the demo data deterministically.
- [ ] The seed does **not** run against / pollute production (production stays clean for the real
      design partner), per ADR-0003.
- [ ] Documented one-line command to seed + reset locally.
