import { isDomainRole, type Auth } from "./auth";
import { normalizePhone } from "./phone.js";
import { buildFinanceSummary, type FinanceSummary, type FinanceSummaryOptions } from "../data/finance";
import { rulesForTenant } from "../data/plans";
import type {
  Booking,
  BookingRequest,
  Customer,
  KebayaItem,
  Measurement,
  PaymentMethod,
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
  financeSummary: FinanceSummary;
}

export interface TenantActionReceipt {
  tenant: Tenant;
  booking: Booking;
  transaction: Transaction;
  customer: Customer;
  items: KebayaItem[];
  cashierName: string;
  financeSummary: FinanceSummary;
}

export type { FinanceSummary };

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

interface PosActionSession {
  tenantId: string;
  name: string;
  role?: unknown;
}

export interface StaffProvisionSession {
  tenantId: string;
  role?: unknown;
  /** The acting user — used to stop an owner revoking their own access. */
  userId?: string;
}

export interface StaffProvisionReceipt {
  user: User;
  team: User[];
}

export interface StaffAccessInput {
  userId: string;
  active: boolean;
}

export interface AccountPasswordInput {
  currentPassword: string;
  newPassword: string;
}

export interface MeasurementInput {
  customerId: string;
  bust: number;
  waist: number;
  hip: number;
}

export interface MeasurementReceipt {
  customer: Customer;
}

export interface StaffPasswordInput {
  userId: string;
  password: string;
}

export interface PosOpenInput {
  itemIds: string[];
  customerName: string;
  whatsapp: string;
  instagram?: string;
  email?: string;
  startDate: string;
  endDate: string;
  baseRental: number;
  extraDayFee: number;
  rentalTotal: number;
  deposit: number;
  method: PaymentMethod;
  notes?: string;
  evidence?: {
    idPhotoName?: string;
    clientPhotoName?: string;
  };
}

interface PosOpenFields extends PosOpenInput {
  normalizedWhatsapp: string;
}

export interface PosCloseInput {
  bookingId: string;
  returnDate: string;
  lateFee: number;
  damageFee: number;
  method: PaymentMethod;
  notes?: string;
  returnDisposition?: "available" | "maintenance";
}

interface PosCloseFields extends PosCloseInput {
  returnDisposition: "available" | "maintenance";
}

export interface ReservationInput {
  itemIds: string[];
  customerName: string;
  whatsapp: string;
  instagram?: string;
  email?: string;
  eventType?: string;
  eventDate?: string;
  startDate: string;
  endDate: string;
  rentalTotal: number;
  deposit: number;
  notes?: string;
}

interface ReservationFields extends ReservationInput {
  normalizedWhatsapp: string;
}

export interface ReservationReceipt {
  tenant: Tenant;
  customer: Customer;
  booking: Booking;
  items: KebayaItem[];
  financeSummary: FinanceSummary;
}

export interface PublicBookingRequestInput {
  tenantId: string;
  itemId: string;
  customerName: string;
  whatsapp: string;
  eventType?: string;
  eventDate?: string;
  startDate: string;
  endDate: string;
  notes?: string;
}

interface PublicBookingRequestFields extends PublicBookingRequestInput {
  normalizedWhatsapp: string;
}

export interface PublicBookingRequestReceipt {
  request: BookingRequest;
}

/**
 * The PUBLIC projection of a shop — deliberately narrow. A visitor sees the
 * shop's contact card, the pieces, and which dates are already taken. They
 * never see customers, transactions, revenue, or an item's `cost`.
 */
export interface PublicStoreItem {
  id: string;
  name: string;
  inventoryCode: string;
  model: string;
  color: string;
  sizeLabel: string;
  wearStyle: KebayaItem["wearStyle"];
  occasions: string[];
  rentalPrice: number;
  photos: string[];
}

/** An anonymous "already taken" range — no customer, no money. */
export interface PublicStoreBusy {
  itemId: string;
  startDate: string;
  endDate: string;
}

export interface PublicStore {
  tenant: {
    id: string;
    name: string;
    subdomain: string;
    location: string;
    whatsapp: string;
    bookingDepositAmount: number;
    bookingDepositPolicy: Tenant["bookingDepositPolicy"];
  };
  items: PublicStoreItem[];
  busy: PublicStoreBusy[];
}

export interface BookingRequestApprovalReceipt {
  request: BookingRequest;
  booking: Booking;
  customer: Customer;
  items: KebayaItem[];
  financeSummary: FinanceSummary;
}

