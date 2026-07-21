import { isDomainRole, type Auth } from "./auth";
import type {
  Booking,
  BookingRequest,
  Customer,
  KebayaItem,
  Measurement,
  Tenant,
  TenantDataset,
  Transaction,
  User,
} from "@/data/mock";

/**
 * Server-side, tenant-scoped read layer (ADR-0002, ADR-0004 / ticket 04).
 *
 * This is THE data seam for reads: every query is scoped `WHERE tenant_id = ?`,
 * and the tenant id always comes from the validated session — never from client
 * input. Routes must not run ad-hoc queries; they call `getTenantBootstrap`
 * (or `getSessionScopedBootstrap`, which derives the tenant from the session).
 *
 * It reverse-maps D1 rows back into the domain shapes the client store already
 * consumes (`src/data/mock.ts`), so the store's read internals swap from
 * localStorage/seed to this fetch with the `useTenant()` interface unchanged.
 */

export interface TenantBootstrap {
  tenant: Tenant | null;
  team: User[];
  dataset: TenantDataset;
}

export class InventoryActionError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "InventoryActionError";
  }
}

interface InventoryActionSession {
  tenantId: string;
  role?: unknown;
}

interface InventoryFields {
  name: string;
  inventoryCode: string;
  sizeLabel: string;
  model: string;
  color: string;
  wearStyle: KebayaItem["wearStyle"];
  includes: string[];
  occasions: string[];
  rentCondition: KebayaItem["rentCondition"];
  size: KebayaItem["size"];
  rentalPrice: number;
  cost: number;
  description: string;
  conditionGrade: KebayaItem["conditionGrade"];
  qrCode: string;
  photos: string[];
}

/* ---------- small coercions (SQLite returns loose types) ---------- */

type Row = Record<string, unknown>;

const str = (v: unknown): string => (v == null ? "" : String(v));
const optStr = (v: unknown): string | undefined => (v == null ? undefined : String(v));
const num = (v: unknown): number => Number(v ?? 0);
const optNum = (v: unknown): number | undefined => (v == null ? undefined : Number(v));

function parseJson<T>(v: unknown, fallback: T): T {
  if (typeof v !== "string" || v === "") return fallback;
  try {
    return JSON.parse(v) as T;
  } catch {
    return fallback;
  }
}

const READABLE_ID_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const MAX_INVENTORY_PHOTOS = 10;

function generateReadableId(prefix: string): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  const suffix = Array.from(bytes, (byte) => READABLE_ID_ALPHABET[byte % READABLE_ID_ALPHABET.length]).join("");
  return `${prefix}-${suffix}`;
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function requiredText(row: Row, key: string, label: string): string {
  const value = str(row[key]).trim();
  if (!value) throw new InventoryActionError(400, `${label} is required.`);
  return value;
}

function optionalText(row: Row, key: string): string {
  return str(row[key]).trim();
}

function integer(row: Row, key: string): number {
  const value = Number(row[key] ?? 0);
  return Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
}

function stringList(value: unknown, max = 100): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => str(entry).trim())
    .filter(Boolean)
    .slice(0, max);
}

function record(value: unknown): Row {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new InventoryActionError(400, "Invalid inventory payload.");
  }
  return value as Row;
}

