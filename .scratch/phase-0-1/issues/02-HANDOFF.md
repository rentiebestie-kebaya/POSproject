# Handoff — Ticket 02: Real auth, a provisioned owner logs in

This brief is self-contained: an agent (or teammate) starting a fresh session can pick up
ticket 02 from here without replaying ticket 01. Read the ticket itself
([`02-real-auth-owner-login.md`](./02-real-auth-owner-login.md)) for the acceptance checklist;
this brief gives you the ground truth ticket 01 left behind, the decisions already made, the
open decision you must resolve, and a suggested path.

## ⚠️ Read first — deploy/lockfile discipline (don't reintroduce a fixed build break)

RENTIE auto-deploys on Cloudflare Pages/Workers, whose builder runs `npm ci` on **npm 10.9.2
(Node 22.16)**. Ticket 01 hit — and fixed — two lockfile failures there; **do not undo them**:

- The local dev machine runs **npm 11**, which writes `package-lock.json` in a shape npm 10's
  `npm ci` rejects.
- Regenerating the lock with `node_modules` still present records only the **current platform's**
  native binaries (`@ast-grep/napi`, `esbuild`, `@next/swc`, `workerd`, `sharp`, …) and omits the
  Linux ones the builder needs → `opennextjs-cloudflare build` crashes with "Cannot find native
  binding" (npm/cli#4828).

**If you add or change ANY dependency in ticket 02**, regenerate the lock from a fully clean state
with npm 10, then verify, before committing:

```
rm -rf node_modules package-lock.json
npx -y npm@10.9.2 install
npx -y npm@10.9.2 ci --dry-run                          # Cloudflare's exact command — must pass
# sanity: every platform node present, not just yours:
node -e 'const l=require("./package-lock.json");console.log(Object.keys(l.packages).filter(k=>k.includes("@ast-grep/napi-")).length)'   # expect 9, not 1
npx opennextjs-cloudflare build                         # optional but catches build-stage breaks locally
```

If you add **no** new dependencies (quite possible — see below), you don't need to touch the lock at
all. `better-auth` (1.6.23), `nextCookies`, and the `admin` plugin are **already installed**; the
Next auth handler and `getCloudflareContext` come from packages already present. Current good lock is
at commit `c3420b6`.

## What ticket 01 already delivered (you build on this — don't redo it)

- **Schema baseline is live.** `migrations/0001_baseline.sql` is the single clean baseline,
  already applied to **local and remote** D1 (`rentie-db`, binding `DB`). It contains the
  better-auth tables (`user`, `session`, `account`, `verification`) folded together with the
  domain tables. There is **no** standalone `users` table.
- **Identity columns exist.** The better-auth `user` table already carries `tenant_id text not null`
  and `role text not null` (plus the admin-plugin columns `banned`, `banReason`, `banExpires`, and
  `session.impersonatedBy`). You do **not** need a migration to add these — they're in the baseline.
- **Auth schema is reproducible.** `src/lib/auth.generate.ts` is a **generation-only** config
  (better-sqlite3 + `betterAuth`, `admin()` plugin, `tenant_id`+`role` as required
  `user.additionalFields`). `npm run auth:generate` emits `docs/generated/better-auth-schema.sql`,
  which is the verbatim source for the auth block in the baseline. **This file is NOT the runtime
  auth instance** — building the runtime instance is your job (see below). It imports native
  `better-sqlite3`, but nothing in the app imports it, so it never enters the Worker bundle — keep
  it that way.
- **Test harness is ready.** Vitest 4 + `@cloudflare/vitest-pool-workers` run inside real
  workerd/Miniflare against a real local D1. `vitest.config.mts` (note: `.mts`, ESM-required) reads
  the baseline via `readD1Migrations` and injects it as the `TEST_MIGRATIONS` binding;
  `test/setup.ts` does `reset()` + `applyD1Migrations` in `beforeEach`, so every test starts from a
  fresh migrated DB. `test/env.d.ts` augments `Cloudflare.Env` with `TEST_MIGRATIONS`.
  `test/schema-baseline.smoke.test.ts` is the pattern to copy for DB-backed tests.
- **Commands:** `npm test` (green), `npx tsc --noEmit` (clean), `npm run auth:generate`.
- Committed on `main` (ticket 01 = `362a05a`; lockfile fixes = `dfe122d`, `c3420b6`).

## Decisions already locked (from the ADRs — don't relitigate)

- **Single identity table** (ADR-0001): `tenant_id` + `role` are `user.additionalFields`, surfaced
  on `session.user`, read server-side for scoping. Client-supplied tenant id is never trusted.
