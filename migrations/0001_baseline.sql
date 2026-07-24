-- RENTIE clean schema baseline (ADR-0001, ADR-0005).
--
-- This is the single, collapsed baseline: better-auth's generated auth tables
-- folded together with the hand-authored domain tables. Pre-launch we reset D1
-- (local + remote) and apply this one migration; the moment the design partner
-- has real data, this baseline freezes and all further changes become
-- forward-only `wrangler d1 migrations`.
--
-- Identity model: a single `user` table (better-auth) carries `tenant_id` and the
-- domain `role` (owner | cashier | fitting). There is NO standalone app `users`
-- table. The auth-table section below is emitted verbatim by
-- `@better-auth/cli generate` (Kysely/SQLite adapter) from src/lib/auth.generate.ts
-- so a future regenerate diffs cleanly against it.

PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------------------
-- better-auth tables — a verbatim copy of docs/generated/better-auth-schema.sql
-- (produced by `npm run auth:generate`). Do NOT hand-edit this block: change
-- src/lib/auth.generate.ts, regenerate, and reconcile the two here.
-- ---------------------------------------------------------------------------

create table "user" ("id" text not null primary key, "name" text not null, "email" text not null unique, "emailVerified" integer not null, "image" text, "createdAt" date not null, "updatedAt" date not null, "role" text not null, "banned" integer, "banReason" text, "banExpires" date, "tenant_id" text not null);

create table "session" ("id" text not null primary key, "expiresAt" date not null, "token" text not null unique, "createdAt" date not null, "updatedAt" date not null, "ipAddress" text, "userAgent" text, "userId" text not null references "user" ("id") on delete cascade, "impersonatedBy" text);

create table "account" ("id" text not null primary key, "accountId" text not null, "providerId" text not null, "userId" text not null references "user" ("id") on delete cascade, "accessToken" text, "refreshToken" text, "idToken" text, "accessTokenExpiresAt" date, "refreshTokenExpiresAt" date, "scope" text, "password" text, "createdAt" date not null, "updatedAt" date not null);

create table "verification" ("id" text not null primary key, "identifier" text not null, "value" text not null, "expiresAt" date not null, "createdAt" date not null, "updatedAt" date not null);

create index "session_userId_idx" on "session" ("userId");

create index "account_userId_idx" on "account" ("userId");

create index "verification_identifier_idx" on "verification" ("identifier");

-- Scope users to a tenant for fast per-shop staff lookups.
CREATE INDEX idx_user_tenant_id ON "user" ("tenant_id");

-- ---------------------------------------------------------------------------
-- Domain tables
-- ---------------------------------------------------------------------------

CREATE TABLE tenants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  subdomain TEXT NOT NULL UNIQUE,
  location TEXT NOT NULL,
  whatsapp TEXT NOT NULL,
  booking_deposit_amount INTEGER NOT NULL DEFAULT 0,
  booking_deposit_policy TEXT NOT NULL CHECK (booking_deposit_policy IN ('non_refundable', 'refundable')),
  plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'starter', 'pro')),
  billing_status TEXT NOT NULL DEFAULT 'active' CHECK (billing_status IN ('active', 'pending', 'past_due', 'cancelled')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  onboarding_status TEXT NOT NULL DEFAULT 'incomplete' CHECK (onboarding_status IN ('incomplete', 'complete')),
  logo_url TEXT,
  limit_overrides_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE inventory_items (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  inventory_code TEXT NOT NULL,
  size_label TEXT NOT NULL,
  model TEXT NOT NULL,
  color TEXT NOT NULL,
  wear_style TEXT NOT NULL CHECK (wear_style IN ('hijab', 'non-hijab')),
  includes_json TEXT NOT NULL DEFAULT '[]',
  occasions_json TEXT NOT NULL DEFAULT '[]',
  rent_condition TEXT NOT NULL CHECK (rent_condition IN ('in-town', 'shipping', 'both')),
  bust INTEGER NOT NULL,
  waist INTEGER NOT NULL,
  length INTEGER NOT NULL,
  sleeve INTEGER NOT NULL,
  rental_price INTEGER NOT NULL DEFAULT 0,
  cost INTEGER NOT NULL DEFAULT 0,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL CHECK (status IN ('available', 'rented', 'maintenance')),
  condition_grade TEXT NOT NULL CHECK (condition_grade IN ('A', 'B', 'C')),
  qr_code TEXT NOT NULL,
  photos_json TEXT NOT NULL DEFAULT '[]',
  date_added TEXT NOT NULL,
  times_rented INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (tenant_id, inventory_code)
);

CREATE INDEX idx_inventory_items_tenant_id ON inventory_items(tenant_id);
CREATE INDEX idx_inventory_items_status ON inventory_items(tenant_id, status);

CREATE TABLE customers (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  whatsapp TEXT NOT NULL,
  normalized_whatsapp TEXT NOT NULL,
  instagram TEXT,
  email TEXT,
  event_type TEXT,
  event_date TEXT,
  total_rentals INTEGER NOT NULL DEFAULT 0,
  last_rental TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (tenant_id, normalized_whatsapp)
);

CREATE INDEX idx_customers_tenant_id ON customers(tenant_id);
CREATE INDEX idx_customers_whatsapp ON customers(tenant_id, normalized_whatsapp);

CREATE TABLE customer_measurements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  bust INTEGER NOT NULL,
  waist INTEGER NOT NULL,
  hip INTEGER NOT NULL,
  recorded_at TEXT NOT NULL
);