function sizeDetail(value: unknown): KebayaItem["size"] {
  const row = record(value ?? {});
  return {
    bust: integer(row, "bust"),
    waist: integer(row, "waist"),
    length: integer(row, "length"),
    sleeve: integer(row, "sleeve"),
  };
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

function inventoryFields(input: unknown, fallbackCode: string): InventoryFields {
  const row = record(input);
  const inventoryCode = optionalText(row, "inventoryCode") || fallbackCode;
  return {
    name: requiredText(row, "name", "Name"),
    inventoryCode,
    sizeLabel: requiredText(row, "sizeLabel", "Size label"),
    model: requiredText(row, "model", "Model"),
    color: requiredText(row, "color", "Color"),
    wearStyle: oneOf(row.wearStyle, ["hijab", "non-hijab"] as const, "hijab"),
    includes: stringList(row.includes),
    occasions: stringList(row.occasions),
    rentCondition: oneOf(row.rentCondition, ["in-town", "shipping", "both"] as const, "both"),
    size: sizeDetail(row.size),
    rentalPrice: integer(row, "rentalPrice"),
    cost: integer(row, "cost"),
    description: optionalText(row, "description"),
    conditionGrade: oneOf(row.conditionGrade, ["A", "B", "C"] as const, "A"),
    qrCode: optionalText(row, "qrCode") || inventoryCode,
    photos: stringList(row.photos, MAX_INVENTORY_PHOTOS),
  };
}

function itemId(input: unknown): string {
  return requiredText(record(input), "id", "Inventory item");
}

function inventoryPayloadTenant(input: unknown): string | null {
  const row = record(input);
  const tenantId = row.tenantId ?? row.tenant_id;
  return typeof tenantId === "string" && tenantId.trim() ? tenantId.trim() : null;
}

function jsonError(message: string, status: number): Response {
  return Response.json({ error: message }, { status });
}

function canWriteInventory(session: InventoryActionSession): boolean {
  return session.role === "owner";
}

function actionError(error: unknown): InventoryActionError {
  if (error instanceof InventoryActionError) return error;
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("UNIQUE constraint failed: inventory_items.tenant_id, inventory_items.inventory_code")) {
    return new InventoryActionError(409, "Inventory code already exists.");
  }
  return new InventoryActionError(500, "Inventory could not be saved.");
}

/* ---------- row → domain mappers ---------- */

function toTenant(r: Row): Tenant {
  return {
    id: str(r.id),
    name: str(r.name),
    subdomain: str(r.subdomain),
    location: str(r.location),
    whatsapp: str(r.whatsapp),
    bookingDepositAmount: num(r.booking_deposit_amount),
    bookingDepositPolicy: str(r.booking_deposit_policy) as Tenant["bookingDepositPolicy"],
    plan: str(r.plan) as Tenant["plan"],
    billingStatus: str(r.billing_status) as Tenant["billingStatus"],
    status: str(r.status) as Tenant["status"],
    onboardingStatus: str(r.onboarding_status) as Tenant["onboardingStatus"],
    logoUrl: optStr(r.logo_url),
    limitOverrides: parseJson(r.limit_overrides_json, {}),
  };
}

function toUser(r: Row): User {
  return {
    id: str(r.id),
    tenantId: str(r.tenant_id),
    name: str(r.name),
    role: str(r.role) as User["role"],
  };
}

function toItem(r: Row): KebayaItem {
  return {
    id: str(r.id),
    tenantId: str(r.tenant_id),
    name: str(r.name),
    inventoryCode: str(r.inventory_code),
    sizeLabel: str(r.size_label),
    model: str(r.model),
    color: str(r.color),
    wearStyle: str(r.wear_style) as KebayaItem["wearStyle"],
    includes: parseJson<string[]>(r.includes_json, []),
    occasions: parseJson<string[]>(r.occasions_json, []),
    rentCondition: str(r.rent_condition) as KebayaItem["rentCondition"],
    size: {
      bust: num(r.bust),
      waist: num(r.waist),
      length: num(r.length),
      sleeve: num(r.sleeve),
    },
    rentalPrice: num(r.rental_price),
    cost: num(r.cost),
    description: str(r.description),
    status: str(r.status) as KebayaItem["status"],
    conditionGrade: str(r.condition_grade) as KebayaItem["conditionGrade"],
    qrCode: str(r.qr_code),
    photos: parseJson<string[]>(r.photos_json, []),
    dateAdded: str(r.date_added),
    timesRented: num(r.times_rented),
  };
}

function toCustomer(r: Row, measurements: Measurement[]): Customer {
  const eventType = optStr(r.event_type);
  const eventDate = optStr(r.event_date);
  return {
    id: str(r.id),
    tenantId: str(r.tenant_id),
    name: str(r.name),
    whatsapp: str(r.whatsapp),
    instagram: optStr(r.instagram),
    email: optStr(r.email),
    event: eventType ? { type: eventType, date: eventDate ?? "" } : undefined,
    measurements,
    totalRentals: num(r.total_rentals),
    lastRental: str(r.last_rental),
  };
}

