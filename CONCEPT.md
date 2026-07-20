# RENTIE — Concept & Map

> The anchor document for what RENTIE is, who it's for, and the order in which it gets built.
> Produced from a grilling session on 2026-07-20. Update it as decisions change.

## What RENTIE is

A **multi-tenant SaaS** for **kebaya butik owners in Indonesia** to run their rental
business. Kebaya-first and deliberately narrow: the moat *is* the domain specificity
(hijab / non-hijab styling, kebaya measurements, occasion tagging, deposit & damage
norms for delicate hand-beaded garments) that generic rental software cannot match.

- **Market:** Indonesia only, for the foreseeable future.
- **Niche:** kebaya specialist. "Dress"/gaun is adjacent, not the DNA. Do not genericize.

## The wedge & plan tiers

RENTIE earns its first users on **money discipline**, then expands to planning and growth.
This is already encoded in `src/data/plans.ts` and is internally coherent.

| Tier | Core job | What it means concretely |
|---|---|---|
| **Free** | Money discipline (POS) | **Today's cash register.** Same-day checkouts, deposits, damage/late fees, payment evidence. **No forward calendar → no double-booking to solve.** "RENTIE Free is your till." |
| **Starter** | Booking ahead (availability) | Unlocks future reservations + the conflict/availability engine. Upgrade wall triggers naturally the day an owner wants to book for next month. |
| **Pro** | Growth + intelligence | Public booking page, customer analytics, receipt branding, export, unlimited inventory. |

**The free/paid line is the load-bearing design choice:** Free deliberately has *no concept
of future dates*, so it cannot double-book and never feels broken. The moment an owner wants
to take a reservation for a future date, that's Starter — an honest, obvious upgrade trigger.

## Key product decisions

- **Payments are record-only.** RENTIE is the **book of record**, not a payment processor.
  The customer pays the shop the way they already do (owner's own QRIS, cash, transfer); the
  cashier taps the method in POS so RENTIE *records* it. No gateway (Midtrans/Xendit), no
  settlement, no PCI, no float. This deletes the two hardest, highest-liability chunks from
  the critical path.
- **Public booking is reserve-only.** The Pro public page creates a `booking_request`; the
  owner confirms and collects the deposit their usual way (in person / WhatsApp transfer).
  No online payment.
- **Auth:** `better-auth` on D1. **Owner self-signs-up (which creates the tenant); the owner
  provisions staff** (cashier / fitting) — staff do not self-register. Email + password for
  v1; WhatsApp/OTP is a later nice-to-have. This mirrors the existing `users`-belong-to-`tenant`
  schema and the owner/cashier/fitting roles.
- **Backend architecture:** API routes + keep the client store's shape. Build `/api/*` routes
  backed by D1 and swap `store.tsx` internals from `localStorage` to `fetch()`. The
  `useTenant()` interface stays identical, so the ~5,600 lines of views barely change — the
  store was explicitly designed for this ("these selectors become API calls").
  **Tenant isolation is enforced server-side from the auth session — never from a
  client-supplied `tenant_id`.** Every route scopes its D1 query with
  `WHERE tenant_id = <session tenant>`. This rule is inviolable.

## Cost note (why the architecture is fine)

Target scale: ~100 tenants × ~80 items ≈ 8,000 inventory rows; a few tens of thousands of
rows total; storage < 100 MB. This sits comfortably in Cloudflare's **$0–5/month** band on
both Workers and D1 regardless of architecture. D1 bills on rows read/written, not queries;
the real cost lever is **query hygiene** (existing `tenant_id` indexes, scoped `WHERE`
clauses, no `SELECT *` over big tables, no N+1), not the API-vs-server-components choice.

## The go-to-market plan

- **First customer:** a warm lead the founder is confident will convert.
- **The ask:** **design partner** — free access in exchange for running real rentals through
  it and giving blunt feedback (and eventually a testimonial). Not a paying customer yet;
  money is a later question.
- **Why build it real (not demo the mock):** a *working* product is a stronger pitch than a
  mock and collapses the "will it actually work?" doubt before the lead raises it.

## The reality gap (where the code is today)

A polished **front-end demo**, not a product:
- 13 views, ~5,600 lines, all running on **mock/seed data in `localStorage`**.
- A full D1 schema + migrations exist (`migrations/0001_*`, `0002_*`) **but the app never
  touches D1** — only a health-check route does.
- No real auth (login = "pick a user from a list"). No persistence. Multi-tenancy is
  scaffolded but not enforced.

Stack: Next.js 15 (App Router) + React 19 + Tailwind v4 → OpenNext → Cloudflare Workers, D1 database.

## The build map

**Phase 0 — Make it real (invisible to users).**
`better-auth` on D1 (owner signup → creates tenant + owner user). Build the API-route + D1
data-access layer, tenant-scoped from session. Swap `store.tsx` internals from `localStorage`
→ `fetch()`; `useTenant()` interface unchanged.

**Phase 1 — Free tier, end-to-end (the wedge).**
POS (record-only), Inventory, Customers, basic Finance, Onboarding — all reading/writing real
D1. Deliverable: a butik runs real same-day rentals through it. This alone is a complete,
showable product.

**Phase 2 — Starter (booking-ahead).**
Bookings + availability/conflict engine on D1, forward reservations, calendar, manual booking.
Plan gating enforced server-side.

**Phase 3 — Pro (growth).**
Public booking page (reserve-only → writes `booking_requests`), customer analytics, receipt
branding, export. Provision the design-partner tenant to Pro to demo everything.

**Phase 4 — SaaS ops (only once >1 real shop).**
Self-serve signup → Free by default; plan upgrades handled **manually** (flip
`plan`/`billing_status` — no billing gateway, consistent with record-only); superadmin tooling
(the `Dev` view is the seed of this).

**Explicitly deferred:** payment processing, automated subscription billing, online deposits,
regional expansion, non-kebaya verticals.