- **Per-request binding on OpenNext** (spec / research): the D1 binding only exists per-request via
  `getCloudflareContext().env.DB`. Build the auth instance from a **lazy factory called inside the
  request handler**, memoized per request — never at module top level. (This is why
  `auth.generate.ts` uses a throwaway better-sqlite3 handle instead of the real binding.)
- **Email + password, verification OFF** (no mail provider in Phase 0/1).
- **Migrations flow through `wrangler d1 migrations`** only; `better-auth migrate` is never run
  against D1. If you change the auth config's schema surface, re-run `npm run auth:generate`, and
  because the baseline is already applied to real (remote) D1, add a **new forward migration**
  rather than editing `0001_baseline.sql` — but confirm with the human first, since remote was
  reset once pre-launch and that window may still be open (see ADR-0005 "forward-only activates at
  first real data").

## The open decision you MUST resolve (ticket 02 acceptance item)

**Admin-plugin `role` vs domain `role` collision** (ADR-0001 "OPEN RISK", spec "OPEN IMPLEMENTATION
DECISION"). The baseline reuses a **single** `role` column for both the domain role
(`owner`/`cashier`/`fitting`) and better-auth's admin-plugin authorization (default `admin`/`user`).
You must pick one and **record it** (append to ADR-0001 or add a new ADR):
- (a) configure the admin plugin's `adminRoles` so the domain `owner` is authorized to call
  `createUser` (staff provisioning, ticket 09), reusing the single column; or
- (b) introduce a **separate** admin-authorization field distinct from the domain `role`.

Research (`docs/research/better-auth-on-d1.md`, §4 + Risk 2) could not trace `adminRoles`/`defaultRole`
to a primary source — **verify the admin plugin's config concretely in code** before committing to (a).

## Suggested path (tracer-bullet, keep the app runnable)

1. Build the runtime auth factory (new file, e.g. `src/lib/auth.ts`) that mirrors
   `auth.generate.ts`'s options but reads `getCloudflareContext().env.DB` per request; plugins
   `[admin(), nextCookies()]`, `emailAndPassword.enabled = true`, verification off,
   `user.additionalFields` = `tenant_id` + `role` (both required, no baked default). Pin the
   `better-auth` version (already `1.6.23` in `package.json`).
2. Mount `toNextJsHandler(auth)` at the App Router catch-all: `app/api/auth/[...all]/route.ts`.
3. Replace the fake `src/views/Login.tsx` "pick a user" flow with real email+password sign-in; wire
   sign-out. Session must persist across reload + device (cookie-based — that's what `nextCookies`
   gives you).
4. Middleware (`middleware.ts`): cookie-existence check only for optimistic redirects; **validate
   the session server-side** in handlers (edge middleware can't hit D1 on Next <15.2 — see research §2).
5. Provisioning path for the one owner (a script or the dev seed in ticket 03) using
   `auth.api.createUser` / signup with `tenant_id` + `role: "owner"`.
6. **Tests** (extend the ticket-01 harness): unauthenticated request rejected; a valid session
   round-trips and yields the correct `tenant_id` + `role`. Auth-boundary tests go at the
   route/adapter level per the spec's Testing Decisions; keep DB-state tests at the highest seam.

## Watch out for

- `role` and `tenant_id` are **NOT NULL** with no default and no DB-level `CHECK`/FK. Enforce valid
  role values and tenant scoping in your auth/service code — the DB won't.
- Config files that import the ESM-only `@cloudflare/vitest-pool-workers` must be `.mts` (or the
  project would need `"type": "module"`, which it deliberately isn't — it's a Next app).
- `auth.generate.ts` imports native `better-sqlite3`; keep it out of the Worker bundle (it's only
  referenced by the `auth:generate` script, never by app code — preserve that).
- Don't hand-edit the better-auth block in `0001_baseline.sql`; change `auth.generate.ts` and
  regenerate.
- Before pushing, run the deploy/lockfile checks in the "Read first" section if you touched deps,
  and ideally `npx opennextjs-cloudflare build` — the Cloudflare build is the deploy gate.

## Source docs (read these, they're primary)

- `.scratch/phase-0-1/issues/02-real-auth-owner-login.md` — the acceptance checklist.
- `.scratch/phase-0-1/spec.md` — "Authentication & identity", "Backend architecture & writes",
  "Testing Decisions".
- `docs/adr/0001-identity-and-tenancy-model.md`, `docs/adr/0005-migration-strategy.md`.
- `docs/research/better-auth-on-d1.md` — the "Recommended integration path for RENTIE" section is
  effectively a step list; §2 (OpenNext per-request binding), §4 (admin `createUser`), Risk 2
  (the role collision).