function toBooking(r: Row, itemIds: string[]): Booking {
  return {
    id: str(r.id),
    tenantId: str(r.tenant_id),
    customerId: str(r.customer_id),
    itemIds,
    startDate: str(r.start_date),
    endDate: str(r.end_date),
    status: str(r.status) as Booking["status"],
    total: num(r.total),
    deposit: num(r.deposit),
    notes: optStr(r.notes),
  };
}

function toBookingRequest(r: Row): BookingRequest {
  return {
    id: str(r.id),
    tenantId: str(r.tenant_id),
    itemId: str(r.item_id),
    customerName: str(r.customer_name),
    whatsapp: str(r.whatsapp),
    eventType: optStr(r.event_type),
    eventDate: optStr(r.event_date),
    startDate: str(r.start_date),
    endDate: str(r.end_date),
    depositAmount: num(r.deposit_amount),
    depositPolicy: str(r.deposit_policy) as BookingRequest["depositPolicy"],
    paymentStatus: str(r.payment_status) as BookingRequest["paymentStatus"],
    status: str(r.status) as BookingRequest["status"],
    expiresAt: str(r.expires_at),
    notes: optStr(r.notes),
    createdAt: str(r.created_at),
  };
}

function toTransaction(r: Row, itemIds: string[]): Transaction {
  return {
    id: str(r.id),
    tenantId: str(r.tenant_id),
    bookingId: str(r.booking_id),
    transactionType: (optStr(r.transaction_type) as Transaction["transactionType"]) ?? undefined,
    date: str(r.date),
    deposit: num(r.deposit),
    lateFee: num(r.late_fee),
    damageFee: num(r.damage_fee),
    total: num(r.total),
    method: str(r.method) as Transaction["method"],
    paymentStatus: str(r.payment_status) as Transaction["paymentStatus"],
    itemIds,
    customerName: optStr(r.customer_name),
    customerWhatsapp: optStr(r.customer_whatsapp),
    cashierName: optStr(r.cashier_name),
    rentalTotal: optNum(r.rental_total),
    baseRental: optNum(r.base_rental),
    extraDayFee: optNum(r.extra_day_fee),
    notes: optStr(r.notes),
    returnNotes: optStr(r.return_notes),
    depositReturned: optNum(r.deposit_returned),
    amountDue: optNum(r.amount_due),
    evidence: parseJson<Transaction["evidence"]>(r.evidence_json, undefined),
  };
}

/** Groups join-table rows (booking_items / transaction_items) by their parent id. */
function groupItemIds(rows: Row[], parentKey: string): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const row of rows) {
    const parent = str(row[parentKey]);
    const list = map.get(parent) ?? [];
    list.push(str(row.item_id));
    map.set(parent, list);
  }
  return map;
}

/**
 * Returns the full dataset for one tenant, scoped server-side. All queries are
 * filtered by `tenantId`, so cross-tenant reads are impossible by construction.
 */
