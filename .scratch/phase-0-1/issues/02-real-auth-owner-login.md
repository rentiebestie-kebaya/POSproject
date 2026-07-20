# 02 — Real auth: a provisioned owner logs in

**What to build:** Replace the fake "pick a user from a list" login with real accounts. A butik
owner signs in with an email and password, their session persists across reloads and devices, and
they can sign out. The whole app gates on the real session — the signed-in user's tenant and role
come from that session, server-side.

**Blocked by:** 01 (test harness + schema baseline).

**Status:** ready-for-agent

- [ ] `better-auth` is wired on D1 with a **lazy, per-request** binding factory (reads the D1
      binding via the Cloudflare context inside the request handler, never at module top level).
- [ ] The better-auth Next handler is mounted at the App Router catch-all auth route with the
      cookie + admin plugins enabled; email verification is **disabled** (no mail provider needed).
- [ ] An owner can be provisioned (script/seed path) and can **log in** with email + password.
- [ ] The session **persists across page reloads** and on a different browser/device; **logout**
      ends it.
- [ ] `tenant_id` and `role` are surfaced on the session user and read **server-side** for scoping;
      a client-supplied tenant id is never trusted.
- [ ] The **admin-role vs domain-role collision is resolved** (ADR-0001 open decision): either
      `adminRoles` authorizes the domain `owner` to create users, or a separate admin-authorization
      field is introduced. The choice is recorded (a short note in ADR-0001 or a new ADR).
- [ ] Tests: an unauthenticated request is rejected; a valid session round-trips and yields the
      correct tenant + role.