export interface BookingRequestRejectionReceipt {
  request: BookingRequest;
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

interface StaffProvisionFields {
  email: string;
  password: string;
  name: string;
  role: Extract<User["role"], "cashier" | "fitting">;
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
const PAYMENT_METHODS: PaymentMethod[] = ["QRIS", "GoPay", "OVO", "DANA", "Cash", "Card"];
const STAFF_PROVISION_ROLES = ["cashier", "fitting"] as const;

function generateReadableId(prefix: string): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  const suffix = Array.from(bytes, (byte) => READABLE_ID_ALPHABET[byte % READABLE_ID_ALPHABET.length]).join("");
  return `${prefix}-${suffix}`;
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Every ISO date from `startDate`..`endDate` inclusive — one entry per day the
 * item is held. Rental ranges are days, not months; a hard cap keeps a fat-
 * fingered date from expanding into a runaway insert list.
 */
const MAX_BOOKING_DAYS = 366;
function datesInRange(startDate: string, endDate: string): string[] {
  const start = Date.parse(`${startDate}T00:00:00Z`);
  const end = Date.parse(`${endDate}T00:00:00Z`);
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) {
    throw new InventoryActionError(400, "Select a valid rental date range.");
  }
  const dates: string[] = [];
  for (let t = start; t <= end; t += 86_400_000) {
    dates.push(new Date(t).toISOString().slice(0, 10));
    if (dates.length > MAX_BOOKING_DAYS) {
      throw new InventoryActionError(400, "Rental date range is too long.");
    }
  }
  return dates;
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

function positiveItemIds(value: unknown): string[] {
  if (!Array.isArray(value)) throw new InventoryActionError(400, "Select inventory items before checkout.");
  const ids = Array.from(new Set(value.map((entry) => str(entry).trim()).filter(Boolean)));
  if (ids.length === 0) throw new InventoryActionError(400, "Select inventory items before checkout.");
  return ids;
}

function optionalNonEmpty(row: Row, key: string): string | undefined {
  return optionalText(row, key) || undefined;
}

function money(row: Row, key: string): number {
  return integer(row, key);
}

function paymentMethod(value: unknown): PaymentMethod {
  if (typeof value === "string" && PAYMENT_METHODS.includes(value as PaymentMethod)) {
    return value as PaymentMethod;
  }
  throw new InventoryActionError(400, "Select a valid payment method.");
}

function staffProvisionRole(value: unknown): StaffProvisionFields["role"] {
  if (typeof value === "string" && STAFF_PROVISION_ROLES.includes(value as StaffProvisionFields["role"])) {
    return value as StaffProvisionFields["role"];
  }
  throw new InventoryActionError(400, "Select a valid staff role.");
}

function staffProvisionFields(input: unknown): StaffProvisionFields {
  const row = record(input);
  const email = requiredText(row, "email", "Email").toLowerCase();
  const password = requiredText(row, "password", "Initial password");
  const name = requiredText(row, "name", "Staff name");
  const role = staffProvisionRole(row.role);
  if (password.length < 8) throw new InventoryActionError(400, "Initial password must be at least 8 characters.");
  return { email, password, name, role };
}

function accountPasswordFields(input: unknown): AccountPasswordInput {
  const row = record(input);
  const currentPassword = requiredText(row, "currentPassword", "Current password");
  const newPassword = requiredText(row, "newPassword", "New password");
  if (newPassword.length < 8) throw new InventoryActionError(400, "New password must be at least 8 characters.");
  if (newPassword === currentPassword) {
    throw new InventoryActionError(400, "New password must be different from the current one.");
  }
  return { currentPassword, newPassword };
}

/** A body measurement in centimetres — sane bounds keep typos out of the record. */
function measurementValue(row: Row, key: string, label: string): number {
  const value = Number(row[key] ?? 0);
  if (!Number.isFinite(value) || value <= 0) throw new InventoryActionError(400, `${label} is required.`);
  const rounded = Math.round(value);
  if (rounded < 20 || rounded > 250) throw new InventoryActionError(400, `${label} must be between 20 and 250 cm.`);
  return rounded;
}

function measurementFields(input: unknown): MeasurementInput {
  const row = record(input);
  return {
    customerId: requiredText(row, "customerId", "Customer"),
    bust: measurementValue(row, "bust", "Bust"),
    waist: measurementValue(row, "waist", "Waist"),
    hip: measurementValue(row, "hip", "Hip"),
  };
}

function staffAccessFields(input: unknown): StaffAccessInput {
  const row = record(input);
  if (typeof row.active !== "boolean") {
    throw new InventoryActionError(400, "Specify whether the account should be active.");
  }
  return { userId: requiredText(row, "userId", "Staff member"), active: row.active };
}

function staffPasswordFields(input: unknown): StaffPasswordInput {
  const row = record(input);
  const password = requiredText(row, "password", "New password");
  if (password.length < 8) throw new InventoryActionError(400, "New password must be at least 8 characters.");
  return { userId: requiredText(row, "userId", "Staff member"), password };
}

function evidence(value: unknown): PosOpenInput["evidence"] {
  if (value == null) return undefined;
  const row = record(value);
  const idPhotoName = optionalNonEmpty(row, "idPhotoName");
  const clientPhotoName = optionalNonEmpty(row, "clientPhotoName");
  return idPhotoName || clientPhotoName ? { idPhotoName, clientPhotoName } : undefined;
}

function posOpenFields(input: unknown): PosOpenFields {
  const row = record(input);
  const startDate = requiredText(row, "startDate", "Start date");
  const endDate = requiredText(row, "endDate", "End date");
  if (endDate < startDate) throw new InventoryActionError(400, "Select a valid rental date range.");
  const whatsapp = requiredText(row, "whatsapp", "WhatsApp");
  const normalizedWhatsapp = normalizePhone(whatsapp);
  if (normalizedWhatsapp.length < 6) throw new InventoryActionError(400, "WhatsApp number is required.");
  return {
    itemIds: positiveItemIds(row.itemIds),
    customerName: requiredText(row, "customerName", "Customer name"),
    whatsapp,
    normalizedWhatsapp,
    instagram: optionalNonEmpty(row, "instagram"),
    email: optionalNonEmpty(row, "email"),
    startDate,
    endDate,
    baseRental: money(row, "baseRental"),
    extraDayFee: money(row, "extraDayFee"),
    rentalTotal: money(row, "rentalTotal"),
    deposit: money(row, "deposit"),
    method: paymentMethod(row.method),
    notes: optionalNonEmpty(row, "notes"),
    evidence: evidence(row.evidence),
  };
}

function posCloseFields(input: unknown): PosCloseFields {
  const row = record(input);
  const returnDisposition =
    row.returnDisposition === "available" || row.returnDisposition === "maintenance"
      ? row.returnDisposition
      : "maintenance";
  return {
    bookingId: requiredText(row, "bookingId", "Booking"),
    returnDate: requiredText(row, "returnDate", "Return date"),
    lateFee: money(row, "lateFee"),
    damageFee: money(row, "damageFee"),
    method: paymentMethod(row.method),
    notes: optionalNonEmpty(row, "notes"),
    returnDisposition,
  };
}

function reservationFields(input: unknown): ReservationFields {
  const row = record(input);
  const startDate = requiredText(row, "startDate", "Start date");
  const endDate = requiredText(row, "endDate", "End date");
  if (endDate < startDate) throw new InventoryActionError(400, "Select a valid reservation date range.");
  if (startDate <= todayIsoDate()) {
    throw new InventoryActionError(
      400,
      "Reservations are for future dates — use POS Rental for today's in-store transactions.",
    );
  }
  const whatsapp = requiredText(row, "whatsapp", "WhatsApp");
  const normalizedWhatsapp = normalizePhone(whatsapp);
  if (normalizedWhatsapp.length < 6) throw new InventoryActionError(400, "WhatsApp number is required.");
  return {
    itemIds: positiveItemIds(row.itemIds),
    customerName: requiredText(row, "customerName", "Customer name"),
    whatsapp,
    normalizedWhatsapp,
    instagram: optionalNonEmpty(row, "instagram"),
    email: optionalNonEmpty(row, "email"),
    eventType: optionalNonEmpty(row, "eventType"),
    eventDate: optionalNonEmpty(row, "eventDate"),
    startDate,
    endDate,
    rentalTotal: money(row, "rentalTotal"),
    deposit: money(row, "deposit"),
    notes: optionalNonEmpty(row, "notes"),
  };
}

/** Bounded free text for the PUBLIC endpoint — untrusted input, so cap lengths. */
function boundedText(row: Row, key: string, label: string, max: number, required: boolean): string | undefined {
  const value = str(row[key]).trim();
  if (!value) {
    if (required) throw new InventoryActionError(400, `${label} is required.`);
    return undefined;
  }
  if (value.length > max) throw new InventoryActionError(400, `${label} is too long.`);
  return value;
}

function publicBookingRequestFields(input: unknown): PublicBookingRequestFields {
  const row = record(input);
  const startDate = requiredText(row, "startDate", "Start date");
  const endDate = requiredText(row, "endDate", "End date");
  if (endDate < startDate) throw new InventoryActionError(400, "Select a valid rental date range.");
  if (startDate <= todayIsoDate()) {
    throw new InventoryActionError(400, "Online booking requests must be for a future date.");
  }
  const whatsapp = boundedText(row, "whatsapp", "WhatsApp", 32, true)!;
  const normalizedWhatsapp = normalizePhone(whatsapp);
  if (normalizedWhatsapp.length < 6) throw new InventoryActionError(400, "WhatsApp number is required.");
  return {
    tenantId: requiredText(row, "tenantId", "Store"),
    itemId: requiredText(row, "itemId", "Kebaya"),
    customerName: boundedText(row, "customerName", "Name", 120, true)!,
    whatsapp,
    normalizedWhatsapp,
    eventType: boundedText(row, "eventType", "Event type", 80, false),
    eventDate: boundedText(row, "eventDate", "Event date", 32, false),
    startDate,
    endDate,
    notes: boundedText(row, "notes", "Notes", 500, false),
  };
}

function bookingRequestId(input: unknown): string {
  return requiredText(record(input), "requestId", "Booking request");
}

function jsonError(message: string, status: number): Response {
  return Response.json({ error: message }, { status });
}

function canWriteInventory(session: InventoryActionSession): boolean {
  return session.role === "owner";
}

function canWritePosTransaction(session: PosActionSession): boolean {
  return session.role === "owner" || session.role === "cashier";
}

function canProvisionStaff(session: StaffProvisionSession): boolean {
  return session.role === "owner";
}

/** Fitting work is the fitting staff's job; the owner can always do it too. */
function canRecordFitting(session: { role?: unknown }): boolean {
  return session.role === "owner" || session.role === "fitting";
}

function actionError(error: unknown): InventoryActionError {
  if (error instanceof InventoryActionError) return error;
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("UNIQUE constraint failed: inventory_items.tenant_id, inventory_items.inventory_code")) {
    return new InventoryActionError(409, "Inventory code already exists.");
  }
  return new InventoryActionError(500, "Inventory could not be saved.");
}

function posActionError(error: unknown): InventoryActionError {
  if (error instanceof InventoryActionError) return error;
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("FOREIGN KEY constraint failed")) {
    return new InventoryActionError(409, "Only available items can be rented.");
  }
  if (message.includes("UNIQUE constraint failed")) {
    return new InventoryActionError(409, "Transaction could not be created.");
  }
  return new InventoryActionError(500, "Transaction could not be created.");
}

function posCloseActionError(error: unknown): InventoryActionError {
  if (error instanceof InventoryActionError) return error;
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("FOREIGN KEY constraint failed")) {
    return new InventoryActionError(409, "Only active rentals can be returned.");
  }
  if (message.includes("UNIQUE constraint failed")) {
    return new InventoryActionError(409, "Return could not be recorded.");
  }
  return new InventoryActionError(500, "Return could not be recorded.");
}

function reservationActionError(error: unknown): InventoryActionError {
  if (error instanceof InventoryActionError) return error;
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("UNIQUE constraint failed: booking_days")) {
    return new InventoryActionError(409, "One or more items are already reserved for those dates.");
  }
  if (message.includes("FOREIGN KEY constraint failed")) {
    return new InventoryActionError(409, "Select valid inventory items before reserving.");
  }
  return new InventoryActionError(500, "Reservation could not be created.");
}

function bookingRequestActionError(error: unknown, failure: string): InventoryActionError {
  if (error instanceof InventoryActionError) return error;
  const message = error instanceof Error ? error.message : String(error);
  // The approval writes booking_days; a clash there means the piece was
  // committed elsewhere between the request and the approval.
  if (message.includes("UNIQUE constraint failed: booking_days")) {
    return new InventoryActionError(409, "That kebaya is already booked for those dates.");
  }
  if (message.includes("FOREIGN KEY constraint failed")) {
    return new InventoryActionError(409, "Booking request could not be completed.");
  }
  return new InventoryActionError(500, failure);
}