export async function getTenantBootstrap(db: D1Database, tenantId: string): Promise<TenantBootstrap> {
  const [
    tenantRes,
    teamRes,
    inventoryRes,
    customersRes,
    measurementsRes,
    bookingsRes,
    bookingItemsRes,
    bookingRequestsRes,
    transactionsRes,
    transactionItemsRes,
    monthlyRevenueRes,
  ] = await db.batch<Row>([
    db.prepare(`SELECT * FROM tenants WHERE id = ?`).bind(tenantId),
    db.prepare(`SELECT id, tenant_id, name, role FROM "user" WHERE tenant_id = ? ORDER BY name`).bind(tenantId),
    db.prepare(`SELECT * FROM inventory_items WHERE tenant_id = ? ORDER BY date_added DESC`).bind(tenantId),
    db.prepare(`SELECT * FROM customers WHERE tenant_id = ?`).bind(tenantId),
    db
      .prepare(
        `SELECT cm.customer_id, cm.bust, cm.waist, cm.hip, cm.recorded_at
         FROM customer_measurements cm
         JOIN customers c ON c.id = cm.customer_id
         WHERE c.tenant_id = ?`,
      )
      .bind(tenantId),
    db.prepare(`SELECT * FROM bookings WHERE tenant_id = ?`).bind(tenantId),
    db.prepare(`SELECT booking_id, item_id FROM booking_items WHERE tenant_id = ?`).bind(tenantId),
    db.prepare(`SELECT * FROM booking_requests WHERE tenant_id = ?`).bind(tenantId),
    db.prepare(`SELECT * FROM transactions WHERE tenant_id = ?`).bind(tenantId),
    db.prepare(`SELECT transaction_id, item_id FROM transaction_items WHERE tenant_id = ?`).bind(tenantId),
    db.prepare(`SELECT month, revenue FROM monthly_revenue WHERE tenant_id = ?`).bind(tenantId),
  ]);

  const tenantRow = tenantRes.results[0];
  const tenant = tenantRow ? toTenant(tenantRow) : null;
  const team = teamRes.results.map(toUser);

  const inventory = inventoryRes.results.map(toItem);

  // measurements grouped by customer
  const measurementsByCustomer = new Map<string, Measurement[]>();
  for (const m of measurementsRes.results) {
    const cid = str(m.customer_id);
    const list = measurementsByCustomer.get(cid) ?? [];
    list.push({ bust: num(m.bust), waist: num(m.waist), hip: num(m.hip), recordedAt: str(m.recorded_at) });
    measurementsByCustomer.set(cid, list);
  }
  const customers = customersRes.results.map((r) =>
    toCustomer(r, measurementsByCustomer.get(str(r.id)) ?? []),
  );

  const bookingItemIds = groupItemIds(bookingItemsRes.results, "booking_id");
  const bookings = bookingsRes.results.map((r) => toBooking(r, bookingItemIds.get(str(r.id)) ?? []));

  const bookingRequests = bookingRequestsRes.results.map(toBookingRequest);

  const transactionItemIds = groupItemIds(transactionItemsRes.results, "transaction_id");
  const transactions = transactionsRes.results.map((r) =>
    toTransaction(r, transactionItemIds.get(str(r.id)) ?? []),
  );

  const monthlyRevenue = monthlyRevenueRes.results.map((r) => ({
    month: str(r.month),
    revenue: num(r.revenue),
  }));

  const dataset: TenantDataset = {
    inventory,
    customers,
    bookingRequests,
    bookings,
    transactions,
    monthlyRevenue,
  };

  return { tenant, team, dataset };
}

export async function addInventoryItem(
  db: D1Database,
  tenantId: string,
  input: unknown,
): Promise<KebayaItem> {
  const id = generateReadableId("I");
  const fallbackCode = `KBY-${id.slice(2)}`;
  const fields = inventoryFields(input, fallbackCode);
  const dateAdded = todayIsoDate();

  try {
    const [, itemRes] = await db.batch<Row>([
      db
        .prepare(
          `INSERT INTO inventory_items
            (id, tenant_id, name, inventory_code, size_label, model, color, wear_style,
             includes_json, occasions_json, rent_condition, bust, waist, length, sleeve,
             rental_price, cost, description, status, condition_grade, qr_code, photos_json,
             date_added, times_rented)
           SELECT ?, t.id, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'available', ?, ?, ?, ?, 0
           FROM tenants t
           WHERE t.id = ? AND t.status = 'active'`,
        )
        .bind(
          id,
          fields.name,
          fields.inventoryCode,
          fields.sizeLabel,
          fields.model,
          fields.color,
          fields.wearStyle,
          JSON.stringify(fields.includes),
          JSON.stringify(fields.occasions),
          fields.rentCondition,
          fields.size.bust,
          fields.size.waist,
          fields.size.length,
          fields.size.sleeve,
          fields.rentalPrice,
          fields.cost,
          fields.description,
          fields.conditionGrade,
          fields.qrCode,
          JSON.stringify(fields.photos),
          dateAdded,
          tenantId,
        ),
      db.prepare(`SELECT * FROM inventory_items WHERE id = ? AND tenant_id = ?`).bind(id, tenantId),
    ]);

    const row = itemRes.results[0];
    if (!row) throw new InventoryActionError(403, "Tenant cannot add inventory.");
    return toItem(row);
  } catch (error) {
    throw actionError(error);
  }
}

