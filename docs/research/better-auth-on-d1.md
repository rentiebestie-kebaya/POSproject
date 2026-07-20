# better-auth on Cloudflare Workers + D1 — Research

**Date:** 2026-07-20
**Scope:** Primary sources only — better-auth.com/docs, the better-auth GitHub repo, Cloudflare Developers docs, and @opennextjs/cloudflare docs/GitHub. Community packages are noted where they are the only documented pattern, and flagged as community-maintained.

## Bottom line: is this viable for RENTIE?

**Yes — viable, and officially documented, with caveats worth knowing.** better-auth's own database docs include a first-party **Cloudflare D1 example**: you pass the D1 binding straight into `betterAuth({ database: env.DB })` and it runs through better-auth's **built-in Kysely adapter** (D1 is SQLite under the hood). There is **no separate `@better-auth/cloudflare` first-party plugin** — the integration *is* "pass the D1 binding as the database." Everything RENTIE needs is supported by primary features: **additional user fields** (`tenant_id`, `role`), the **admin plugin** (`createUser` with preset role + initial password, so owners provision staff without self-registration), and **email+password with verification off** (no mail provider needed in Phase 0). The one genuinely fiddly area is **schema/migrations on D1**: the `@better-auth/cli` cannot reach D1 directly, so you either run migrations *programmatically* (`getMigrations`) or — better for RENTIE per ADR-0005 — use `better-auth generate` to emit **SQL** and fold it into your D1 migration baseline. The largest real risk is **version fragility** and the fact that the smoothest Next.js/OpenNext wiring is demonstrated by a **community** package (`better-auth-cloudflare` by zpg6), not by better-auth itself. None of that blocks RENTIE; it just means we wire the D1 binding per-request ourselves via OpenNext's `getCloudflareContext()`.

---

## 1. Official Cloudflare Workers + D1 support, adapter, and integration guide

**Finding: Officially supported via the built-in Kysely adapter. D1 is passed directly as the `database`. There is no first-party `@better-auth/cloudflare` plugin; a well-known community package fills the "batteries-included" gap.**

- better-auth supports SQLite "under the hood via the Kysely adapter, any database supported by Kysely would also be supported." D1 is SQLite. Source: <https://www.better-auth.com/docs/adapters/sqlite>
- The **database concepts page** carries an explicit **Cloudflare D1 example**. You pass the Workers D1 binding directly:
  ```ts
  // auth.ts
  import { env } from "cloudflare:workers";
  import { betterAuth } from "better-auth";

  export const auth = betterAuth({
    database: env.DB,
    // ...
  });
  ```
  The docs note: *"Cloudflare D1 can only be queried through a Cloudflare Worker, so the CLI cannot access it directly."* Source: <https://www.better-auth.com/docs/concepts/database> (raw: <https://raw.githubusercontent.com/better-auth/better-auth/main/docs/content/docs/concepts/database.mdx>)
- **No first-party `@better-auth/cloudflare` plugin exists.** The database option accepting the D1 binding *is* the supported pattern; you do not need to hand-wire `kysely-d1`/`D1Dialect` yourself — better-auth's built-in Kysely adapter handles a D1 binding.
- **Community package (not official):** `better-auth-cloudflare` by zpg6 wraps this into a `withCloudflare()` helper plus optional Drizzle, KV secondary storage, R2, and geolocation. It supports **native D1 without Drizzle** ("pass a D1 binding directly") and ships Hono + Next.js (OpenNext) demos. Version 0.3.0, ~April 2026, community-maintained. Sources: <https://github.com/zpg6/better-auth-cloudflare>, <https://www.npmjs.com/package/better-auth-cloudflare>

**Verdict for Q1:** Officially supported through the built-in Kysely adapter by passing the D1 binding. No official Cloudflare plugin; Drizzle is optional, not required. `kysely-d1` is not something you import yourself — the adapter is internal.

## 2. Running better-auth on Next.js 15 App Router via @opennextjs/cloudflare (Workers, not Node)