CREATE INDEX idx_customer_measurements_customer_id ON customer_measurements(customer_id);

CREATE TABLE bookings (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('confirmed', 'active', 'returned', 'late', 'cancelled')),
  total INTEGER NOT NULL DEFAULT 0,
  deposit INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_bookings_tenant_id ON bookings(tenant_id);
CREATE INDEX idx_bookings_dates ON bookings(tenant_id, start_date, end_date);
CREATE INDEX idx_bookings_status ON bookings(tenant_id, status);

CREATE TABLE booking_items (
  booking_id TEXT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL REFERENCES inventory_items(id) ON DELETE RESTRICT,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  PRIMARY KEY (booking_id, item_id)
);

CREATE INDEX idx_booking_items_item_id ON booking_items(item_id);

-- Availability engine (ADR-0002, Phase 2). One row per item per committed day —
-- across BOTH active same-day rentals (POS) and confirmed forward reservations.
-- The PRIMARY KEY (item_id, date) IS the double-booking guard: a conflicting
-- insert fails on the constraint inside the atomic batch, so correctness never
-- depends on a write path remembering to re-check an overlap. Availability of an
-- item for [start, end] is simply the absence of any row in that date range.
CREATE TABLE booking_days (
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL REFERENCES inventory_items(id) ON DELETE RESTRICT,
  date TEXT NOT NULL,
  booking_id TEXT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  PRIMARY KEY (item_id, date)
);

CREATE INDEX idx_booking_days_tenant ON booking_days(tenant_id, item_id, date);
CREATE INDEX idx_booking_days_booking ON booking_days(booking_id);

CREATE TABLE booking_requests (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL REFERENCES inventory_items(id) ON DELETE RESTRICT,
  customer_name TEXT NOT NULL,
  whatsapp TEXT NOT NULL,
  event_type TEXT,
  event_date TEXT,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  deposit_amount INTEGER NOT NULL DEFAULT 0,
  deposit_policy TEXT NOT NULL CHECK (deposit_policy IN ('non_refundable', 'refundable')),
  payment_status TEXT NOT NULL CHECK (payment_status IN ('unpaid', 'paid', 'waived')),
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),
  expires_at TEXT NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_booking_requests_tenant_id ON booking_requests(tenant_id);
CREATE INDEX idx_booking_requests_status ON booking_requests(tenant_id, status);

CREATE TABLE transactions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  booking_id TEXT NOT NULL REFERENCES bookings(id) ON DELETE RESTRICT,
  transaction_type TEXT CHECK (transaction_type IN ('open', 'close')),
  date TEXT NOT NULL,
  deposit INTEGER NOT NULL DEFAULT 0,
  late_fee INTEGER NOT NULL DEFAULT 0,
  damage_fee INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL DEFAULT 0,
  method TEXT NOT NULL CHECK (method IN ('QRIS', 'GoPay', 'OVO', 'DANA', 'Cash', 'Card')),
  payment_status TEXT NOT NULL CHECK (payment_status IN ('paid', 'partial', 'refunded', 'pending')),
  customer_name TEXT,
  customer_whatsapp TEXT,
  cashier_name TEXT,
  rental_total INTEGER,
  base_rental INTEGER,
  extra_day_fee INTEGER,
  notes TEXT,
  return_notes TEXT,
  deposit_returned INTEGER,
  amount_due INTEGER,
  evidence_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_transactions_tenant_id ON transactions(tenant_id);
CREATE INDEX idx_transactions_booking_id ON transactions(booking_id);
CREATE INDEX idx_transactions_date ON transactions(tenant_id, date);

CREATE TABLE transaction_items (
  transaction_id TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL REFERENCES inventory_items(id) ON DELETE RESTRICT,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  PRIMARY KEY (transaction_id, item_id)
);

CREATE INDEX idx_transaction_items_item_id ON transaction_items(item_id);

CREATE TABLE monthly_revenue (
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  month TEXT NOT NULL,
  revenue INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (tenant_id, month)
);
