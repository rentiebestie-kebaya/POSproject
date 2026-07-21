import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { getTenantBootstrap, getTenantFinanceSummary } from "../src/lib/tenant-data";

const TENANT_ID = "finance-demo";
const OTHER_TENANT_ID = "finance-other";
const AS_OF_DATE = new Date().toISOString().slice(0, 10);

async function seedTenant(id: string, transactionScale = 1) {
  await env.DB.batch([
    env.DB
      .prepare(
        `INSERT INTO tenants (id, name, subdomain, location, whatsapp, booking_deposit_policy)
         VALUES (?, ?, ?, 'Jakarta', '+62 811-0000-0000', 'non_refundable')`,
      )
      .bind(id, `Tenant ${id}`, `${id}.rentie.id`),
    env.DB
      .prepare(
        `INSERT INTO customers
          (id, tenant_id, name, whatsapp, normalized_whatsapp, total_rentals, last_rental)
         VALUES (?, ?, 'Finance Customer', '+62 812-0000-0000', '6281200000000', 2, ?)`,
      )
      .bind(`${id}-customer`, id, AS_OF_DATE),
    env.DB
      .prepare(
        `INSERT INTO inventory_items
          (id, tenant_id, name, inventory_code, size_label, model, color, wear_style, rent_condition,
           bust, waist, length, sleeve, status, condition_grade, qr_code, date_added)
         VALUES (?, ?, 'Finance Item One', ?, 'M', 'Kebaya Modern', 'Ivory', 'hijab', 'both',
                 88, 70, 96, 54, 'rented', 'A', ?, ?)`,
      )
      .bind(`${id}-item-1`, id, `${id}-001`, `${id}-001`, AS_OF_DATE),
    env.DB
      .prepare(
        `INSERT INTO inventory_items
          (id, tenant_id, name, inventory_code, size_label, model, color, wear_style, rent_condition,
           bust, waist, length, sleeve, status, condition_grade, qr_code, date_added)
         VALUES (?, ?, 'Finance Item Two', ?, 'L', 'Dress Premium', 'Sage', 'hijab', 'both',
                 92, 74, 100, 56, 'rented', 'A', ?, ?)`,
      )
      .bind(`${id}-item-2`, id, `${id}-002`, `${id}-002`, AS_OF_DATE),
    env.DB
      .prepare(
        `INSERT INTO inventory_items
          (id, tenant_id, name, inventory_code, size_label, model, color, wear_style, rent_condition,
           bust, waist, length, sleeve, status, condition_grade, qr_code, date_added)
         VALUES (?, ?, 'Finance Item Three', ?, 'S', 'Kebaya Kutubaru', 'Blue', 'hijab', 'both',
                 84, 66, 94, 52, 'available', 'A', ?, ?)`,
      )
      .bind(`${id}-item-3`, id, `${id}-003`, `${id}-003`, AS_OF_DATE),
    env.DB
      .prepare(
        `INSERT INTO bookings (id, tenant_id, customer_id, start_date, end_date, status, total, deposit)
         VALUES (?, ?, ?, ?, ?, 'returned', ?, ?)`,
      )
      .bind(`${id}-booking-1`, id, `${id}-customer`, AS_OF_DATE, "2026-07-23", 700000 * transactionScale, 200000 * transactionScale),
    env.DB
      .prepare(
        `INSERT INTO bookings (id, tenant_id, customer_id, start_date, end_date, status, total, deposit)
         VALUES (?, ?, ?, ?, ?, 'active', ?, ?)`,
      )
      .bind(`${id}-booking-2`, id, `${id}-customer`, AS_OF_DATE, "2026-07-23", 300000 * transactionScale, 100000 * transactionScale),
    env.DB
      .prepare(
        `INSERT INTO bookings (id, tenant_id, customer_id, start_date, end_date, status, total, deposit)
         VALUES (?, ?, ?, ?, ?, 'confirmed', ?, ?)`,
      )
      .bind(`${id}-booking-3`, id, `${id}-customer`, AS_OF_DATE, "2026-07-23", 800000 * transactionScale, 199000 * transactionScale),
    env.DB
      .prepare(`INSERT INTO booking_items (booking_id, item_id, tenant_id) VALUES (?, ?, ?)`)
      .bind(`${id}-booking-1`, `${id}-item-1`, id),
    env.DB
      .prepare(`INSERT INTO booking_items (booking_id, item_id, tenant_id) VALUES (?, ?, ?)`)
      .bind(`${id}-booking-2`, `${id}-item-2`, id),
    env.DB
      .prepare(`INSERT INTO booking_items (booking_id, item_id, tenant_id) VALUES (?, ?, ?)`)
      .bind(`${id}-booking-3`, `${id}-item-3`, id),
    env.DB
      .prepare(
        `INSERT INTO transactions
          (id, tenant_id, booking_id, transaction_type, date, deposit, late_fee, damage_fee,
           total, method, payment_status, rental_total, customer_name, customer_whatsapp, cashier_name)
         VALUES (?, ?, ?, 'open', ?, ?, 0, 0, ?, 'QRIS', 'paid', ?, 'Finance Customer', '+62 812-0000-0000', 'Owner')`,
      )
      .bind(
        `${id}-tx-open-returned`,
        id,
        `${id}-booking-1`,
        AS_OF_DATE,
        200000 * transactionScale,
        900000 * transactionScale,
        700000 * transactionScale,
      ),
    env.DB
      .prepare(
        `INSERT INTO transactions
          (id, tenant_id, booking_id, transaction_type, date, deposit, late_fee, damage_fee,
           total, method, payment_status, rental_total, customer_name, customer_whatsapp, cashier_name,
           deposit_returned, amount_due)
         VALUES (?, ?, ?, 'close', ?, ?, ?, ?, 0, 'Cash', 'refunded', ?, 'Finance Customer', '+62 812-0000-0000', 'Owner', ?, 0)`,
      )
      .bind(
        `${id}-tx-close-returned`,
        id,
        `${id}-booking-1`,
        AS_OF_DATE,
        200000 * transactionScale,
        50000 * transactionScale,
        25000 * transactionScale,
        700000 * transactionScale,
        125000 * transactionScale,
      ),
    env.DB
      .prepare(
        `INSERT INTO transactions
          (id, tenant_id, booking_id, transaction_type, date, deposit, late_fee, damage_fee,
           total, method, payment_status, rental_total, customer_name, customer_whatsapp, cashier_name)
         VALUES (?, ?, ?, 'open', ?, ?, 0, 0, ?, 'DANA', 'paid', ?, 'Finance Customer', '+62 812-0000-0000', 'Owner')`,
      )
      .bind(
        `${id}-tx-open-active`,
        id,
        `${id}-booking-2`,
        AS_OF_DATE,
        100000 * transactionScale,
        400000 * transactionScale,
        300000 * transactionScale,
      ),
    env.DB
      .prepare(
        `INSERT INTO transactions
          (id, tenant_id, booking_id, transaction_type, date, deposit, late_fee, damage_fee,
           total, method, payment_status, rental_total, customer_name, customer_whatsapp, cashier_name)
         VALUES (?, ?, ?, 'open', ?, ?, 0, 0, ?, 'Card', 'pending', ?, 'Finance Customer', '+62 812-0000-0000', 'Owner')`,
      )
      .bind(
        `${id}-tx-pending`,
        id,
        `${id}-booking-3`,
        AS_OF_DATE,
        199000 * transactionScale,
        999000 * transactionScale,
        800000 * transactionScale,
      ),
  ]);
}

describe("basic finance summary", () => {
  it("derives tenant-scoped takings and revenue from recorded POS transactions", async () => {
    await seedTenant(TENANT_ID);
    await seedTenant(OTHER_TENANT_ID, 10);

    const summary = await getTenantFinanceSummary(env.DB, TENANT_ID, { asOfDate: AS_OF_DATE });

    expect(summary).toMatchObject({
      asOfDate: AS_OF_DATE,
      transactionCount: 4,
      todayTransactionCount: 4,
      checkoutTakings: 1300000,
      todayTakings: 1300000,
      todayCashOut: 125000,
      todayNetMovement: 1175000,
      rentalRevenue: 1000000,
      lateFees: 50000,
      damageFees: 25000,
      feeRevenue: 75000,
      grossRevenue: 1075000,
      depositsCollected: 300000,
      depositsReturned: 125000,
      depositsAppliedToFees: 75000,
      depositsHeld: 100000,
      outstanding: 999000,
    });
    expect(summary.paymentByMethod).toMatchObject({
      QRIS: 900000,
      DANA: 400000,
      Cash: -125000,
    });

    const bootstrap = await getTenantBootstrap(env.DB, TENANT_ID);
    expect(bootstrap.financeSummary).toEqual(summary);
  });
});