**Finding: Works. The one thing you must do differently from the vanilla docs is obtain the D1 binding through OpenNext's `getCloudflareContext()` per-request, and therefore create/resolve the auth instance lazily inside request handlers rather than at module top-level.**

- Next.js App Router integration is standard: mount the catch-all route handler and use the `nextCookies` plugin so Server Actions persist cookies:
  ```ts
  // app/api/auth/[...all]/route.ts
  import { auth } from "@/lib/auth";
  import { toNextJsHandler } from "better-auth/next-js";
  export const { GET, POST } = toNextJsHandler(auth);
  ```
  Source: <https://www.better-auth.com/docs/integrations/next> (raw: <https://raw.githubusercontent.com/better-auth/better-auth/main/docs/content/docs/integrations/next.mdx>)
- **Binding access on OpenNext:** Cloudflare bindings are read via `getCloudflareContext().env.<BINDING>` and must be accessed **per-request inside handlers, not at module top-level**. Example from the OpenNext docs:
  ```ts
  import { getCloudflareContext } from "@opennextjs/cloudflare";
  export async function GET() {
    const db = getCloudflareContext().env.DB; // D1 binding
  }
  ```
  Source: <https://opennext.js.org/cloudflare/bindings>
- **Consequence for the auth instance:** because the D1 binding is only available per-request via `getCloudflareContext()`, wire the auth instance to resolve the binding at request time (a lazy factory that calls `getCloudflareContext().env.DB`, memoized per request), rather than `import { env } from "cloudflare:workers"` at import time. This is exactly the pattern the community `better-auth-cloudflare` package automates with `withCloudflare()` + `getCloudflareContext()`. Sources: <https://opennext.js.org/cloudflare/bindings>, <https://github.com/zpg6/better-auth-cloudflare>
- **Known runtime caveat (middleware, not the auth core):** on Next.js 13–15.1.x, middleware runs on the Edge Runtime and **cannot make DB calls**; full session validation in middleware needs Node.js-runtime middleware (15.2.0+, experimental pre-v16). better-auth's own guidance: in middleware only check for the *existence* of the session cookie for optimistic redirects, and **always validate the session server-side** in the route/handler. This aligns with RENTIE's inviolable rule that `tenant_id` is derived from the validated session server-side. Source: <https://raw.githubusercontent.com/better-auth/better-auth/main/docs/content/docs/integrations/next.mdx>
- **crypto / async_hooks:** the official docs demonstrate better-auth running inside a plain Worker (the D1 example imports `cloudflare:workers`), i.e. the core is intended to run on the Workers runtime. I did **not** find a primary-source statement enumerating exactly which Node APIs it touches (see Risks). In practice OpenNext runs with the `nodejs_compat` flag enabled, which covers the common gaps.

## 3. Additional typed fields (`tenant_id`, `role`) on the user model + session

**Finding: Yes. Add them via `user.additionalFields`; they are typed and inferred through `signUp.email` and `useSession`, and are returned as part of `session.user`.**

- Config (from the "extending core schema" section):
  ```ts
  export const auth = betterAuth({
    user: {
      additionalFields: {
        lang: { type: "string", required: false, defaultValue: "en" },
      },
    },
  });
  ```
  On signup the field is accepted and returned: `res.user.lang // "fr"`. The docs state additional fields are *"properly inferred in functions like `useSession`, `signUp.email`."* Source: <https://www.better-auth.com/docs/concepts/database> (raw: <https://raw.githubusercontent.com/better-auth/better-auth/main/docs/content/docs/concepts/database.mdx>)
- For RENTIE, define `tenant_id` and `role` as `user.additionalFields`. They live on the `user` row and come back on `session.user`, so every tenant-scoped route can read `session.user.tenant_id` / `session.user.role` server-side — exactly what ADR-0001 assumes.
- **Nuance to record:** *user* additionalFields (on `session.user`) are distinct from *session* additionalFields (extra columns on the `session` table, configured separately under `session.additionalFields`). RENTIE wants the **user** fields; no session-table customization is needed. Client-side type inference of custom fields uses the `inferAdditionalFields` helper referenced in the TypeScript docs. Source: <https://www.better-auth.com/docs/concepts/database>