function staffAdminActionError(error: unknown, failure: string): InventoryActionError {
  if (error instanceof InventoryActionError) return error;
  const status = typeof error === "object" && error !== null && "statusCode" in error ? Number(error.statusCode) : 0;
  const message = error instanceof Error ? error.message : String(error);
  if (status === 401 || message.includes("UNAUTHORIZED")) {
    return new InventoryActionError(401, "Unauthorized");
  }
  if (status === 403 || message.includes("FORBIDDEN")) {
    return new InventoryActionError(403, "Only owners can manage staff accounts.");
  }
  if (status === 404 || message.includes("USER_NOT_FOUND")) {
    return new InventoryActionError(404, "Staff member not found.");
  }
  return new InventoryActionError(500, failure);
}

function staffProvisionActionError(error: unknown): InventoryActionError {
  if (error instanceof InventoryActionError) return error;
  const status = typeof error === "object" && error !== null && "statusCode" in error ? Number(error.statusCode) : 0;
  const message = error instanceof Error ? error.message : String(error);
  if (status === 401 || message.includes("UNAUTHORIZED")) {
    return new InventoryActionError(401, "Unauthorized");
  }
  if (status === 403 || message.includes("FORBIDDEN")) {
    return new InventoryActionError(403, "Only owners can create staff accounts.");
  }
  if (message.includes("USER_ALREADY_EXISTS") || message.toLowerCase().includes("already exists")) {
    return new InventoryActionError(409, "A user with that email already exists.");
  }
  return new InventoryActionError(500, "Staff account could not be created.");
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
    // better-auth stores revocation as `banned`; the domain speaks in `active`.
    active: !r.banned,
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

function rowsToTransactions(transactionRows: Row[], transactionItemRows: Row[]): Transaction[] {
  const transactionItemIds = groupItemIds(transactionItemRows, "transaction_id");
  return transactionRows.map((r) => toTransaction(r, transactionItemIds.get(str(r.id)) ?? []));
}

async function getTenantTeam(db: D1Database, tenantId: string): Promise<User[]> {
  const res = await db
    .prepare(`SELECT id, tenant_id, name, role, banned FROM "user" WHERE tenant_id = ? ORDER BY name`)
    .bind(tenantId)
    .all<Row>();
  return res.results.map(toUser);
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
    db.prepare(`SELECT id, tenant_id, name, role, banned FROM "user" WHERE tenant_id = ? ORDER BY name`).bind(tenantId),
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

  const transactions = rowsToTransactions(transactionsRes.results, transactionItemsRes.results);

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

  return { tenant, team, dataset, financeSummary: buildFinanceSummary(transactions) };
}

export async function getTenantFinanceSummary(
  db: D1Database,
  tenantId: string,
  options: FinanceSummaryOptions = {},
): Promise<FinanceSummary> {
  const [transactionsRes, transactionItemsRes] = await db.batch<Row>([
    db.prepare(`SELECT * FROM transactions WHERE tenant_id = ? ORDER BY date DESC, created_at DESC`).bind(tenantId),
    db.prepare(`SELECT transaction_id, item_id FROM transaction_items WHERE tenant_id = ?`).bind(tenantId),
  ]);
  const transactions = rowsToTransactions(transactionsRes.results, transactionItemsRes.results);
  return buildFinanceSummary(transactions, options);
}

export async function provisionStaffAccount(
  auth: Auth,
  db: D1Database,
  session: StaffProvisionSession,
  headers: Headers,
  input: unknown,
): Promise<StaffProvisionReceipt> {
  const fields = staffProvisionFields(input);
  if (!canProvisionStaff(session)) {
    throw new InventoryActionError(403, "Only owners can create staff accounts.");
  }

  const [tenantRes, countRes] = await db.batch<Row>([
    db.prepare(`SELECT * FROM tenants WHERE id = ? AND status = 'active'`).bind(session.tenantId),
    db.prepare(`SELECT COUNT(*) AS count FROM "user" WHERE tenant_id = ?`).bind(session.tenantId),
  ]);
  const tenantRow = tenantRes.results[0];
  if (!tenantRow) throw new InventoryActionError(403, "Tenant cannot create staff accounts.");

  const tenant = toTenant(tenantRow);
  const planRules = rulesForTenant(tenant);
  const currentStaff = num(countRes.results[0]?.count);
  if (currentStaff >= planRules.staffLimit) {
    throw new InventoryActionError(
      409,
      `${tenant.name} can have ${planRules.staffLimit} total user(s) on the current plan.`,
    );
  }

  try {
    await auth.api.createUser({
      headers,
      body: {
        email: fields.email,
        password: fields.password,
        name: fields.name,
        role: fields.role,
        data: { tenant_id: session.tenantId },
      },
    });

    const userRow = await db
      .prepare(`SELECT id, tenant_id, name, role, banned FROM "user" WHERE tenant_id = ? AND email = ?`)
      .bind(session.tenantId, fields.email)
      .first<Row>();
    if (!userRow) throw new InventoryActionError(500, "Staff account could not be created.");
    const team = await getTenantTeam(db, session.tenantId);
    return { user: toUser(userRow), team };
  } catch (error) {
    throw staffProvisionActionError(error);
  }
}

export async function handleStaffProvisionRequest(
  request: Request,
  session: StaffProvisionSession | null,
  auth: Auth,
  headers: Headers,
  db: D1Database,
): Promise<Response> {
  if (!session) return jsonError("Unauthorized", 401);
  if (!canProvisionStaff(session)) return jsonError("Only owners can create staff accounts.", 403);
  try {
    const payload = await request.json();
    const receipt = await provisionStaffAccount(auth, db, session, headers, payload);
    return Response.json(receipt);
  } catch (error) {
    const mapped = staffProvisionActionError(error);
    return jsonError(mapped.message, mapped.status);
  }
}

/**
 * Change your OWN password. Distinct from the owner's staff reset (which needs
 * no current password): here the caller must prove they know the existing one,
 * so a walk-up at an unlocked counter machine cannot silently seize an account.
 */
export async function changeOwnPassword(
  auth: Auth,
  headers: Headers,
  input: unknown,
): Promise<{ ok: true }> {
  const fields = accountPasswordFields(input);
  try {
    await auth.api.changePassword({
      headers,
      body: {
        currentPassword: fields.currentPassword,
        newPassword: fields.newPassword,
        revokeOtherSessions: true,
      },
    });
    return { ok: true };
  } catch (error) {
    const status =
      typeof error === "object" && error !== null && "statusCode" in error ? Number(error.statusCode) : 0;
    const message = error instanceof Error ? error.message : String(error);
    if (error instanceof InventoryActionError) throw error;
    if (status === 400 || /invalid|incorrect|password/i.test(message)) {
      throw new InventoryActionError(400, "Current password is incorrect.");
    }
    if (status === 401) throw new InventoryActionError(401, "Unauthorized");
    throw new InventoryActionError(500, "Password could not be changed.");
  }
}

export async function handleAccountPasswordRequest(
  request: Request,
  session: { role?: unknown } | null,
  auth: Auth,
  headers: Headers,
): Promise<Response> {
  if (!session) return jsonError("Unauthorized", 401);
  try {
    return Response.json(await changeOwnPassword(auth, headers, await request.json()));
  } catch (error) {
    const mapped =
      error instanceof InventoryActionError
        ? error
        : new InventoryActionError(500, "Password could not be changed.");
    return jsonError(mapped.message, mapped.status);
  }
}

/**
 * Record a fitting measurement against a customer. Tenant-scoped: the customer
 * is resolved through the session's tenant, so no id from the client can reach
 * another shop's record.
 */
export async function recordMeasurement(
  db: D1Database,
  session: { tenantId: string; role?: unknown },
  input: unknown,
): Promise<MeasurementReceipt> {
  const fields = measurementFields(input);
  if (!canRecordFitting(session)) {
    throw new InventoryActionError(403, "Only owner and fitting staff can record measurements.");
  }

  const customerRow = await db
    .prepare(`SELECT * FROM customers WHERE id = ? AND tenant_id = ?`)
    .bind(fields.customerId, session.tenantId)
    .first<Row>();
  if (!customerRow) throw new InventoryActionError(404, "Customer not found.");

  try {
    const [, measurementRes] = await db.batch<Row>([
      db
        .prepare(
          `INSERT INTO customer_measurements (customer_id, bust, waist, hip, recorded_at)
           VALUES (?, ?, ?, ?, ?)`,
        )
        .bind(fields.customerId, fields.bust, fields.waist, fields.hip, todayIsoDate()),
      db
        .prepare(
          `SELECT cm.bust, cm.waist, cm.hip, cm.recorded_at
           FROM customer_measurements cm
           JOIN customers c ON c.id = cm.customer_id
           WHERE cm.customer_id = ? AND c.tenant_id = ?
           ORDER BY cm.recorded_at`,
        )
        .bind(fields.customerId, session.tenantId),
    ]);

    const measurements: Measurement[] = measurementRes.results.map((m) => ({
      bust: num(m.bust),
      waist: num(m.waist),
      hip: num(m.hip),
      recordedAt: str(m.recorded_at),
    }));
    return { customer: toCustomer(customerRow, measurements) };
  } catch (error) {
    if (error instanceof InventoryActionError) throw error;
    throw new InventoryActionError(500, "Measurement could not be saved.");
  }
}

export async function handleMeasurementRequest(
  request: Request,
  session: { tenantId: string; role?: unknown } | null,
  db: D1Database,
): Promise<Response> {
  if (!session) return jsonError("Unauthorized", 401);
  if (!canRecordFitting(session)) {
    return jsonError("Only owner and fitting staff can record measurements.", 403);
  }
  try {
    return Response.json(await recordMeasurement(db, session, await request.json()));
  } catch (error) {
    const mapped =
      error instanceof InventoryActionError
        ? error
        : new InventoryActionError(500, "Measurement could not be saved.");
    return jsonError(mapped.message, mapped.status);
  }
}

/**
 * Resolve a staff member the acting owner is allowed to administer.
 *
 * Tenant isolation is inviolable (CONTEXT.md rule 1): the target is looked up
 * scoped to the SESSION's tenant, so an owner can never reach another shop's
 * user even by guessing an id. Owners are excluded as targets, and an owner
 * cannot act on themselves — together that makes it impossible to lock a shop
 * out of its own account.
 */
async function resolveManageableStaff(
  db: D1Database,
  session: StaffProvisionSession,
  userId: string,
): Promise<Row> {
  const row = await db
    .prepare(`SELECT id, tenant_id, name, role, banned FROM "user" WHERE id = ? AND tenant_id = ?`)
    .bind(userId, session.tenantId)
    .first<Row>();
  if (!row) throw new InventoryActionError(404, "Staff member not found.");
  if (session.userId && str(row.id) === session.userId) {
    throw new InventoryActionError(400, "You cannot change your own access.");
  }
  if (str(row.role) === "owner") {
    throw new InventoryActionError(403, "The owner account cannot be changed here.");
  }
  return row;
}

async function staffAfterAdminAction(
  db: D1Database,
  session: StaffProvisionSession,
  userId: string,
  failure: string,
): Promise<StaffProvisionReceipt> {
  const userRow = await db
    .prepare(`SELECT id, tenant_id, name, role, banned FROM "user" WHERE id = ? AND tenant_id = ?`)
    .bind(userId, session.tenantId)
    .first<Row>();
  if (!userRow) throw new InventoryActionError(500, failure);
  return { user: toUser(userRow), team: await getTenantTeam(db, session.tenantId) };
}

/**
 * Revoke (or restore) a staff member's access. Deactivation bans the account
 * rather than deleting it, so historical `cashier_name` attribution on past
 * transactions stays intact.
 */
export async function setStaffAccess(
  auth: Auth,
  db: D1Database,
  session: StaffProvisionSession,
  headers: Headers,
  input: unknown,
): Promise<StaffProvisionReceipt> {
  const fields = staffAccessFields(input);
  if (!canProvisionStaff(session)) {
    throw new InventoryActionError(403, "Only owners can change staff access.");
  }
  await resolveManageableStaff(db, session, fields.userId);

  try {
    if (fields.active) {
      await auth.api.unbanUser({ headers, body: { userId: fields.userId } });
    } else {
      await auth.api.banUser({
        headers,
        body: { userId: fields.userId, banReason: "Access revoked by owner" },
      });
    }
    return await staffAfterAdminAction(db, session, fields.userId, "Staff access could not be updated.");
  } catch (error) {
    throw staffAdminActionError(error, "Staff access could not be updated.");
  }
}

/** Owner-initiated password reset for a staff member who is locked out. */
export async function resetStaffPassword(
  auth: Auth,
  db: D1Database,
  session: StaffProvisionSession,
  headers: Headers,
  input: unknown,
): Promise<StaffProvisionReceipt> {
  const fields = staffPasswordFields(input);
  if (!canProvisionStaff(session)) {
    throw new InventoryActionError(403, "Only owners can reset staff passwords.");
  }
  await resolveManageableStaff(db, session, fields.userId);

  try {
    await auth.api.setUserPassword({
      headers,
      body: { userId: fields.userId, newPassword: fields.password },
    });
    return await staffAfterAdminAction(db, session, fields.userId, "Password could not be reset.");
  } catch (error) {
    throw staffAdminActionError(error, "Password could not be reset.");
  }
}

export async function handleStaffAccessRequest(
  request: Request,
  session: StaffProvisionSession | null,
  auth: Auth,
  headers: Headers,
  db: D1Database,
): Promise<Response> {
  if (!session) return jsonError("Unauthorized", 401);
  if (!canProvisionStaff(session)) return jsonError("Only owners can change staff access.", 403);
  try {
    const receipt = await setStaffAccess(auth, db, session, headers, await request.json());
    return Response.json(receipt);
  } catch (error) {
    const mapped = staffAdminActionError(error, "Staff access could not be updated.");
    return jsonError(mapped.message, mapped.status);
  }
}

export async function handleStaffPasswordRequest(
  request: Request,
  session: StaffProvisionSession | null,
  auth: Auth,
  headers: Headers,
  db: D1Database,
): Promise<Response> {
  if (!session) return jsonError("Unauthorized", 401);
  if (!canProvisionStaff(session)) return jsonError("Only owners can reset staff passwords.", 403);
  try {
    const receipt = await resetStaffPassword(auth, db, session, headers, await request.json());
    return Response.json(receipt);
  } catch (error) {
    const mapped = staffAdminActionError(error, "Password could not be reset.");
    return jsonError(mapped.message, mapped.status);
  }
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

function placeholders(count: number): string {
  return Array.from({ length: count }, () => "?").join(", ");
}

export async function openPosTransaction(
  db: D1Database,
  session: PosActionSession,
  input: unknown,
): Promise<TenantActionReceipt> {
  const fields = posOpenFields(input);
  const customerId = generateReadableId("C");
  const bookingId = generateReadableId("B");
  const transactionId = generateReadableId("T");
  const transactionDate = todayIsoDate();
  const itemPlaceholders = placeholders(fields.itemIds.length);
  const totalDue = fields.rentalTotal + fields.deposit;
  const evidenceJson = JSON.stringify(fields.evidence ?? {});
  const rentalDays = datesInRange(fields.startDate, fields.endDate);

  try {
    const batch = [
      db
        .prepare(
          `INSERT INTO customers
            (id, tenant_id, name, whatsapp, normalized_whatsapp, instagram, email,
             total_rentals, last_rental)
           VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)
           ON CONFLICT(tenant_id, normalized_whatsapp) DO UPDATE SET
             name = excluded.name,
             whatsapp = excluded.whatsapp,
             instagram = COALESCE(excluded.instagram, customers.instagram),
             email = COALESCE(excluded.email, customers.email),
             total_rentals = customers.total_rentals + 1,
             last_rental = excluded.last_rental,
             updated_at = CURRENT_TIMESTAMP`,
        )
        .bind(
          customerId,
          session.tenantId,
          fields.customerName,
          fields.whatsapp,
          fields.normalizedWhatsapp,
          fields.instagram ?? null,
          fields.email ?? null,
          fields.startDate,
        ),
      db
        .prepare(
          `INSERT INTO bookings
            (id, tenant_id, customer_id, start_date, end_date, status, total, deposit, notes)
           SELECT ?, ?, c.id, ?, ?, 'active', ?, ?, ?
           FROM customers c
           WHERE c.tenant_id = ? AND c.normalized_whatsapp = ?
             AND (
               SELECT COUNT(*)
               FROM inventory_items
               WHERE tenant_id = ? AND status = 'available' AND id IN (${itemPlaceholders})
             ) = ?`,
        )
        .bind(
          bookingId,
          session.tenantId,
          fields.startDate,
          fields.endDate,
          fields.rentalTotal,
          fields.deposit,
          fields.notes ?? null,
          session.tenantId,
          fields.normalizedWhatsapp,
          session.tenantId,
          ...fields.itemIds,
          fields.itemIds.length,
        ),
      ...fields.itemIds.map((itemId) =>
        db
          .prepare(`INSERT INTO booking_items (booking_id, item_id, tenant_id) VALUES (?, ?, ?)`)
          .bind(bookingId, itemId, session.tenantId),
      ),
      db
        .prepare(
          `INSERT INTO transactions
            (id, tenant_id, booking_id, transaction_type, date, deposit, late_fee, damage_fee,
             total, method, payment_status, customer_name, customer_whatsapp, cashier_name,
             rental_total, base_rental, extra_day_fee, notes, evidence_json)
           SELECT ?, ?, b.id, 'open', ?, ?, 0, 0, ?, ?, 'paid', ?, ?, ?, ?, ?, ?, ?, ?
           FROM bookings b
           WHERE b.id = ? AND b.tenant_id = ?`,
        )
        .bind(
          transactionId,
          session.tenantId,
          transactionDate,
          fields.deposit,
          totalDue,
          fields.method,
          fields.customerName,
          fields.whatsapp,
          session.name,
          fields.rentalTotal,
          fields.baseRental,
          fields.extraDayFee,
          fields.notes ?? null,
          evidenceJson,
          bookingId,
          session.tenantId,
        ),
      ...fields.itemIds.map((itemId) =>
        db
          .prepare(`INSERT INTO transaction_items (transaction_id, item_id, tenant_id) VALUES (?, ?, ?)`)
          .bind(transactionId, itemId, session.tenantId),
      ),
      db
        .prepare(
          `UPDATE inventory_items
           SET status = 'rented',
               times_rented = times_rented + 1,
               updated_at = CURRENT_TIMESTAMP
           WHERE tenant_id = ? AND status = 'available' AND id IN (${itemPlaceholders})`,
        )
        .bind(session.tenantId, ...fields.itemIds),
      // Occupy the rental's dates in the availability engine. If any item is
      // already committed for a day in this range (e.g. a forward reservation),
      // the (item_id, date) primary key fails and aborts the whole checkout.
      ...rentalDays.flatMap((date) =>
        fields.itemIds.map((itemId) =>
          db
            .prepare(`INSERT INTO booking_days (tenant_id, item_id, date, booking_id) VALUES (?, ?, ?, ?)`)
            .bind(session.tenantId, itemId, date, bookingId),
        ),
      ),
      db.prepare(`SELECT * FROM tenants WHERE id = ?`).bind(session.tenantId),
      db
        .prepare(`SELECT * FROM customers WHERE tenant_id = ? AND normalized_whatsapp = ?`)
        .bind(session.tenantId, fields.normalizedWhatsapp),
      db.prepare(`SELECT * FROM bookings WHERE id = ? AND tenant_id = ?`).bind(bookingId, session.tenantId),
      db.prepare(`SELECT booking_id, item_id FROM booking_items WHERE booking_id = ? ORDER BY rowid`).bind(bookingId),
      db.prepare(`SELECT * FROM transactions WHERE id = ? AND tenant_id = ?`).bind(transactionId, session.tenantId),
      db
        .prepare(`SELECT transaction_id, item_id FROM transaction_items WHERE transaction_id = ? ORDER BY rowid`)
        .bind(transactionId),
      db
        .prepare(`SELECT * FROM inventory_items WHERE tenant_id = ? AND id IN (${itemPlaceholders})`)
        .bind(session.tenantId, ...fields.itemIds),
    ] satisfies D1PreparedStatement[];

    const results = await db.batch<Row>(batch);
    // Writes before the select-backs: customer, booking, N booking_items,
    // transaction, N transaction_items, inventory update, then
    // (rentalDays × itemIds) booking_days rows.
    const baseIndex = 4 + fields.itemIds.length * 2 + rentalDays.length * fields.itemIds.length;
    const tenantRow = results[baseIndex].results[0];
    const customerRow = results[baseIndex + 1].results[0];
    const bookingRow = results[baseIndex + 2].results[0];
    const bookingItemRows = results[baseIndex + 3].results;
    const transactionRow = results[baseIndex + 4].results[0];
    const transactionItemRows = results[baseIndex + 5].results;
    const itemRows = results[baseIndex + 6].results;

    if (!tenantRow || !customerRow || !bookingRow || !transactionRow || itemRows.length !== fields.itemIds.length) {
      throw new InventoryActionError(409, "Only available items can be rented.");
    }

    const bookingItemIds = bookingItemRows.map((row) => str(row.item_id));
    const transactionItemIds = transactionItemRows.map((row) => str(row.item_id));
    const itemsById = new Map(itemRows.map((row) => [str(row.id), toItem(row)]));
    const items = fields.itemIds.map((id) => itemsById.get(id)).filter((item): item is KebayaItem => Boolean(item));
    if (items.length !== fields.itemIds.length || items.some((item) => item.status !== "rented")) {
      throw new InventoryActionError(409, "Only available items can be rented.");
    }

    return {
      tenant: toTenant(tenantRow),
      customer: toCustomer(customerRow, []),
      booking: toBooking(bookingRow, bookingItemIds),
      transaction: toTransaction(transactionRow, transactionItemIds),
      items,
      cashierName: session.name,
      financeSummary: await getTenantFinanceSummary(db, session.tenantId),
    };
  } catch (error) {
    throw posActionError(error);
  }
}

export async function handlePosOpenRequest(
  request: Request,
  session: PosActionSession | null,
  db: D1Database,
): Promise<Response> {
  if (!session) return jsonError("Unauthorized", 401);
  if (!canWritePosTransaction(session)) return jsonError("Only owner and cashier users can open rentals.", 403);
  try {
    const payload = await request.json();
    const receipt = await openPosTransaction(db, session, payload);
    return Response.json({ receipt });
  } catch (error) {
    const mapped = posActionError(error);
    return jsonError(mapped.message, mapped.status);
  }
}

/**
 * Create a confirmed FORWARD reservation (ADR-0002, Phase 2). Unlike a POS
 * checkout, this does not touch inventory `status` — a piece booked for next
 * month is still available today. The double-booking guarantee comes entirely
 * from the booking_days inserts: the (item_id, date) primary key makes any
 * overlapping commitment — another reservation OR an active POS rental — abort
 * the whole batch. There is no read-then-write race to reason about.
 */
export async function createReservation(
  db: D1Database,
  session: PosActionSession,
  input: unknown,
): Promise<ReservationReceipt> {
  const fields = reservationFields(input);
  const customerId = generateReadableId("C");
  const bookingId = generateReadableId("B");
  const itemPlaceholders = placeholders(fields.itemIds.length);
  const reservationDays = datesInRange(fields.startDate, fields.endDate);

  // Plan gate, server-side: forward booking is a Starter+ feature. Enforced
  // here from the tenant's effective rules, not just in the client.
  const tenantForPlan = await db.prepare(`SELECT * FROM tenants WHERE id = ?`).bind(session.tenantId).first<Row>();
  if (!tenantForPlan) throw new InventoryActionError(404, "Store not found.");
  if (!rulesForTenant(toTenant(tenantForPlan)).manualBookingEnabled) {
    throw new InventoryActionError(403, "Manual booking is available on Starter and Pro. Upgrade to create reservations.");
  }

  try {
    const batch = [
      // Customer upsert — a reservation does NOT increment total_rentals
      // (nothing has gone out yet); it only refreshes contact details + event.
      db
        .prepare(
          `INSERT INTO customers
            (id, tenant_id, name, whatsapp, normalized_whatsapp, instagram, email, event_type, event_date,
             total_rentals, last_rental)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
           ON CONFLICT(tenant_id, normalized_whatsapp) DO UPDATE SET
             name = excluded.name,
             whatsapp = excluded.whatsapp,
             instagram = COALESCE(excluded.instagram, customers.instagram),
             email = COALESCE(excluded.email, customers.email),
             event_type = COALESCE(excluded.event_type, customers.event_type),
             event_date = COALESCE(excluded.event_date, customers.event_date),
             updated_at = CURRENT_TIMESTAMP`,
        )
        .bind(
          customerId,
          session.tenantId,
          fields.customerName,
          fields.whatsapp,
          fields.normalizedWhatsapp,
          fields.instagram ?? null,
          fields.email ?? null,
          fields.eventType ?? null,
          fields.eventDate ?? null,
          fields.startDate,
        ),
      // Confirmed booking — inserted only if every item id belongs to this
      // tenant. (Date availability is enforced by the booking_days inserts.)
      db
        .prepare(
          `INSERT INTO bookings
            (id, tenant_id, customer_id, start_date, end_date, status, total, deposit, notes)
           SELECT ?, ?, c.id, ?, ?, 'confirmed', ?, ?, ?
           FROM customers c
           WHERE c.tenant_id = ? AND c.normalized_whatsapp = ?
             AND (
               SELECT COUNT(*) FROM inventory_items
               WHERE tenant_id = ? AND id IN (${itemPlaceholders})
             ) = ?`,
        )
        .bind(
          bookingId,
          session.tenantId,
          fields.startDate,
          fields.endDate,
          fields.rentalTotal,
          fields.deposit,
          fields.notes ?? null,
          session.tenantId,
          fields.normalizedWhatsapp,
          session.tenantId,
          ...fields.itemIds,
          fields.itemIds.length,
        ),
      ...fields.itemIds.map((itemId) =>
        db
          .prepare(`INSERT INTO booking_items (booking_id, item_id, tenant_id) VALUES (?, ?, ?)`)
          .bind(bookingId, itemId, session.tenantId),
      ),
      ...reservationDays.flatMap((date) =>
        fields.itemIds.map((itemId) =>
          db
            .prepare(`INSERT INTO booking_days (tenant_id, item_id, date, booking_id) VALUES (?, ?, ?, ?)`)
            .bind(session.tenantId, itemId, date, bookingId),
        ),
      ),
      db.prepare(`SELECT * FROM tenants WHERE id = ?`).bind(session.tenantId),
      db
        .prepare(`SELECT * FROM customers WHERE tenant_id = ? AND normalized_whatsapp = ?`)
        .bind(session.tenantId, fields.normalizedWhatsapp),
      db.prepare(`SELECT * FROM bookings WHERE id = ? AND tenant_id = ?`).bind(bookingId, session.tenantId),
      db.prepare(`SELECT booking_id, item_id FROM booking_items WHERE booking_id = ? ORDER BY rowid`).bind(bookingId),
      db
        .prepare(`SELECT * FROM inventory_items WHERE tenant_id = ? AND id IN (${itemPlaceholders})`)
        .bind(session.tenantId, ...fields.itemIds),
    ] satisfies D1PreparedStatement[];

    const results = await db.batch<Row>(batch);
    // Writes before the select-backs: customer, booking, N booking_items,
    // (reservationDays × itemIds) booking_days rows.
    const baseIndex = 2 + fields.itemIds.length + reservationDays.length * fields.itemIds.length;
    const tenantRow = results[baseIndex].results[0];
    const customerRow = results[baseIndex + 1].results[0];
    const bookingRow = results[baseIndex + 2].results[0];
    const bookingItemRows = results[baseIndex + 3].results;
    const itemRows = results[baseIndex + 4].results;

    if (!tenantRow || !customerRow || !bookingRow || itemRows.length !== fields.itemIds.length) {
      throw new InventoryActionError(409, "One or more items could not be reserved.");
    }

    const bookingItemIds = bookingItemRows.map((row) => str(row.item_id));
    const itemsById = new Map(itemRows.map((row) => [str(row.id), toItem(row)]));
    const items = fields.itemIds
      .map((id) => itemsById.get(id))
      .filter((item): item is KebayaItem => Boolean(item));

    return {
      tenant: toTenant(tenantRow),
      customer: toCustomer(customerRow, []),
      booking: toBooking(bookingRow, bookingItemIds),
      items,
      financeSummary: await getTenantFinanceSummary(db, session.tenantId),
    };
  } catch (error) {
    throw reservationActionError(error);
  }
}

export async function handleReservationRequest(
  request: Request,
  session: PosActionSession | null,
  db: D1Database,
): Promise<Response> {
  if (!session) return jsonError("Unauthorized", 401);
  if (!canWritePosTransaction(session)) return jsonError("Only owner and cashier users can create reservations.", 403);
  try {
    const payload = await request.json();
    const receipt = await createReservation(db, session, payload);
    return Response.json({ receipt });
  } catch (error) {
    const mapped = reservationActionError(error);
    return jsonError(mapped.message, mapped.status);
  }
}

/*
 * ---------------------------------------------------------------------------
 * Public booking requests (Pro, reserve-only — CONCEPT.md)
 *
 * A request is an ENQUIRY, not a commitment: it deliberately does NOT write
 * booking_days, so a pending request never blocks availability. Only the
 * owner's approval turns it into a confirmed booking that occupies dates.
 * ---------------------------------------------------------------------------
 */

/** Flood guards for the one unauthenticated write endpoint in the app. */
const MAX_PENDING_REQUESTS_PER_CONTACT = 3;
const MAX_PENDING_REQUESTS_PER_TENANT = 200;
const BOOKING_REQUEST_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Read a shop's PUBLIC booking page by slug. Returns null when the page should
 * not exist at all — unknown shop, suspended, or not on a plan with public
 * booking — so the caller can 404 without revealing which of those it was.
 *
 * The projection is the privacy boundary: only the columns a visitor needs.
 */
export async function getPublicStore(db: D1Database, slug: string): Promise<PublicStore | null> {
  const tenantRow = await db.prepare(`SELECT * FROM tenants WHERE id = ?`).bind(slug).first<Row>();
  if (!tenantRow) return null;
  const tenant = toTenant(tenantRow);
  if (tenant.status === "suspended" || !rulesForTenant(tenant).publicBookingEnabled) return null;

  const [itemRes, busyRes] = await db.batch<Row>([
    db
      .prepare(
        `SELECT id, name, inventory_code, model, color, size_label, wear_style, occasions_json, rental_price, photos_json
         FROM inventory_items
         WHERE tenant_id = ? AND status != 'maintenance'
         ORDER BY name`,
      )
      .bind(tenant.id),
    // Anonymous occupancy only: which piece is held between which dates.
    db
      .prepare(
        `SELECT bi.item_id AS item_id, b.start_date AS start_date, b.end_date AS end_date
         FROM bookings b
         JOIN booking_items bi ON bi.booking_id = b.id AND bi.tenant_id = b.tenant_id
         WHERE b.tenant_id = ? AND b.status IN ('confirmed', 'active', 'late')`,
      )
      .bind(tenant.id),
  ]);

  return {
    tenant: {
      id: tenant.id,
      name: tenant.name,
      subdomain: tenant.subdomain,
      location: tenant.location,
      whatsapp: tenant.whatsapp,
      bookingDepositAmount: tenant.bookingDepositAmount,
      bookingDepositPolicy: tenant.bookingDepositPolicy,
    },
    items: itemRes.results.map((r) => ({
      id: str(r.id),
      name: str(r.name),
      inventoryCode: str(r.inventory_code),
      model: str(r.model),
      color: str(r.color),
      sizeLabel: str(r.size_label),
      wearStyle: str(r.wear_style) === "non-hijab" ? "non-hijab" : "hijab",
      occasions: parseJson<string[]>(r.occasions_json, []),
      rentalPrice: num(r.rental_price),
      photos: parseJson<string[]>(r.photos_json, []),
    })),
    busy: busyRes.results.map((r) => ({
      itemId: str(r.item_id),
      startDate: str(r.start_date),
      endDate: str(r.end_date),
    })),
  };
}

export async function handlePublicStoreRequest(slug: string, db: D1Database): Promise<Response> {
  const store = await getPublicStore(db, slug);
  if (!store) return jsonError("Booking page is not available.", 404);
  return Response.json(store);
}

/**
 * Create a booking request from the PUBLIC store page. There is no session
 * here — the tenant arrives as a URL slug — so every fact is re-derived and
 * re-validated server-side: the shop must exist, be active, and actually carry
 * the Pro public-booking feature; the item must belong to that shop.
 */
export async function createPublicBookingRequest(
  db: D1Database,
  input: unknown,
): Promise<PublicBookingRequestReceipt> {
  const fields = publicBookingRequestFields(input);
  const requestId = generateReadableId("BR");
  const expiresAt = new Date(Date.now() + BOOKING_REQUEST_TTL_MS).toISOString();

  const tenantRow = await db.prepare(`SELECT * FROM tenants WHERE id = ?`).bind(fields.tenantId).first<Row>();
  // A missing, suspended, or non-Pro shop is indistinguishable from the outside:
  // the public page simply does not exist.
  if (!tenantRow) throw new InventoryActionError(404, "Booking page is not available.");
  const tenant = toTenant(tenantRow);
  if (tenant.status === "suspended" || !rulesForTenant(tenant).publicBookingEnabled) {
    throw new InventoryActionError(404, "Booking page is not available.");
  }

  const item = await db
    .prepare(`SELECT id FROM inventory_items WHERE id = ? AND tenant_id = ?`)
    .bind(fields.itemId, tenant.id)
    .first<Row>();
  if (!item) throw new InventoryActionError(404, "Selected item is no longer available.");

  // Cap how many pending requests one contact — and one shop — can accumulate.
  // This is a flood guard, NOT a substitute for real IP rate limiting, which
  // needs infrastructure (KV/Durable Objects) beyond this slice.
  const pending = await db
    .prepare(
      `SELECT
         (SELECT COUNT(*) FROM booking_requests WHERE tenant_id = ? AND status = 'pending') AS shop,
         (SELECT COUNT(*) FROM booking_requests WHERE tenant_id = ? AND status = 'pending' AND whatsapp = ?) AS contact`,
    )
    .bind(tenant.id, tenant.id, fields.whatsapp)
    .first<Row>();
  if (num(pending?.contact) >= MAX_PENDING_REQUESTS_PER_CONTACT) {
    throw new InventoryActionError(429, "You already have booking requests waiting. Please contact the store directly.");
  }
  if (num(pending?.shop) >= MAX_PENDING_REQUESTS_PER_TENANT) {
    throw new InventoryActionError(429, "This store is not accepting new online requests right now.");
  }

  try {
    await db
      .prepare(
        `INSERT INTO booking_requests
          (id, tenant_id, item_id, customer_name, whatsapp, event_type, event_date, start_date, end_date,
           deposit_amount, deposit_policy, payment_status, status, expires_at, notes, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'unpaid', 'pending', ?, ?, ?)`,
      )
      .bind(
        requestId,
        tenant.id,
        fields.itemId,
        fields.customerName,
        fields.whatsapp,
        fields.eventType ?? null,
        fields.eventDate ?? null,
        fields.startDate,
        fields.endDate,
        tenant.bookingDepositAmount,
        tenant.bookingDepositPolicy,
        expiresAt,
        fields.notes ?? null,
        new Date().toISOString(),
      )
      .run();

    const row = await db
      .prepare(`SELECT * FROM booking_requests WHERE id = ? AND tenant_id = ?`)
      .bind(requestId, tenant.id)
      .first<Row>();
    if (!row) throw new InventoryActionError(500, "Booking request could not be sent.");
    return { request: toBookingRequest(row) };
  } catch (error) {
    throw bookingRequestActionError(error, "Booking request could not be sent.");
  }
}

/**
 * Owner/cashier approves a pending request, turning it into a confirmed
 * booking. The booking_days inserts carry the same double-booking guarantee as
 * a manual reservation: if the piece was committed elsewhere in the meantime,
 * the whole approval aborts and the request stays pending.
 */
export async function approveBookingRequest(
  db: D1Database,
  session: PosActionSession,
  input: unknown,
): Promise<BookingRequestApprovalReceipt> {
  const requestId = bookingRequestId(input);
  if (!canWritePosTransaction(session)) {
    throw new InventoryActionError(403, "Only owner and cashier users can approve booking requests.");
  }

  const requestRow = await db
    .prepare(`SELECT * FROM booking_requests WHERE id = ? AND tenant_id = ?`)
    .bind(requestId, session.tenantId)
    .first<Row>();
  if (!requestRow) throw new InventoryActionError(404, "Booking request not found.");
  if (str(requestRow.status) !== "pending") {
    throw new InventoryActionError(409, "Only pending booking requests can be approved.");
  }

  const itemRow = await db
    .prepare(`SELECT * FROM inventory_items WHERE id = ? AND tenant_id = ?`)
    .bind(str(requestRow.item_id), session.tenantId)
    .first<Row>();
  if (!itemRow) throw new InventoryActionError(409, "Requested item no longer exists.");

  const itemId = str(requestRow.item_id);
  const startDate = str(requestRow.start_date);
  const endDate = str(requestRow.end_date);
  const whatsapp = str(requestRow.whatsapp);
  const normalizedWhatsapp = normalizePhone(whatsapp);
  const customerId = generateReadableId("C");
  const bookingId = generateReadableId("B");
  const reservationDays = datesInRange(startDate, endDate);

  try {
    const batch = [
      db
        .prepare(
          `INSERT INTO customers
            (id, tenant_id, name, whatsapp, normalized_whatsapp, event_type, event_date, total_rentals, last_rental)
           VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)
           ON CONFLICT(tenant_id, normalized_whatsapp) DO UPDATE SET
             name = excluded.name,
             whatsapp = excluded.whatsapp,
             event_type = COALESCE(excluded.event_type, customers.event_type),
             event_date = COALESCE(excluded.event_date, customers.event_date),
             updated_at = CURRENT_TIMESTAMP`,
        )
        .bind(
          customerId,
          session.tenantId,
          str(requestRow.customer_name),
          whatsapp,
          normalizedWhatsapp,
          requestRow.event_type ?? null,
          requestRow.event_date ?? null,
          startDate,
        ),
      // Only inserts while the request is still pending — so two racing
      // approvals cannot both produce a booking.
      db
        .prepare(
          `INSERT INTO bookings
            (id, tenant_id, customer_id, start_date, end_date, status, total, deposit, notes)
           SELECT ?, ?, c.id, ?, ?, 'confirmed', ?, ?, ?
           FROM customers c
           WHERE c.tenant_id = ? AND c.normalized_whatsapp = ?
             AND EXISTS (
               SELECT 1 FROM booking_requests r
               WHERE r.id = ? AND r.tenant_id = ? AND r.status = 'pending'
             )`,
        )
        .bind(
          bookingId,
          session.tenantId,
          startDate,
          endDate,
          num(itemRow.rental_price),
          num(requestRow.deposit_amount),
          requestRow.notes ?? null,
          session.tenantId,
          normalizedWhatsapp,
          requestId,
          session.tenantId,
        ),
      db
        .prepare(`INSERT INTO booking_items (booking_id, item_id, tenant_id) VALUES (?, ?, ?)`)
        .bind(bookingId, itemId, session.tenantId),
      ...reservationDays.map((date) =>
        db
          .prepare(`INSERT INTO booking_days (tenant_id, item_id, date, booking_id) VALUES (?, ?, ?, ?)`)
          .bind(session.tenantId, itemId, date, bookingId),
      ),
      db
        .prepare(
          `UPDATE booking_requests SET status = 'approved'
           WHERE id = ? AND tenant_id = ? AND status = 'pending'`,
        )
        .bind(requestId, session.tenantId),
      db.prepare(`SELECT * FROM booking_requests WHERE id = ? AND tenant_id = ?`).bind(requestId, session.tenantId),
      db
        .prepare(`SELECT * FROM customers WHERE tenant_id = ? AND normalized_whatsapp = ?`)
        .bind(session.tenantId, normalizedWhatsapp),
      db.prepare(`SELECT * FROM bookings WHERE id = ? AND tenant_id = ?`).bind(bookingId, session.tenantId),
      db.prepare(`SELECT * FROM inventory_items WHERE id = ? AND tenant_id = ?`).bind(itemId, session.tenantId),
    ] satisfies D1PreparedStatement[];

    const results = await db.batch<Row>(batch);
    // Writes: customer, booking, booking_items, N booking_days, request update.
    const baseIndex = 4 + reservationDays.length;
    const updatedRequest = results[baseIndex].results[0];
    const customerRow = results[baseIndex + 1].results[0];
    const bookingRow = results[baseIndex + 2].results[0];
    const finalItemRow = results[baseIndex + 3].results[0];

    if (!updatedRequest || !customerRow || !bookingRow || !finalItemRow) {
      throw new InventoryActionError(409, "Booking request could not be approved.");
    }
    if (str(updatedRequest.status) !== "approved") {
      throw new InventoryActionError(409, "Only pending booking requests can be approved.");
    }

    return {
      request: toBookingRequest(updatedRequest),
      booking: toBooking(bookingRow, [itemId]),
      customer: toCustomer(customerRow, []),
      items: [toItem(finalItemRow)],
      financeSummary: await getTenantFinanceSummary(db, session.tenantId),
    };
  } catch (error) {
    throw bookingRequestActionError(error, "Booking request could not be approved.");
  }
}

/** Owner/cashier declines a pending request. */
export async function rejectBookingRequest(
  db: D1Database,
  session: PosActionSession,
  input: unknown,
): Promise<BookingRequestRejectionReceipt> {
  const requestId = bookingRequestId(input);
  if (!canWritePosTransaction(session)) {
    throw new InventoryActionError(403, "Only owner and cashier users can reject booking requests.");
  }

  try {
    const [, readBack] = await db.batch<Row>([
      db
        .prepare(
          `UPDATE booking_requests SET status = 'rejected'
           WHERE id = ? AND tenant_id = ? AND status = 'pending'`,
        )
        .bind(requestId, session.tenantId),
      db.prepare(`SELECT * FROM booking_requests WHERE id = ? AND tenant_id = ?`).bind(requestId, session.tenantId),
    ]);

    const row = readBack.results[0];
    if (!row) throw new InventoryActionError(404, "Booking request not found.");
    if (str(row.status) !== "rejected") {
      throw new InventoryActionError(409, "Only pending booking requests can be rejected.");
    }
    return { request: toBookingRequest(row) };
  } catch (error) {
    throw bookingRequestActionError(error, "Booking request could not be rejected.");
  }
}

export async function handlePublicBookingRequest(request: Request, db: D1Database): Promise<Response> {
  try {
    const receipt = await createPublicBookingRequest(db, await request.json());
    return Response.json(receipt);
  } catch (error) {
    const mapped = bookingRequestActionError(error, "Booking request could not be sent.");
    return jsonError(mapped.message, mapped.status);
  }
}

export async function handleBookingRequestApproval(
  request: Request,
  session: PosActionSession | null,
  db: D1Database,
): Promise<Response> {
  if (!session) return jsonError("Unauthorized", 401);
  if (!canWritePosTransaction(session)) {
    return jsonError("Only owner and cashier users can approve booking requests.", 403);
  }
  try {
    const receipt = await approveBookingRequest(db, session, await request.json());
    return Response.json({ receipt });
  } catch (error) {
    const mapped = bookingRequestActionError(error, "Booking request could not be approved.");
    return jsonError(mapped.message, mapped.status);
  }
}

export async function handleBookingRequestRejection(
  request: Request,
  session: PosActionSession | null,
  db: D1Database,
): Promise<Response> {
  if (!session) return jsonError("Unauthorized", 401);
  if (!canWritePosTransaction(session)) {
    return jsonError("Only owner and cashier users can reject booking requests.", 403);
  }
  try {
    const receipt = await rejectBookingRequest(db, session, await request.json());
    return Response.json({ receipt });
  } catch (error) {
    const mapped = bookingRequestActionError(error, "Booking request could not be rejected.");
    return jsonError(mapped.message, mapped.status);
  }
}

export async function closePosTransaction(
  db: D1Database,
  session: PosActionSession,
  input: unknown,
): Promise<TenantActionReceipt> {
  const fields = posCloseFields(input);
  const transactionId = generateReadableId("T");
  const targetStatus = fields.returnDisposition;
  const totalFees = fields.lateFee + fields.damageFee;

  try {
    const results = await db.batch<Row>([
      db
        .prepare(
          `INSERT INTO transactions
            (id, tenant_id, booking_id, transaction_type, date, deposit, late_fee, damage_fee,
             total, method, payment_status, customer_name, customer_whatsapp, cashier_name,
             rental_total, return_notes, deposit_returned, amount_due, evidence_json)
           SELECT ?, b.tenant_id, b.id, 'close', ?, b.deposit, ?, ?,
             CASE WHEN ? > b.deposit THEN ? - b.deposit ELSE 0 END,
             ?, 'refunded', c.name, c.whatsapp, ?, b.total, ?,
             CASE WHEN b.deposit > ? THEN b.deposit - ? ELSE 0 END,
             CASE WHEN ? > b.deposit THEN ? - b.deposit ELSE 0 END,
             '{}'
           FROM bookings b
           JOIN customers c ON c.id = b.customer_id AND c.tenant_id = b.tenant_id
           WHERE b.id = ? AND b.tenant_id = ? AND b.status = 'active'
             AND (
               SELECT COUNT(*)
               FROM booking_items bi
               JOIN inventory_items i ON i.id = bi.item_id AND i.tenant_id = bi.tenant_id
               WHERE bi.booking_id = b.id AND bi.tenant_id = b.tenant_id AND i.status = 'rented'
             ) = (
               SELECT COUNT(*)
               FROM booking_items bi
               WHERE bi.booking_id = b.id AND bi.tenant_id = b.tenant_id
             )
             AND (
               SELECT COUNT(*)
               FROM booking_items bi
               WHERE bi.booking_id = b.id AND bi.tenant_id = b.tenant_id
             ) > 0`,
        )
        .bind(
          transactionId,
          fields.returnDate,
          fields.lateFee,
          fields.damageFee,
          totalFees,
          totalFees,
          fields.method,
          session.name,
          fields.notes ?? null,
          totalFees,
          totalFees,
          totalFees,
          totalFees,
          fields.bookingId,
          session.tenantId,
        ),
      db
        .prepare(
          `INSERT INTO transaction_items (transaction_id, item_id, tenant_id)
           SELECT t.id, bi.item_id, bi.tenant_id
           FROM transactions t
           JOIN booking_items bi ON bi.booking_id = t.booking_id AND bi.tenant_id = t.tenant_id
           WHERE t.id = ? AND t.tenant_id = ?`,
        )
        .bind(transactionId, session.tenantId),
      db
        .prepare(
          `UPDATE bookings
           SET status = 'returned',
               updated_at = CURRENT_TIMESTAMP
           WHERE id = ? AND tenant_id = ? AND status = 'active'
             AND EXISTS (
               SELECT 1
               FROM transactions t
               WHERE t.id = ? AND t.booking_id = bookings.id AND t.tenant_id = bookings.tenant_id
             )`,
        )
        .bind(fields.bookingId, session.tenantId, transactionId),
      db
        .prepare(
          `UPDATE inventory_items
           SET status = ?,
               updated_at = CURRENT_TIMESTAMP
           WHERE tenant_id = ? AND status = 'rented'
             AND id IN (
               SELECT ti.item_id
               FROM transaction_items ti
               WHERE ti.transaction_id = ? AND ti.tenant_id = ?
             )`,
        )
        .bind(targetStatus, session.tenantId, transactionId, session.tenantId),
      // Returning the pieces frees their days back into the availability engine.
      db
        .prepare(`DELETE FROM booking_days WHERE booking_id = ? AND tenant_id = ?`)
        .bind(fields.bookingId, session.tenantId),
      db.prepare(`SELECT * FROM tenants WHERE id = ?`).bind(session.tenantId),
      db
        .prepare(
          `SELECT c.*
           FROM customers c
           JOIN bookings b ON b.customer_id = c.id AND b.tenant_id = c.tenant_id
           WHERE b.id = ? AND b.tenant_id = ?`,
        )
        .bind(fields.bookingId, session.tenantId),
      db.prepare(`SELECT * FROM bookings WHERE id = ? AND tenant_id = ?`).bind(fields.bookingId, session.tenantId),
      db
        .prepare(`SELECT booking_id, item_id FROM booking_items WHERE booking_id = ? AND tenant_id = ? ORDER BY rowid`)
        .bind(fields.bookingId, session.tenantId),
      db.prepare(`SELECT * FROM transactions WHERE id = ? AND tenant_id = ?`).bind(transactionId, session.tenantId),
      db
        .prepare(`SELECT transaction_id, item_id FROM transaction_items WHERE transaction_id = ? ORDER BY rowid`)
        .bind(transactionId),
      db
        .prepare(
          `SELECT i.*
           FROM inventory_items i
           JOIN booking_items bi ON bi.item_id = i.id AND bi.tenant_id = i.tenant_id
           WHERE bi.booking_id = ? AND bi.tenant_id = ?
           ORDER BY bi.rowid`,
        )
        .bind(fields.bookingId, session.tenantId),
    ] satisfies D1PreparedStatement[]);

    // Select-backs shift by one to make room for the booking_days DELETE above.
    const tenantRow = results[5].results[0];
    const customerRow = results[6].results[0];
    const bookingRow = results[7].results[0];
    const bookingItemRows = results[8].results;
    const transactionRow = results[9].results[0];
    const transactionItemRows = results[10].results;
    const itemRows = results[11].results;

    if (!tenantRow || !customerRow || !bookingRow || !transactionRow || itemRows.length === 0) {
      throw new InventoryActionError(409, "Only active rentals can be returned.");
    }

    const bookingItemIds = bookingItemRows.map((row) => str(row.item_id));
    const transactionItemIds = transactionItemRows.map((row) => str(row.item_id));
    const items = itemRows.map(toItem);
    if (
      str(bookingRow.status) !== "returned" ||
      bookingItemIds.length !== transactionItemIds.length ||
      items.length !== bookingItemIds.length ||
      items.some((item) => item.status !== targetStatus)
    ) {
      throw new InventoryActionError(409, "Only active rentals can be returned.");
    }

    return {
      tenant: toTenant(tenantRow),
      customer: toCustomer(customerRow, []),
      booking: toBooking(bookingRow, bookingItemIds),
      transaction: toTransaction(transactionRow, transactionItemIds),
      items,
      cashierName: session.name,
      financeSummary: await getTenantFinanceSummary(db, session.tenantId),
    };
  } catch (error) {
    throw posCloseActionError(error);
  }
}

export async function handlePosCloseRequest(
  request: Request,
  session: PosActionSession | null,
  db: D1Database,
): Promise<Response> {
  if (!session) return jsonError("Unauthorized", 401);
  if (!canWritePosTransaction(session)) return jsonError("Only owner and cashier users can close rentals.", 403);
  try {
    const payload = await request.json();
    const receipt = await closePosTransaction(db, session, payload);
    return Response.json({ receipt });
  } catch (error) {
    const mapped = posCloseActionError(error);
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
