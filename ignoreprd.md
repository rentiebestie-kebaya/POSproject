# Product Requirements Document
## Kebaya Rental Management Platform

**Status:** Draft v1
**Owner:** [Product Owner]
**Last updated:** July 2026

---

## 1. Vision

Become the #1 kebaya rental management platform in Indonesia — the default operating system for kebaya rental businesses nationwide, in the way majoo and Moka POS are the default for general F&B/retail SMEs.

Unlike horizontal SME platforms, this product is purpose-built for the rental business model: per-item inventory (not per-SKU stock counts), date-based booking with double-booking prevention, condition/damage tracking, and customer measurement history. These are mechanics a generic POS was never designed to handle well.

## 2. Problem Statement

Most kebaya rental shops in Indonesia today run on a mix of WhatsApp, Excel, and paper ledgers. This creates recurring problems:

- Double-booked garments (two customers claiming the same physical piece for overlapping dates)
- Lost track of which piece is where (rented, in the wash, under repair)
- Re-measuring repeat customers because no record is kept
- Disputes over damage deposits with no documentation
- No visibility into which styles/sizes to buy ahead of wedding or graduation season

Generic POS/SME platforms (majoo, Moka POS) solve retail and F&B problems well but have no concept of date-based reservation of a specific physical item — the core mechanic a rental business needs.

## 3. Target Users

| User | Context |
|---|---|
| Shop owner | Runs one or more kebaya rental outlets; wants visibility into revenue, inventory utilization, and customer retention |
| Cashier / front-desk staff | Handles walk-in and phone bookings, checkout/return transactions, deposit collection |
| Fitting staff | Manages fitting appointments, records measurements, checks garment condition |
| Customer (indirect user) | Books rentals, may interact with a shop's public booking page or WhatsApp |

## 4. Market & Competitive Positioning

Indonesia's SME POS market is dominated by horizontal platforms:

- **majoo** — founded 2019, over 45,000 active merchants, integrated POS/accounting/inventory/CRM/business analysis, tiered pricing (~IDR 149,000–599,000/month per outlet depending on tier)
- **Moka POS** — established since 2014, now part of GoTo (Gojek's parent company), strong brand recognition in F&B and retail

Neither platform has rental-native mechanics (date-based item reservation, condition logging, deposit/damage-fee automation). This is the wedge: win by depth in a niche rather than competing on breadth.

**Go-to-market approach:** win one city at a time (e.g. Jakarta, Bandung, Yogyakarta) through community-based distribution — kebaya rental owner WhatsApp groups, UMKM/IKM associations, referral partnerships with wedding organizers and MUAs — rather than competing on generic paid acquisition against much larger incumbents.

## 5. Product Pillars

The product is organized into four customer-facing pillars, plus one internal pillar for platform operations.

### 5.1 Operation
Day-to-day running of the rental business.
- Per-item inventory with QR/barcode tagging (style-level catalog + physical-item-level tracking)
- Inventory status lifecycle: available → booked → rented → in cleaning → in repair → retired
- Booking calendar with double-booking prevention across overlapping date ranges
- Condition/damage logging with photos at checkout and return
- Laundry/dry-clean cycle tracking
- Fitting appointment scheduling linked to inventory availability
- Multi-branch/outlet support

### 5.2 Sales & CRM
Revenue generation and customer relationships. CRM is elevated here deliberately — for a rental business, customer history (measurements, past rentals, preferences) is as much an operational necessity as a sales tool.
- Rental POS: transaction creation, deposit collection, late fee / damage fee calculation
- Payment methods: QRIS, GoPay/OVO/DANA, cash, card
- Package/bundle pricing (kebaya + kain + selendang + accessories as one line item)
- Customer profiles with measurement history and rental history
- Event-based reminders (upcoming wedding/graduation nudges)
- Public booking page per shop (customer-facing catalog + reservation request)
- WhatsApp automation: booking confirmations, return reminders, marketing broadcast
- Loyalty/referral tracking

### 5.3 Finance
Money management for the shop itself (distinct from platform billing — see 5.5).
- Transaction and payment reconciliation
- Deposit and refund tracking
- Revenue and expense reporting
- Export for accounting/tax purposes

### 5.4 Business Intelligence
A cross-cutting analytical layer reading from Operation, Sales, and Finance data — not an independent data domain.
- Revenue and utilization dashboards
- Most-rented styles/sizes, inventory turnover
- Seasonal demand forecasting (wedding season, graduation season, Lebaran)
- Churn/retention indicators for customers

### 5.5 Platform / Admin (internal, not shop-facing)
Operating the SaaS business itself.
- Tenant management and onboarding (bulk inventory import, setup wizard)
- Subscription billing, plan tier, usage tracking per tenant
- Staff roles and permissions within each tenant (owner / cashier / fitting staff)
- Super-admin panel for monitoring tenant health across all shops
- Support tooling (WhatsApp-based support channel)

## 6. Data Model (Core Entities)

- **Tenants** — shop_name, subdomain, plan_tier
- **Users** — tenant_id, name, role
- **Customers** — tenant_id, name, whatsapp
- **Measurements** — customer_id, bust, waist, hip, recorded_at
- **Styles** — tenant_id, category, color, base_price (the catalog design)
- **Inventory Items** — style_id, tenant_id, qr_code, size, status, condition_grade (the physical piece)
- **Bookings** — tenant_id, customer_id, start_date, end_date, status
- **Booking Items** — booking_id, inventory_item_id, price_at_booking
- **Transactions** — booking_id, deposit_amount, late_fee, damage_fee, total
- **Payments** — transaction_id, method, amount, status
- **Condition Logs** — inventory_item_id, booking_id, stage (checkout/return), grade, photo_url
- **Laundry Cycles** — inventory_item_id, sent_at, received_at

Multi-tenancy is enforced via `tenant_id` on nearly every table, ideally with database-level row-level security rather than application-layer filtering alone.

Not yet modeled, planned for later phases: `branches` (multi-outlet), `events` (CRM reminders), `subscriptions`/`plans` (SaaS billing detail).

## 7. Pricing & Plan Tiers (Direction — Needs Further Validation)

Primary value metric: inventory item count, with outlet count as a secondary multiplier.

| Tier | Target shop | Inventory cap | Outlets | Includes |
|---|---|---|---|---|
| Starter | New/small shop | ~100 items | 1 | POS, inventory, basic CRM, booking calendar |
| Growth | Established single-outlet shop | ~500 items | 1 | + WhatsApp automation, condition/damage logging, fitting scheduler |
| Multi-outlet | Chains/franchises | High/unlimited | 2+ | + multi-branch, staff roles, cross-branch transfer, advanced analytics |

Open questions to resolve before finalizing:
- Free tier (capped small) vs. time-limited trial
- Whether WhatsApp Business API messaging costs are bundled or metered separately
- Monthly vs. annual billing incentive structure
- Soft-nudge vs. hard-block behavior when a tenant exceeds their inventory cap

## 8. Success Metrics

Given this is a niche market, "#1" should be measured as:
- Number of active kebaya rental shops on the platform
- Estimated % share of Indonesia's kebaya rental shops using dedicated software (vs. WhatsApp/Excel)
- GMV processed through the platform
- Tenant retention / 12-month churn rate
- Expansion revenue (tenants moving up plan tiers as their inventory grows)

## 9. Phased Roadmap

**Phase 1 — MVP (replace the spreadsheet)**
Rental POS, per-item inventory with QR tags, booking calendar with double-booking prevention, customer profiles with measurement history, basic owner dashboard, self-serve onboarding with bulk import.

**Phase 2 — Retention & daily-use stickiness**
WhatsApp automation, condition/damage logging, fitting appointment scheduler, laundry cycle tracking, staff roles/permissions, multi-branch support.

**Phase 3 — Differentiators / moat**
Package/bundle pricing, public booking page, event-based CRM reminders, seasonal demand analytics, loyalty/referral tracking.

**Phase 4 — Platform maturity**
Tiered subscription billing live, super-admin tenant health monitoring, expansion into adjacent rental categories (formal wear, wedding decor, photography equipment) once kebaya rental is well-penetrated.

## 10. Risks & Open Questions

- Market education risk: many target shops are unfamiliar with paid software — onboarding friction could be the dominant churn driver early on, more than price
- WhatsApp Business API costs scale with usage and could erode margin if bundled into flat pricing
- Multi-tenant data isolation must be enforced rigorously (row-level security), as a single missed scope check is a serious data leak risk
- Go-to-market depends on community trust-building (city-by-city, relationship-driven) rather than paid acquisition, which is slower but likely more durable against incumbents
- Pricing model (inventory-count-based) needs validation against real shop economics before finalizing tier caps and price points