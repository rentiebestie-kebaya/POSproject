import type { Auth } from "./auth";
import type { Tenant, TenantDataset } from "@/data/mock";

/**
 * Dev-local demo seed (ADR-0003, ticket 03).
 *
 * Reshapes one realistic tenant from `src/data/mock.ts` into a single demo
 * shop ("Kebaya Demo") plus a real better-auth owner account, applied to the
 * LOCAL D1 only. Re-running fully resets the demo deterministically. Never point
 * this at production — the runner (`scripts/seed-demo.mts`) only ever binds the
 * local D1, so production stays clean for the real design partner.
 *
 * Only *type* imports come from local modules here, so this file can be imported
 * from a plain Node script (no path-alias/runtime resolution needed) as well as
 * from the vitest harness.
 */

export const DEMO_TENANT_ID = "demo";
export const DEMO_TENANT_NAME = "Kebaya Demo";
export const DEMO_SUBDOMAIN = "demo.rentie.id";

/** The developer's demo/test login from Phase 0 onward. */
export const DEMO_OWNER = {
  email: "demo@rentie.id",
  password: "demo12345",
  name: "Demo Owner",
} as const;

/** The mock tenant + dataset to reshape into the demo shop. */
export interface DemoSource {
  tenant: Tenant;
  dataset: TenantDataset;
}

export interface SeedResult {
  tenantId: string;
  ownerEmail: string;
  counts: {
    inventory: number;
    customers: number;
    bookings: number;
    bookingRequests: number;
    transactions: number;
  };
}

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

/**
 * Removes the demo tenant, all its domain rows, and the demo owner account
 * (with its sessions + credential). Explicit per-table deletes, in child→parent
 * order, so it works whether or not D1 enforces FK cascades. Deterministic and
 * safe to call when nothing is seeded yet.
 */
export async function resetDemo(db: D1Database): Promise<void> {
  const t = DEMO_TENANT_ID;
  await db.batch([
    db.prepare(`DELETE FROM transaction_items WHERE tenant_id = ?`).bind(t),
    db.prepare(`DELETE FROM transactions WHERE tenant_id = ?`).bind(t),
    db.prepare(`DELETE FROM booking_items WHERE tenant_id = ?`).bind(t),
    db.prepare(`DELETE FROM bookings WHERE tenant_id = ?`).bind(t),
    db.prepare(`DELETE FROM booking_requests WHERE tenant_id = ?`).bind(t),
    db
      .prepare(
        `DELETE FROM customer_measurements WHERE customer_id IN (SELECT id FROM customers WHERE tenant_id = ?)`,
      )
      .bind(t),
    db.prepare(`DELETE FROM customers WHERE tenant_id = ?`).bind(t),
    db.prepare(`DELETE FROM inventory_items WHERE tenant_id = ?`).bind(t),
    db.prepare(`DELETE FROM monthly_revenue WHERE tenant_id = ?`).bind(t),
    db.prepare(`DELETE FROM tenants WHERE id = ?`).bind(t),
    // Demo owner account (session/account cascade from user, but delete
    // explicitly in case FK cascade is off).
    db
      .prepare(`DELETE FROM session WHERE userId IN (SELECT id FROM "user" WHERE email = ?)`)
      .bind(DEMO_OWNER.email),
    db
      .prepare(`DELETE FROM account WHERE userId IN (SELECT id FROM "user" WHERE email = ?)`)
      .bind(DEMO_OWNER.email),
    db.prepare(`DELETE FROM "user" WHERE email = ?`).bind(DEMO_OWNER.email),
  ]);
}

/**
 * Resets, then seeds the demo shop + owner from `source`. Idempotent: running it
 * repeatedly yields the same rows.
 */