## 4. Admin / create-user API — owner provisions staff without self-registration

**Finding: Yes — the admin plugin's `createUser` does exactly this: an authenticated admin creates an account with an initial password, a role, and arbitrary extra fields (so we can preset `tenant_id`). Also provides `setRole`, `banUser`/`unbanUser`, password reset, session revocation, impersonation.**

- `createUser` (server API, requires an authenticated admin):
  ```ts
  auth.api.createUser({
    email: "user@example.com",   // required
    password: "some-secure-password", // required — initial password, set by admin
    name: "James Smith",         // required
    role: "user",                // string | string[]
    data: { customField: "customValue" }, // custom additional fields
  });
  ```
  It does **not** bypass admin auth — it *is* the administrative path, and it does **not** require the created user to self-register. Sources: <https://www.better-auth.com/docs/plugins/admin>, raw: <https://raw.githubusercontent.com/better-auth/better-auth/main/docs/content/docs/plugins/admin.mdx>
- Other relevant APIs (all admin-gated): `setRole({ userId, role })`, `banUser({ userId, banReason?, banExpiresIn? })`, `unbanUser({ userId })`, `setUserPassword`, `updateUser`, `listUserSessions`, `revokeUserSession(s)`, `impersonateUser`, `removeUser`. Source: <https://www.better-auth.com/docs/plugins/admin>
- **RENTIE mapping:** owner calls `auth.api.createUser({ email, password, name, data: { tenant_id: <owner's tenant>, role: "cashier" | "fitting" } })`. Pass `tenant_id` (and app role, if kept separate — see Risks) through `data`, since `createUser` does **not** infer the creating admin's tenant automatically.

## 5. Schema generation / migration and coexistence with hand-written D1 SQL

**Finding: `better-auth generate` for a Kysely/SQLite (i.e. D1) setup emits an actual SQL file — which is exactly what RENTIE wants to fold into a migration baseline. `better-auth migrate` cannot reach D1, so we do NOT use it against D1; we use `generate` → SQL → `wrangler d1 migrations`.**

- `generate` output depends on adapter:
  - **Kysely/SQLite:** *"an SQL file saved as `schema.sql` in your project root."*
  - **Drizzle:** ORM schema files (`schema.ts`).
  - **Prisma:** Prisma schema.
  Usage: `npx @better-auth/cli generate`. Source: <https://www.better-auth.com/docs/concepts/cli>
- `migrate` *"is available if you're using the built-in Kysely adapter"*, but per the database docs the CLI **cannot access D1 directly** (D1 is only reachable from inside a Worker). So `migrate` is not the D1 path. Sources: <https://www.better-auth.com/docs/concepts/cli>, <https://www.better-auth.com/docs/concepts/database>
- **Programmatic alternative** for serverless: `getMigrations(auth.options)` from `better-auth/db/migration` returns `{ toBeCreated, toBeAdded, runMigrations }` and can run migrations from inside a Worker endpoint. Useful, but heavier than RENTIE needs pre-launch. Source: <https://www.better-auth.com/docs/concepts/database>
- **Coexistence with ADR-0005 (single clean baseline, then forward-only):** run `generate` with the Kysely/SQLite adapter to get `schema.sql` for the auth tables (`user`, `session`, `account`, `verification`) *including* the `tenant_id`/`role` additional-field columns (generate reflects `additionalFields`). Paste that SQL into the hand-authored baseline migration alongside the domain tables, reset local + remote D1, and apply via `wrangler d1 migrations apply`. This is precisely the "better-auth CLI generates auth tables → hand-author domain tables → collapse into a fresh baseline → reset D1 → apply" sequence ADR-0005 already prescribes. After first real data, the baseline is frozen and further auth-schema changes become new forward-only `wrangler` migrations (regenerate → diff → new migration file).

## 6. Running without a mail provider in Phase 0

**Finding: Yes. `emailAndPassword: { enabled: true }` works with no mail provider; `requireEmailVerification` defaults to off, and `sendVerificationEmail` is only needed when verification is enabled.**

