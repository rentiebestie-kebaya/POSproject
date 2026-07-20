# 09 — Owner provisions staff + role attribution

**What to build:** The owner adds their team — creating cashier and fitting accounts with an
initial password — without sharing their own login and without staff self-registering. Staff log
in with their own accounts, and their actions attribute to them by name.

**Blocked by:** 04 (bootstrap read — the team list and session must be live). Role attribution on
transactions is fully exercised once POS checkout (06) exists.

**Status:** ready-for-agent

- [ ] The owner can **create a staff account** (cashier or fitting) with a preset `tenant_id` +
      role and an initial password, via better-auth's admin create-user API (per ADR-0001).
- [ ] Staff **cannot self-register**; accounts only come from an owner.
- [ ] A provisioned staff member can **log in** and sees only their shop's data.
- [ ] Staff role is enforced server-side where it matters (e.g. only owners can provision staff).
- [ ] The team list reflects provisioned staff; the signed-in staff member's **name attributes to
      their POS actions** (verified against ticket 06's checkout).
- [ ] Tests: owner can create a staff account; a cashier cannot create accounts; a staff member of
      tenant A cannot access tenant B.