export async function seedDemo(db: D1Database, auth: Auth, source: DemoSource): Promise<SeedResult> {
  await resetDemo(db);

  const { tenant, dataset } = source;
  const t = DEMO_TENANT_ID;
  const stmts: D1PreparedStatement[] = [];

  // Tenant — reuse the source's realistic metadata, but re-identify as the demo shop.
  stmts.push(
    db
      .prepare(
        `INSERT INTO tenants
          (id, name, subdomain, location, whatsapp, booking_deposit_amount, booking_deposit_policy,
           plan, billing_status, status, onboarding_status, logo_url, limit_overrides_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        t,
        DEMO_TENANT_NAME,
        DEMO_SUBDOMAIN,
        tenant.location,
        tenant.whatsapp,
        tenant.bookingDepositAmount,
        tenant.bookingDepositPolicy,
        tenant.plan,
        tenant.billingStatus,
        tenant.status,
        tenant.onboardingStatus,
        tenant.logoUrl ?? null,
        JSON.stringify(tenant.limitOverrides ?? {}),
      ),
  );

  // Inventory
  for (const item of dataset.inventory) {
    stmts.push(
      db
        .prepare(
          `INSERT INTO inventory_items
            (id, tenant_id, name, inventory_code, size_label, model, color, wear_style,
             includes_json, occasions_json, rent_condition, bust, waist, length, sleeve,
             rental_price, cost, description, status, condition_grade, qr_code, photos_json,
             date_added, times_rented)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          item.id,
          t,
          item.name,
          item.inventoryCode,
          item.sizeLabel,
          item.model,
          item.color,
          item.wearStyle,
          JSON.stringify(item.includes),
          JSON.stringify(item.occasions),
          item.rentCondition,
          item.size.bust,
          item.size.waist,
          item.size.length,
          item.size.sleeve,
          item.rentalPrice,
          item.cost,
          item.description,
          item.status,
          item.conditionGrade,
          item.qrCode,
          JSON.stringify(item.photos),
          item.dateAdded,
          item.timesRented,
        ),
    );
  }

  // Customers (+ measurements)
  for (const c of dataset.customers) {
    stmts.push(
      db
        .prepare(
          `INSERT INTO customers
            (id, tenant_id, name, whatsapp, normalized_whatsapp, instagram, email,
             event_type, event_date, total_rentals, last_rental)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          c.id,
          t,
          c.name,
          c.whatsapp,
          normalizePhone(c.whatsapp),
          c.instagram ?? null,
          c.email ?? null,
          c.event?.type ?? null,
          c.event?.date ?? null,
          c.totalRentals,
          c.lastRental,
        ),
    );
    for (const m of c.measurements) {
      stmts.push(
        db
          .prepare(
            `INSERT INTO customer_measurements (customer_id, bust, waist, hip, recorded_at)
             VALUES (?, ?, ?, ?, ?)`,
          )
          .bind(c.id, m.bust, m.waist, m.hip, m.recordedAt),
      );
    }
  }

  // Bookings (+ item join rows)
  for (const b of dataset.bookings) {
    stmts.push(
      db
        .prepare(
          `INSERT INTO bookings
            (id, tenant_id, customer_id, start_date, end_date, status, total, deposit, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(b.id, t, b.customerId, b.startDate, b.endDate, b.status, b.total, b.deposit, b.notes ?? null),
    );
    for (const itemId of b.itemIds) {
      stmts.push(
        db
          .prepare(`INSERT INTO booking_items (booking_id, item_id, tenant_id) VALUES (?, ?, ?)`)
          .bind(b.id, itemId, t),
      );
    }
  }

  // Booking requests
  for (const r of dataset.bookingRequests) {
    stmts.push(
      db
        .prepare(
          `INSERT INTO booking_requests
            (id, tenant_id, item_id, customer_name, whatsapp, event_type, event_date,
             start_date, end_date, deposit_amount, deposit_policy, payment_status, status,
             expires_at, notes, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          r.id,
          t,
          r.itemId,
          r.customerName,
          r.whatsapp,
          r.eventType ?? null,
          r.eventDate ?? null,
          r.startDate,
          r.endDate,
          r.depositAmount,
          r.depositPolicy,
          r.paymentStatus,
          r.status,
          r.expiresAt,
          r.notes ?? null,
          r.createdAt,
        ),
    );
  }

  // Transactions (+ item join rows)
  for (const tx of dataset.transactions) {
    stmts.push(
      db
        .prepare(
          `INSERT INTO transactions
            (id, tenant_id, booking_id, transaction_type, date, deposit, late_fee, damage_fee,
             total, method, payment_status, customer_name, customer_whatsapp, cashier_name,
             rental_total, base_rental, extra_day_fee, notes, return_notes, deposit_returned,
             amount_due, evidence_json)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          tx.id,
          t,
          tx.bookingId,
          tx.transactionType ?? null,
          tx.date,
          tx.deposit,
          tx.lateFee,
          tx.damageFee,
          tx.total,
          tx.method,
          tx.paymentStatus,
          tx.customerName ?? null,
          tx.customerWhatsapp ?? null,
          tx.cashierName ?? null,
          tx.rentalTotal ?? null,
          tx.baseRental ?? null,
          tx.extraDayFee ?? null,
          tx.notes ?? null,
          tx.returnNotes ?? null,
          tx.depositReturned ?? null,
          tx.amountDue ?? null,
          JSON.stringify(tx.evidence ?? {}),
        ),
    );
    for (const itemId of tx.itemIds ?? []) {
      stmts.push(
        db
          .prepare(`INSERT INTO transaction_items (transaction_id, item_id, tenant_id) VALUES (?, ?, ?)`)
          .bind(tx.id, itemId, t),
      );
    }
  }

  // Monthly revenue
  for (const row of dataset.monthlyRevenue) {
    stmts.push(
      db
        .prepare(`INSERT INTO monthly_revenue (tenant_id, month, revenue) VALUES (?, ?, ?)`)
        .bind(t, row.month, row.revenue),
    );
  }

  await db.batch(stmts);

  // Demo owner account (real better-auth). Called with no headers → the admin
  // gate is skipped for this bootstrap; tenant_id + role are written server-side.
  await auth.api.createUser({
    body: {
      email: DEMO_OWNER.email,
      password: DEMO_OWNER.password,
      name: DEMO_OWNER.name,
      role: "owner",
      data: { tenant_id: t },
    },
  });

  return {
    tenantId: t,
    ownerEmail: DEMO_OWNER.email,
    counts: {
      inventory: dataset.inventory.length,
      customers: dataset.customers.length,
      bookings: dataset.bookings.length,
      bookingRequests: dataset.bookingRequests.length,
      transactions: dataset.transactions.length,
    },
  };
}