export async function editInventoryItem(
  db: D1Database,
  tenantId: string,
  input: unknown,
): Promise<KebayaItem> {
  const id = itemId(input);
  const fields = inventoryFields(input, "");
  if (!fields.inventoryCode) throw new InventoryActionError(400, "Inventory code is required.");

  try {
    const [, itemRes] = await db.batch<Row>([
      db
        .prepare(
          `UPDATE inventory_items
           SET name = ?,
               inventory_code = ?,
               size_label = ?,
               model = ?,
               color = ?,
               wear_style = ?,
               includes_json = ?,
               occasions_json = ?,
               rent_condition = ?,
               bust = ?,
               waist = ?,
               length = ?,
               sleeve = ?,
               rental_price = ?,
               cost = ?,
               description = ?,
               condition_grade = ?,
               qr_code = ?,
               photos_json = ?,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = ? AND tenant_id = ?`,
        )
        .bind(
          fields.name,
          fields.inventoryCode,
          fields.sizeLabel,
          fields.model,
          fields.color,
          fields.wearStyle,
          JSON.stringify(fields.includes),
          JSON.stringify(fields.occasions),
          fields.rentCondition,
          fields.size.bust,
          fields.size.waist,
          fields.size.length,
          fields.size.sleeve,
          fields.rentalPrice,
          fields.cost,
          fields.description,
          fields.conditionGrade,
          fields.qrCode,
          JSON.stringify(fields.photos),
          id,
          tenantId,
        ),
      db.prepare(`SELECT * FROM inventory_items WHERE id = ? AND tenant_id = ?`).bind(id, tenantId),
    ]);

    const row = itemRes.results[0];
    if (!row) throw new InventoryActionError(404, "Inventory item not found.");
    return toItem(row);
  } catch (error) {
    throw actionError(error);
  }
}

export async function handleInventoryAddRequest(
  request: Request,
  session: InventoryActionSession | null,
  db: D1Database,
): Promise<Response> {
  if (!session) return jsonError("Unauthorized", 401);
  if (!canWriteInventory(session)) return jsonError("Only owners can manage inventory.", 403);
  try {
    const payload = await request.json();
    const requestedTenant = inventoryPayloadTenant(payload);
    if (requestedTenant && requestedTenant !== session.tenantId) {
      return jsonError("Cannot write inventory for another tenant.", 403);
    }
    const item = await addInventoryItem(db, session.tenantId, payload);
    return Response.json({ item });
  } catch (error) {
    const mapped = actionError(error);
    return jsonError(mapped.message, mapped.status);
  }
}

export async function handleInventoryEditRequest(
  request: Request,
  session: InventoryActionSession | null,
  db: D1Database,
): Promise<Response> {
  if (!session) return jsonError("Unauthorized", 401);
  if (!canWriteInventory(session)) return jsonError("Only owners can manage inventory.", 403);
  try {
    const payload = await request.json();
    const requestedTenant = inventoryPayloadTenant(payload);
    if (requestedTenant && requestedTenant !== session.tenantId) {
      return jsonError("Cannot write inventory for another tenant.", 403);
    }
    const item = await editInventoryItem(db, session.tenantId, payload);
    return Response.json({ item });
  } catch (error) {
    const mapped = actionError(error);
    return jsonError(mapped.message, mapped.status);
  }
}

/**
 * Route seam: validates the session and returns the caller's bootstrap, or
 * `null` if unauthenticated / missing a tenant. The tenant is taken from the
 * session user, so a request can only ever read its own tenant's data.
 */
export async function getSessionScopedBootstrap(
  auth: Auth,
  headers: Headers,
  db: D1Database,
): Promise<TenantBootstrap | null> {
  const session = await auth.api.getSession({ headers });
  if (!session) return null;
  const user = session.user as typeof session.user & { tenant_id?: unknown; role?: unknown };
  const tenantId = typeof user.tenant_id === "string" && user.tenant_id ? user.tenant_id : null;
  if (!tenantId || !isDomainRole(user.role)) return null;
  return getTenantBootstrap(db, tenantId);
}