- Enable: `emailAndPassword: { enabled: true }`. `requireEmailVerification` is **off by default** — you must explicitly set it `true` to force verification. With it off, no `sendVerificationEmail` (hence no SMTP/mail provider) is required. Sources: <https://www.better-auth.com/docs/authentication/email-password>, raw: <https://raw.githubusercontent.com/better-auth/better-auth/main/docs/content/docs/authentication/email-password.mdx>
- Matches RENTIE Phase 0 exactly: login / session / logout with email+password, no mail dependency. Password reset (`sendResetPassword`) would also need mail later, but is not required for Phase 0.

---

## Risks & unknowns (be honest)

1. **No official Cloudflare plugin; smoothest Next.js/OpenNext wiring is community code.** The per-request `getCloudflareContext()` → `withCloudflare()` pattern is demonstrated primarily by the **community** `better-auth-cloudflare` package (v0.3.0, zpg6). We can either depend on it or replicate its ~small wiring ourselves. Not a blocker, but it means the "happy path" for OpenNext isn't owned by the better-auth team. Source: <https://github.com/zpg6/better-auth-cloudflare>
2. **Admin-plugin `role` vs RENTIE app `role` may collide.** The admin plugin has its own role concept (default admin role `admin`, user role `user`) used for authorization of admin endpoints. RENTIE's roles are `owner`/`cashier`/`fitting`. If we reuse the single `role` field for both, we must configure the admin plugin's `adminRoles` to treat `owner` as an admin so owners can call `createUser`. I did not fully trace the admin plugin's `adminRoles`/`defaultRole` config from primary source — **verify before implementing** whether one `role` column can serve both, or whether RENTIE needs a separate app-role field. Source to check: <https://www.better-auth.com/docs/plugins/admin>
3. **`createUser` does not auto-scope to the creating admin's tenant.** `tenant_id` must be passed explicitly via `data`. Server code must set it from the authenticated owner's session, never from client input (consistent with CONTEXT.md rule 1). This is an implementation discipline, not a library limitation.
4. **Exact Workers-runtime API surface not enumerated in primary docs.** I could not find a primary-source list confirming which Node APIs (crypto, `async_hooks`) better-auth's core touches on Workers. The official D1 example importing `cloudflare:workers` implies edge-intent, and OpenNext runs with `nodejs_compat`, but password-hashing internals and any `async_hooks` use were **not confirmed from primary sources**. Low risk (widely run in production per community package), but unverified here.
5. **Version fragility.** better-auth is pre-2.0 and moving fast; the D1 example, additionalFields inference, and admin API shapes are current as of the July 2026 fetch but could shift across minor versions. Pin the better-auth version and re-run `generate` after upgrades. The community package tracks a specific better-auth range.
6. **Middleware DB-call limitation.** Do not attempt full session validation in Next.js edge middleware on <15.2.0; use cookie-existence checks there and validate in the route. Already aligned with RENTIE's server-side-isolation rule. Source: <https://raw.githubusercontent.com/better-auth/better-auth/main/docs/content/docs/integrations/next.mdx>

## Recommended integration path for RENTIE

1. **Packages:** `better-auth` (core), and the built-in Kysely adapter (no extra adapter package — the D1 binding is passed directly). Add the **admin plugin** (from `better-auth/plugins`) and the **`nextCookies`** plugin (from `better-auth/next-js`). Optionally adopt the community `better-auth-cloudflare` for its `withCloudflare()`/`getCloudflareContext()` wiring, or replicate that wiring in-repo to avoid a community dependency. Skip Drizzle — RENTIE already hand-writes D1 SQL, and native D1 via Kysely needs no ORM.
2. **Adapter choice:** **built-in Kysely adapter, native D1** — pass the `DB` binding (from `wrangler.jsonc`, binding `DB`, database `rentie-db`) as `database`. No `kysely-d1` import needed; better-auth's Kysely adapter handles the D1 binding.
3. **Wire the binding per-request on OpenNext/Workers:** build the auth instance from a lazy factory that reads `getCloudflareContext().env.DB` inside the request (route handler / server action), memoized per request — **not** at module top-level, because OpenNext only exposes bindings per-request. Configure once inside the factory: `emailAndPassword: { enabled: true }` (verification off, no mail), `user.additionalFields: { tenant_id: {type:"string", required:true}, role: {type:"string", required:true} }`, plugins `[admin(), nextCookies()]`. Mount `toNextJsHandler(auth)` at `app/api/auth/[...all]/route.ts`.
4. **Identity flow (ADR-0001):** owner **self-signs-up** via `signUp.email`, passing `tenant_id` (freshly minted slug) + `role: "owner"` as additional fields. Owner **provisions staff** via `auth.api.createUser({ email, password, name, data: { tenant_id: <session tenant>, role: "cashier"|"fitting" } })` — staff never self-register. Confirm the admin-plugin `adminRoles` config so `owner` is authorized to call `createUser` (see Risk 2).
5. **Schema/migration (ADR-0005):** run `npx @better-auth/cli generate` with the Kysely/SQLite adapter to emit `schema.sql` for `user`/`session`/`account`/`verification` **including** the `tenant_id`/`role` columns; hand-merge that SQL with the domain tables into one clean baseline migration; reset local + remote D1; `wrangler d1 migrations apply`. Freeze the baseline at first real data; thereafter regenerate → diff → new forward-only `wrangler` migration. Do **not** run `better-auth migrate` against D1 (the CLI can't reach it).
6. **Server-side tenant isolation:** every tenant-scoped route reads `tenant_id`/`role` from the validated `session.user` and scopes D1 queries `WHERE tenant_id = <session tenant>`; never trust client-supplied `tenant_id`. Use cookie-only checks in middleware, full validation in handlers.

## Sources

- <https://www.better-auth.com/docs/adapters/sqlite> — SQLite supported via the Kysely adapter; any Kysely-supported DB works (basis for D1 support).
- <https://www.better-auth.com/docs/concepts/database> — first-party **Cloudflare D1 example** (`database: env.DB`, `cloudflare:workers`), statement that the CLI cannot reach D1 directly, `getMigrations` programmatic migration, and the `additionalFields` "extending core schema" section.
- <https://raw.githubusercontent.com/better-auth/better-auth/main/docs/content/docs/concepts/database.mdx> — raw source confirming the D1 code block, `additionalFields` example, and that fields are inferred in `useSession`/`signUp.email`.
- <https://www.better-auth.com/docs/plugins/admin> & <https://raw.githubusercontent.com/better-auth/better-auth/main/docs/content/docs/plugins/admin.mdx> — admin plugin `createUser` (email/password/name/role/data), `setRole`, `banUser`/`unbanUser`, password reset, session revocation, impersonation; admin-auth requirement.
- <https://www.better-auth.com/docs/authentication/email-password> & raw `email-password.mdx` — `emailAndPassword: { enabled: true }`, `requireEmailVerification` defaults off, `sendVerificationEmail` only needed when verification is on (no mail provider required for Phase 0).
- <https://www.better-auth.com/docs/concepts/cli> — `generate` emits `schema.sql` for Kysely/SQLite (vs `schema.ts` for Drizzle); `migrate` only for the built-in Kysely adapter.
- <https://www.better-auth.com/docs/integrations/next> & raw `next.mdx` — App Router route handler (`toNextJsHandler`), `nextCookies` plugin, middleware edge-runtime DB limitation, cookie-existence-only checks in middleware.
- <https://opennext.js.org/cloudflare/bindings> — `getCloudflareContext().env.<BINDING>` for D1; bindings accessed per-request in handlers, not at module top-level; sync vs async (`{ async: true }` for SSG).
- <https://github.com/zpg6/better-auth-cloudflare> & <https://www.npmjs.com/package/better-auth-cloudflare> — **community** package (v0.3.0, ~Apr 2026): native D1 without Drizzle, `withCloudflare()` + `getCloudflareContext()` per-request wiring, Next.js OpenNext + Hono demos. Not official.
