// Seed data for the RENTIE prototype.
// Multi-tenant by design: every entity carries a tenantId and all reads must go
// through the tenant-scoped store (src/data/store.tsx) — pages never import the
// raw datasets directly. This mirrors the future Cloudflare D1 schema, where
// tenant_id is a column on every table and isolation is enforced per query.

export const TODAY = "2026-07-19";

/* ---------- shared types ---------- */

export type Role = "owner" | "cashier" | "fitting";
export type Plan = "free" | "starter" | "pro";
export type BillingStatus = "active" | "pending" | "past_due" | "cancelled";
export type StoreStatus = "active" | "suspended";
export type OnboardingStatus = "incomplete" | "complete";
export type FinanceAccess = "basic" | "full";
export type CustomerAccess = "basic" | "history" | "analytics";

export interface LimitOverrides {
  inventoryLimit?: number | null;
  staffLimit?: number | null;
  publicBookingEnabled?: boolean | null;
  manualBookingEnabled?: boolean | null;
  exportEnabled?: boolean | null;
}

export interface Tenant {
  id: string;
  name: string;
  subdomain: string;
  location: string;
  whatsapp: string;
  bookingDepositAmount: number;
  bookingDepositPolicy: BookingDepositPolicy;
  plan: Plan;
  billingStatus: BillingStatus;
  status: StoreStatus;
  onboardingStatus: OnboardingStatus;
  logoUrl?: string;
  limitOverrides?: LimitOverrides;
}

export interface User {
  id: string;
  tenantId: string;
  name: string;
  role: Role;
  /**
   * False when the owner has revoked this staff member's access (better-auth
   * `banned`). Deactivated rather than deleted, so past transactions keep
   * attributing to their name. Undefined means active.
   */
  active?: boolean;
}

export const ROLE_LABEL: Record<Role, string> = {
  owner: "Owner",
  cashier: "Cashier",
  fitting: "Fitting staff",
};

export const PLAN_LABEL: Record<Plan, string> = {
  free: "Free",
  starter: "Starter",
  pro: "Pro",
};

export const BILLING_STATUS_LABEL: Record<BillingStatus, string> = {
  active: "Active",
  pending: "Pending billing",
  past_due: "Past due",
  cancelled: "Cancelled",
};

export const STORE_STATUS_LABEL: Record<StoreStatus, string> = {
  active: "Active",
  suspended: "Suspended",
};

export const ONBOARDING_STATUS_LABEL: Record<OnboardingStatus, string> = {
  incomplete: "Incomplete",
  complete: "Complete",
};

/* Physical status — fetched from POS transactions in a real system.
   Note: "booked" is NOT a status here. A booking is shown as a separate
   badge (see futureBookingFor) because an item can be physically Available
   yet reserved for an upcoming date range. */
export type ItemStatus = "available" | "rented" | "maintenance";

export type WearStyle = "hijab" | "non-hijab";
export type RentCondition = "in-town" | "shipping" | "both";
export type ConditionGrade = "A" | "B" | "C";

export type BookingStatus = "confirmed" | "active" | "returned" | "late" | "cancelled";
export type BookingRequestStatus = "pending" | "approved" | "rejected" | "expired";
export type BookingDepositPolicy = "non_refundable" | "refundable";
export type BookingRequestPaymentStatus = "unpaid" | "paid" | "waived";
export type PaymentMethod = "QRIS" | "GoPay" | "OVO" | "DANA" | "Cash" | "Card";

/** Size Detail — measurements in centimetres (unique per garment). */
export interface SizeDetail {
  bust: number; // Lingkar dada
  waist: number; // Lingkar pinggang
  length: number; // Panjang baju
  sleeve: number; // Panjang lengan
}

export interface KebayaItem {
  id: string;
  tenantId: string;
  // 1. Product Identity
  name: string;
  inventoryCode: string;
  sizeLabel: string; // free-form, e.g. "S-M", "M-L", "All size"
  model: string; // free-form, e.g. "Kebaya Modern", "Dress Premium"
  color: string;
  wearStyle: WearStyle;
  includes: string[]; // set contents, e.g. Kebaya + Rok + Hijab
  occasions: string[]; // free-form categories, e.g. "Wisuda", "Lamaran"
  rentCondition: RentCondition;
  // 2. Size Detail
  size: SizeDetail;
  // 3. Pricing
  rentalPrice: number; // 3-day base
  cost: number; // modal beli/bikin
  // 4. Description
  description: string;
  // 5. Status (from POS)
  status: ItemStatus;
  // 6. Condition
  conditionGrade: ConditionGrade;
  // 7. QR identity
  qrCode: string;
  // 8. Photos (up to 10) — reused later for the customer online catalog
  photos: string[];
  // 9. Inventory chronology
  dateAdded: string;
  // analytics
  timesRented: number;
}

export const MAX_PHOTOS = 10;

export interface Measurement {
  bust: number;
  waist: number;
  hip: number;
  recordedAt: string;
}

export interface Customer {
  id: string;
  tenantId: string;
  name: string;
  whatsapp: string;
  instagram?: string;
  email?: string;
  event?: { type: string; date: string };
  measurements: Measurement[];
  totalRentals: number;
  lastRental: string;
}

export interface Booking {
  id: string;
  tenantId: string;
  customerId: string;
  itemIds: string[];
  startDate: string;
  endDate: string;
  status: BookingStatus;
  total: number;
  deposit: number;
  notes?: string;
}

export interface BookingRequest {
  id: string;
  tenantId: string;
  itemId: string;
  customerName: string;
  whatsapp: string;
  eventType?: string;
  eventDate?: string;
  startDate: string;
  endDate: string;
  depositAmount: number;
  depositPolicy: BookingDepositPolicy;
  paymentStatus: BookingRequestPaymentStatus;
  status: BookingRequestStatus;
  expiresAt: string;
  notes?: string;
  createdAt: string;
}

export type TransactionType = "open" | "close";

export interface Transaction {
  id: string;
  tenantId: string;
  bookingId: string;
  transactionType?: TransactionType;
  date: string;
  deposit: number;
  lateFee: number;
  damageFee: number;
  total: number;
  method: PaymentMethod;
  paymentStatus: "paid" | "partial" | "refunded" | "pending";
  itemIds?: string[];
  customerName?: string;
  customerWhatsapp?: string;
  cashierName?: string;
  rentalTotal?: number;
  baseRental?: number;
  extraDayFee?: number;
  notes?: string;
  returnNotes?: string;
  depositReturned?: number;
  amountDue?: number;
  evidence?: {
    idPhotoName?: string;
    clientPhotoName?: string;
  };
}

/** Everything one tenant owns. One of these per tenant — never merged. */
export interface TenantDataset {
  inventory: KebayaItem[];
  customers: Customer[];
  bookingRequests: BookingRequest[];
  bookings: Booking[];
  transactions: Transaction[];
  monthlyRevenue: { month: string; revenue: number }[];
}

/* ---------- label maps ---------- */

export const STATUS_LABEL: Record<ItemStatus, string> = {
  available: "Available",
  rented: "Rented",
  maintenance: "Cleaning & Repair",
};

export const WEAR_STYLE_LABEL: Record<WearStyle, string> = {
  hijab: "Hijab friendly",
  "non-hijab": "Non-hijab",
};

export const RENT_CONDITION_LABEL: Record<RentCondition, string> = {
  "in-town": "Dalam kota",
  shipping: "Kirim luar kota",
  both: "Dalam kota & kirim",
};

// Options a shop could extend — surfaced as filter/select choices.
export const MODELS = ["Kebaya Modern", "Kebaya Janggan", "Kebaya Kutubaru", "Dress Premium", "Kebaya Kartini"];
export const OCCASIONS = ["Wisuda", "Lamaran", "Kondangan", "Bridesmaid", "Pengajian"];
export const SET_PARTS = ["Kebaya", "Rok", "Hijab", "Bustier", "Manset"];

/* ---------- placeholder photos ---------- */

// Generated from the item's color — stands in for real uploads (Cloudflare R2
// later). Produces a 4:5 tinted tile per photo.
const COLOR_HEX: Record<string, string> = {
  Ivory: "#e6ddcb", Maroon: "#7d1f2f", "Soft Pink": "#e9b8c6", Emerald: "#1f7a5a",
  Sage: "#9caf88", Gold: "#c9a24b", "Dusty Blue": "#8aa0b8", White: "#ececea",
  Navy: "#26324f", Terracotta: "#b4613e", Champagne: "#dcc490", Red: "#b3243a",
  Black: "#33312f", Lavender: "#bda9dc", Fuchsia: "#b0447e", Teal: "#2b7f7a",
};

export function photoUri(color: string, variant: number): string {
  const hex = COLOR_HEX[color] ?? "#b96f82";
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='320' height='400' viewBox='0 0 320 400'>` +
    `<defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>` +
    `<stop offset='0' stop-color='${hex}'/>` +
    `<stop offset='1' stop-color='${hex}' stop-opacity='0.55'/>` +
    `</linearGradient></defs>` +
    `<rect width='320' height='400' fill='url(#g)'/>` +
    `<text x='160' y='235' font-size='130' text-anchor='middle'>&#128088;</text>` +
    `<text x='18' y='378' font-size='15' fill='rgba(255,255,255,0.85)' font-family='sans-serif'>Foto ${variant}</text>` +
    `</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/* ---------- tenants & users ---------- */

export const tenants: Tenant[] = [
  {
    id: "melati",
    name: "Griya Kebaya Melati",
    subdomain: "melati.rentie.id",
    location: "Kemang, Jakarta Selatan",
    whatsapp: "+62 812-0000-1234",
    bookingDepositAmount: 150000,
    bookingDepositPolicy: "non_refundable",
    plan: "pro",
    billingStatus: "active",
    status: "active",
    onboardingStatus: "complete",
  },
  {
    id: "ayu",
    name: "Ayu Rental",
    subdomain: "ayurental.rentie.id",
    location: "Denpasar, Bali",
    whatsapp: "+62 813-0000-8899",
    bookingDepositAmount: 100000,
    bookingDepositPolicy: "refundable",
    plan: "pro",
    billingStatus: "active",
    status: "active",
    onboardingStatus: "complete",
  },
];

export const users: User[] = [
  { id: "U01", tenantId: "melati", name: "Ayu Lestari", role: "owner" },
  { id: "U02", tenantId: "melati", name: "Budi Santoso", role: "cashier" },
  { id: "U03", tenantId: "melati", name: "Citra Dewi", role: "fitting" },
  { id: "U04", tenantId: "melati", name: "Dian Permata", role: "cashier" },
  { id: "U05", tenantId: "ayu", name: "Rani Wijaya", role: "owner" },
  { id: "U06", tenantId: "ayu", name: "Komang Sri", role: "cashier" },
];

/* ---------- seed: Griya Kebaya Melati ---------- */

type ItemSeed = Omit<KebayaItem, "tenantId" | "photos" | "dateAdded">;

const melatiInventory: ItemSeed[] = [
  {
    id: "I001", name: "Anggun Ivory", inventoryCode: "KBY-001", sizeLabel: "S-M",
    model: "Kebaya Modern", color: "Ivory", wearStyle: "hijab",
    includes: ["Kebaya", "Rok", "Hijab", "Bustier"], occasions: ["Wisuda", "Kondangan"],
    rentCondition: "both", size: { bust: 88, waist: 70, length: 95, sleeve: 58 },
    rentalPrice: 350000, cost: 2800000,
    description: "Kebaya modern brokat halus dengan payet tangan, cutting body-fit. Cocok untuk wisuda dan kondangan formal.",
    status: "available", conditionGrade: "A", qrCode: "KBY-0001", timesRented: 42,
  },
  {
    id: "I002", name: "Kartini Klasik Maroon", inventoryCode: "KBY-002", sizeLabel: "M-L",
    model: "Kebaya Kartini", color: "Maroon", wearStyle: "non-hijab",
    includes: ["Kebaya", "Rok"], occasions: ["Kondangan", "Lamaran"],
    rentCondition: "in-town", size: { bust: 94, waist: 78, length: 92, sleeve: 55 },
    rentalPrice: 300000, cost: 2200000,
    description: "Kebaya kartini beludru dengan kain jarik batik tulis. Nuansa klasik untuk acara adat.",
    status: "rented", conditionGrade: "A", qrCode: "KBY-0002", timesRented: 38,
  },
  {
    id: "I003", name: "Encim Peranakan Pink", inventoryCode: "KBY-003", sizeLabel: "S-M",
    model: "Kebaya Modern", color: "Soft Pink", wearStyle: "non-hijab",
    includes: ["Kebaya", "Rok", "Bustier"], occasions: ["Bridesmaid", "Kondangan"],
    rentCondition: "both", size: { bust: 86, waist: 68, length: 90, sleeve: 20 },
    rentalPrice: 400000, cost: 3200000,
    description: "Kebaya encim peranakan bordir bunga, lengan pendek. Elegan untuk bridesmaid.",
    status: "available", conditionGrade: "A", qrCode: "KBY-0003", timesRented: 35,
  },
  {
    id: "I004", name: "Janggan Emerald", inventoryCode: "KBY-004", sizeLabel: "M-L",
    model: "Kebaya Janggan", color: "Emerald", wearStyle: "hijab",
    includes: ["Kebaya", "Rok", "Hijab", "Bustier", "Manset"], occasions: ["Lamaran", "Pengajian"],
    rentCondition: "both", size: { bust: 92, waist: 76, length: 110, sleeve: 60 },
    rentalPrice: 450000, cost: 3600000,
    description: "Kebaya janggan panjang tertutup dengan detail sulam benang emas. One set lengkap dengan manset.",
    status: "available", conditionGrade: "A", qrCode: "KBY-0004", timesRented: 31,
  },
  {
    id: "I005", name: "Kutubaru Sage", inventoryCode: "KBY-005", sizeLabel: "S-L",
    model: "Kebaya Kutubaru", color: "Sage", wearStyle: "non-hijab",
    includes: ["Kebaya", "Rok"], occasions: ["Kondangan", "Wisuda"],
    rentCondition: "in-town", size: { bust: 90, waist: 74, length: 88, sleeve: 56 },
    rentalPrice: 300000, cost: 2000000,
    description: "Kebaya kutubaru katun premium warna sage, adem dan nyaman untuk acara siang.",
    status: "maintenance", conditionGrade: "B", qrCode: "KBY-0005", timesRented: 29,
  },
  {
    id: "I006", name: "Bali Songket Gold", inventoryCode: "KBY-006", sizeLabel: "M-XL",
    model: "Dress Premium", color: "Gold", wearStyle: "non-hijab",
    includes: ["Kebaya", "Rok", "Bustier"], occasions: ["Lamaran", "Kondangan"],
    rentCondition: "both", size: { bust: 98, waist: 82, length: 100, sleeve: 30 },
    rentalPrice: 500000, cost: 4200000,
    description: "Dress premium dengan kain songket Bali asli, aksen prada emas. Statement piece.",
    status: "rented", conditionGrade: "A", qrCode: "KBY-0006", timesRented: 27,
  },
  {
    id: "I007", name: "Modern Dusty Blue", inventoryCode: "KBY-007", sizeLabel: "S-M",
    model: "Kebaya Modern", color: "Dusty Blue", wearStyle: "hijab",
    includes: ["Kebaya", "Rok", "Hijab"], occasions: ["Wisuda"],
    rentCondition: "both", size: { bust: 87, waist: 69, length: 96, sleeve: 58 },
    rentalPrice: 275000, cost: 1900000,
    description: "Kebaya wisuda tile bordir warna dusty blue, favorit mahasiswa.",
    status: "available", conditionGrade: "A", qrCode: "KBY-0007", timesRented: 24,
  },
  {
    id: "I008", name: "Pengantin Putih Royal", inventoryCode: "KBY-008", sizeLabel: "M-L",
    model: "Dress Premium", color: "White", wearStyle: "non-hijab",
    includes: ["Kebaya", "Rok", "Bustier", "Manset"], occasions: ["Lamaran"],
    rentCondition: "in-town", size: { bust: 91, waist: 74, length: 130, sleeve: 60 },
    rentalPrice: 850000, cost: 6500000,
    description: "Gaun pengantin kebaya putih full payet Swarovski dengan ekor. Sewa dalam kota saja karena detail rapuh.",
    status: "available", conditionGrade: "A", qrCode: "KBY-0008", timesRented: 19,
  },
  {
    id: "I009", name: "Janggan Navy Wisuda", inventoryCode: "KBY-009", sizeLabel: "S-M",
    model: "Kebaya Janggan", color: "Navy", wearStyle: "hijab",
    includes: ["Kebaya", "Rok", "Hijab", "Manset"], occasions: ["Wisuda", "Pengajian"],
    rentCondition: "both", size: { bust: 85, waist: 66, length: 108, sleeve: 60 },
    rentalPrice: 350000, cost: 2600000,
    description: "Kebaya janggan navy tertutup syar'i, cocok untuk wisuda hijabers.",
    status: "rented", conditionGrade: "A", qrCode: "KBY-0009", timesRented: 22,
  },
  {
    id: "I010", name: "Kutubaru Merah Bata", inventoryCode: "KBY-010", sizeLabel: "M-L",
    model: "Kebaya Kutubaru", color: "Terracotta", wearStyle: "non-hijab",
    includes: ["Kebaya", "Rok"], occasions: ["Kondangan"],
    rentCondition: "in-town", size: { bust: 93, waist: 77, length: 89, sleeve: 55 },
    rentalPrice: 300000, cost: 2000000,
    description: "Kebaya kutubaru merah bata dengan jarik sogan. Sedang dalam perbaikan kancing.",
    status: "maintenance", conditionGrade: "C", qrCode: "KBY-0010", timesRented: 18,
  },
  {
    id: "I011", name: "Modern Champagne", inventoryCode: "KBY-011", sizeLabel: "S-M",
    model: "Kebaya Modern", color: "Champagne", wearStyle: "hijab",
    includes: ["Kebaya", "Rok", "Hijab", "Bustier"], occasions: ["Lamaran", "Bridesmaid"],
    rentCondition: "both", size: { bust: 88, waist: 71, length: 97, sleeve: 58 },
    rentalPrice: 425000, cost: 3400000,
    description: "Kebaya modern champagne mewah, cocok untuk seragam bridesmaid. Baru selesai laundry.",
    status: "maintenance", conditionGrade: "B", qrCode: "KBY-0011", timesRented: 16,
  },
  {
    id: "I012", name: "Bali Songket Merah", inventoryCode: "KBY-012", sizeLabel: "S-M",
    model: "Dress Premium", color: "Red", wearStyle: "non-hijab",
    includes: ["Kebaya", "Rok", "Bustier"], occasions: ["Lamaran", "Kondangan"],
    rentCondition: "both", size: { bust: 84, waist: 65, length: 100, sleeve: 30 },
    rentalPrice: 500000, cost: 4200000,
    description: "Dress premium songket merah menyala, aura pengantin adat.",
    status: "available", conditionGrade: "B", qrCode: "KBY-0012", timesRented: 15,
  },
  {
    id: "I013", name: "Kartini Hitam Elegan", inventoryCode: "KBY-013", sizeLabel: "M-L",
    model: "Kebaya Kartini", color: "Black", wearStyle: "non-hijab",
    includes: ["Kebaya", "Rok"], occasions: ["Kondangan", "Wisuda"],
    rentCondition: "in-town", size: { bust: 90, waist: 73, length: 91, sleeve: 55 },
    rentalPrice: 275000, cost: 1800000,
    description: "Kebaya kartini hitam beludru, timeless dan mudah dipadupadankan.",
    status: "rented", conditionGrade: "A", qrCode: "KBY-0013", timesRented: 21,
  },
  {
    id: "I014", name: "Janggan Maroon Syari", inventoryCode: "KBY-014", sizeLabel: "M-XL",
    model: "Kebaya Janggan", color: "Maroon", wearStyle: "hijab",
    includes: ["Kebaya", "Rok", "Hijab", "Manset"], occasions: ["Pengajian", "Lamaran"],
    rentCondition: "both", size: { bust: 96, waist: 80, length: 112, sleeve: 62 },
    rentalPrice: 300000, cost: 2400000,
    description: "Kebaya janggan maroon syar'i longgar, nyaman untuk pengajian dan lamaran.",
    status: "rented", conditionGrade: "B", qrCode: "KBY-0014", timesRented: 20,
  },
  {
    id: "I015", name: "Modern Lavender", inventoryCode: "KBY-015", sizeLabel: "S-L",
    model: "Kebaya Modern", color: "Lavender", wearStyle: "hijab",
    includes: ["Kebaya", "Rok", "Hijab", "Bustier", "Manset"], occasions: ["Wisuda", "Bridesmaid"],
    rentCondition: "both", size: { bust: 89, waist: 72, length: 98, sleeve: 58 },
    rentalPrice: 375000, cost: 3000000,
    description: "Kebaya modern lavender pastel dengan payet lembut. One set paling lengkap.",
    status: "available", conditionGrade: "A", qrCode: "KBY-0015", timesRented: 14,
  },
  {
    id: "I016", name: "Pengantin Ivory Deluxe", inventoryCode: "KBY-016", sizeLabel: "M-L",
    model: "Dress Premium", color: "Ivory", wearStyle: "non-hijab",
    includes: ["Kebaya", "Rok", "Bustier", "Manset"], occasions: ["Lamaran"],
    rentCondition: "in-town", size: { bust: 92, waist: 75, length: 128, sleeve: 60 },
    rentalPrice: 850000, cost: 6800000,
    description: "Gaun kebaya pengantin ivory dengan brokat Prancis dan ekor panjang. Premium, sewa dalam kota.",
    status: "available", conditionGrade: "A", qrCode: "KBY-0016", timesRented: 12,
  },
];

const melatiCustomers: Omit<Customer, "tenantId">[] = [
  {
    id: "C01", name: "Dewi Anggraini", whatsapp: "+62 812-3456-7890",
    event: { type: "Wedding", date: "2026-08-15" },
    measurements: [
      { bust: 88, waist: 70, hip: 94, recordedAt: "2026-07-02" },
      { bust: 87, waist: 69, hip: 93, recordedAt: "2025-11-14" },
    ],
    totalRentals: 5, lastRental: "2026-07-10",
  },
  {
    id: "C02", name: "Siti Rahmawati", whatsapp: "+62 813-9876-5432",
    event: { type: "Graduation", date: "2026-07-28" },
    measurements: [{ bust: 92, waist: 76, hip: 98, recordedAt: "2026-06-20" }],
    totalRentals: 2, lastRental: "2026-06-22",
  },
  {
    id: "C03", name: "Maya Kusuma", whatsapp: "+62 811-2233-4455",
    measurements: [
      { bust: 85, waist: 66, hip: 90, recordedAt: "2026-05-11" },
      { bust: 86, waist: 68, hip: 91, recordedAt: "2024-12-03" },
    ],
    totalRentals: 8, lastRental: "2026-07-14",
  },
  {
    id: "C04", name: "Rina Puspitasari", whatsapp: "+62 857-1122-3344",
    event: { type: "Wedding (bridesmaid)", date: "2026-08-01" },
    measurements: [{ bust: 90, waist: 74, hip: 96, recordedAt: "2026-07-08" }],
    totalRentals: 1, lastRental: "2026-07-08",
  },
  {
    id: "C05", name: "Lestari Wulandari", whatsapp: "+62 819-5566-7788",
    measurements: [{ bust: 94, waist: 80, hip: 100, recordedAt: "2026-03-19" }],
    totalRentals: 3, lastRental: "2026-04-02",
  },
  {
    id: "C06", name: "Putri Handayani", whatsapp: "+62 812-9988-7766",
    event: { type: "Graduation", date: "2026-07-25" },
    measurements: [{ bust: 84, waist: 65, hip: 89, recordedAt: "2026-07-12" }],
    totalRentals: 1, lastRental: "2026-07-12",
  },
];

const melatiBookings: Omit<Booking, "tenantId">[] = [
  { id: "B101", customerId: "C01", itemIds: ["I002"], startDate: "2026-07-16", endDate: "2026-07-20", status: "active", total: 300000, deposit: 200000 },
  { id: "B102", customerId: "C03", itemIds: ["I009", "I013"], startDate: "2026-07-15", endDate: "2026-07-19", status: "active", total: 625000, deposit: 300000 },
  { id: "B103", customerId: "C02", itemIds: ["I008"], startDate: "2026-07-24", endDate: "2026-07-29", status: "confirmed", total: 850000, deposit: 400000 },
  { id: "B104", customerId: "C06", itemIds: ["I003"], startDate: "2026-07-23", endDate: "2026-07-26", status: "confirmed", total: 400000, deposit: 200000 },
  { id: "B105", customerId: "C01", itemIds: ["I016"], startDate: "2026-08-13", endDate: "2026-08-17", status: "confirmed", total: 850000, deposit: 400000 },
  { id: "B106", customerId: "C04", itemIds: ["I012"], startDate: "2026-07-30", endDate: "2026-08-02", status: "confirmed", total: 500000, deposit: 250000 },
  { id: "B107", customerId: "C05", itemIds: ["I006"], startDate: "2026-07-14", endDate: "2026-07-19", status: "active", total: 500000, deposit: 250000 },
  { id: "B108", customerId: "C03", itemIds: ["I014"], startDate: "2026-07-13", endDate: "2026-07-20", status: "active", total: 300000, deposit: 150000 },
  { id: "B109", customerId: "C02", itemIds: ["I005"], startDate: "2026-07-04", endDate: "2026-07-08", status: "returned", total: 300000, deposit: 150000 },
  { id: "B110", customerId: "C05", itemIds: ["I011"], startDate: "2026-07-01", endDate: "2026-07-05", status: "returned", total: 425000, deposit: 200000 },
];

const melatiBookingRequests: Omit<BookingRequest, "tenantId">[] = [
  {
    id: "BR201",
    itemId: "I001",
    customerName: "Maya Anindita",
    whatsapp: "+62 812-1122-7788",
    eventType: "Lamaran",
    eventDate: "2026-08-03",
    startDate: "2026-08-02",
    endDate: "2026-08-04",
    depositAmount: 150000,
    depositPolicy: "non_refundable",
    paymentStatus: "paid",
    status: "pending",
    expiresAt: "2026-07-20T19:00:00+07:00",
    notes: "Customer asks for pickup after 17:00.",
    createdAt: "2026-07-19T19:00:00+07:00",
  },
  {
    id: "BR202",
    itemId: "I003",
    customerName: "Riska Amalia",
    whatsapp: "+62 813-3344-2211",
    eventType: "Wisuda",
    eventDate: "2026-07-25",
    startDate: "2026-07-23",
    endDate: "2026-07-26",
    depositAmount: 200000,
    depositPolicy: "refundable",
    paymentStatus: "unpaid",
    status: "pending",
    expiresAt: "2026-07-20T18:25:00+07:00",
    notes: "Requested item has an overlapping confirmed booking.",
    createdAt: "2026-07-19T18:25:00+07:00",
  },
];

const melatiTransactions: Omit<Transaction, "tenantId">[] = [
  { id: "T2101", bookingId: "B101", date: "2026-07-16", deposit: 200000, lateFee: 0, damageFee: 0, total: 500000, method: "QRIS", paymentStatus: "paid" },
  { id: "T2102", bookingId: "B102", date: "2026-07-15", deposit: 300000, lateFee: 0, damageFee: 0, total: 925000, method: "Cash", paymentStatus: "paid" },
  { id: "T2103", bookingId: "B103", date: "2026-07-14", deposit: 400000, lateFee: 0, damageFee: 0, total: 1250000, method: "GoPay", paymentStatus: "partial" },
  { id: "T2104", bookingId: "B104", date: "2026-07-13", deposit: 200000, lateFee: 0, damageFee: 0, total: 600000, method: "QRIS", paymentStatus: "partial" },
  { id: "T2105", bookingId: "B107", date: "2026-07-14", deposit: 250000, lateFee: 50000, damageFee: 0, total: 800000, method: "DANA", paymentStatus: "pending" },
  { id: "T2106", bookingId: "B108", date: "2026-07-13", deposit: 150000, lateFee: 0, damageFee: 0, total: 450000, method: "Card", paymentStatus: "paid" },
  { id: "T2107", bookingId: "B109", date: "2026-07-08", deposit: 150000, lateFee: 0, damageFee: 75000, total: 525000, method: "QRIS", paymentStatus: "refunded" },
  { id: "T2108", bookingId: "B110", date: "2026-07-05", deposit: 200000, lateFee: 0, damageFee: 0, total: 625000, method: "OVO", paymentStatus: "refunded" },
];

/* ---------- seed: Ayu Rental ---------- */

const ayuInventory: ItemSeed[] = [
  {
    id: "A001", name: "Dewata Fuchsia", inventoryCode: "AYU-001", sizeLabel: "S-M",
    model: "Kebaya Bali", color: "Fuchsia", wearStyle: "non-hijab",
    includes: ["Kebaya", "Rok", "Bustier"], occasions: ["Kondangan", "Odalan"],
    rentCondition: "in-town", size: { bust: 86, waist: 68, length: 92, sleeve: 55 },
    rentalPrice: 250000, cost: 1800000,
    description: "Kebaya Bali brokat fuchsia dengan kamen prada. Favorit untuk kondangan dan upacara.",
    status: "available", conditionGrade: "A", qrCode: "AYU-0001", timesRented: 18,
  },
  {
    id: "A002", name: "Legong Teal", inventoryCode: "AYU-002", sizeLabel: "M-L",
    model: "Kebaya Bali", color: "Teal", wearStyle: "non-hijab",
    includes: ["Kebaya", "Rok"], occasions: ["Kondangan"],
    rentCondition: "in-town", size: { bust: 92, waist: 76, length: 90, sleeve: 54 },
    rentalPrice: 225000, cost: 1500000,
    description: "Kebaya Bali warna teal dengan obi senada, ringan dan adem.",
    status: "rented", conditionGrade: "A", qrCode: "AYU-0002", timesRented: 15,
  },
  {
    id: "A003", name: "Sanur Ivory", inventoryCode: "AYU-003", sizeLabel: "All size",
    model: "Kebaya Modern", color: "Ivory", wearStyle: "hijab",
    includes: ["Kebaya", "Rok", "Hijab"], occasions: ["Wisuda", "Lamaran"],
    rentCondition: "both", size: { bust: 90, waist: 74, length: 100, sleeve: 58 },
    rentalPrice: 300000, cost: 2400000,
    description: "Kebaya modern ivory potongan longgar, cocok untuk banyak ukuran badan.",
    status: "available", conditionGrade: "A", qrCode: "AYU-0003", timesRented: 12,
  },
  {
    id: "A004", name: "Ubud Emerald", inventoryCode: "AYU-004", sizeLabel: "M-L",
    model: "Kebaya Kutubaru", color: "Emerald", wearStyle: "non-hijab",
    includes: ["Kebaya", "Rok"], occasions: ["Kondangan", "Pengajian"],
    rentCondition: "in-town", size: { bust: 93, waist: 78, length: 89, sleeve: 55 },
    rentalPrice: 200000, cost: 1400000,
    description: "Kutubaru hijau emerald dengan kain lilit. Sedang dicuci setelah sewa panjang.",
    status: "maintenance", conditionGrade: "B", qrCode: "AYU-0004", timesRented: 11,
  },
  {
    id: "A005", name: "Kuta Gold Premium", inventoryCode: "AYU-005", sizeLabel: "S-M",
    model: "Dress Premium", color: "Gold", wearStyle: "non-hijab",
    includes: ["Kebaya", "Rok", "Bustier", "Manset"], occasions: ["Lamaran", "Prewedding"],
    rentCondition: "both", size: { bust: 87, waist: 69, length: 105, sleeve: 40 },
    rentalPrice: 450000, cost: 3800000,
    description: "Dress premium gold dengan payet penuh, sering dipakai untuk prewedding shoot.",
    status: "rented", conditionGrade: "A", qrCode: "AYU-0005", timesRented: 9,
  },
  {
    id: "A006", name: "Jimbaran Lavender", inventoryCode: "AYU-006", sizeLabel: "S-L",
    model: "Kebaya Modern", color: "Lavender", wearStyle: "hijab",
    includes: ["Kebaya", "Rok", "Hijab", "Manset"], occasions: ["Wisuda", "Bridesmaid"],
    rentCondition: "both", size: { bust: 89, waist: 72, length: 98, sleeve: 58 },
    rentalPrice: 275000, cost: 2100000,
    description: "Kebaya lavender lembut satu set lengkap, pilihan aman untuk seragam bridesmaid.",
    status: "available", conditionGrade: "A", qrCode: "AYU-0006", timesRented: 7,
  },
];

const ayuCustomers: Omit<Customer, "tenantId">[] = [
  {
    id: "AC01", name: "Nadia Safitri", whatsapp: "+62 815-2211-3344",
    event: { type: "Graduation", date: "2026-07-30" },
    measurements: [{ bust: 87, waist: 69, hip: 92, recordedAt: "2026-07-10" }],
    totalRentals: 3, lastRental: "2026-07-17",
  },
  {
    id: "AC02", name: "Kadek Ayu Pertiwi", whatsapp: "+62 818-7788-9900",
    measurements: [
      { bust: 90, waist: 73, hip: 95, recordedAt: "2026-06-02" },
      { bust: 89, waist: 72, hip: 94, recordedAt: "2025-09-21" },
    ],
    totalRentals: 6, lastRental: "2026-07-15",
  },
  {
    id: "AC03", name: "Intan Maharani", whatsapp: "+62 819-3344-5566",
    event: { type: "Engagement", date: "2026-08-08" },
    measurements: [{ bust: 85, waist: 67, hip: 91, recordedAt: "2026-07-05" }],
    totalRentals: 1, lastRental: "2026-07-05",
  },
];

const ayuBookings: Omit<Booking, "tenantId">[] = [
  { id: "AB101", customerId: "AC01", itemIds: ["A002"], startDate: "2026-07-17", endDate: "2026-07-21", status: "active", total: 225000, deposit: 100000 },
  { id: "AB102", customerId: "AC02", itemIds: ["A005"], startDate: "2026-07-15", endDate: "2026-07-19", status: "active", total: 450000, deposit: 200000 },
  { id: "AB103", customerId: "AC03", itemIds: ["A001"], startDate: "2026-07-25", endDate: "2026-07-28", status: "confirmed", total: 250000, deposit: 100000 },
  { id: "AB104", customerId: "AC01", itemIds: ["A003"], startDate: "2026-07-05", endDate: "2026-07-08", status: "returned", total: 300000, deposit: 150000 },
];

const ayuBookingRequests: Omit<BookingRequest, "tenantId">[] = [
  {
    id: "ABR201",
    itemId: "A006",
    customerName: "Made Clara",
    whatsapp: "+62 812-8800-1122",
    eventType: "Bridesmaid",
    eventDate: "2026-08-10",
    startDate: "2026-08-09",
    endDate: "2026-08-11",
    depositAmount: 100000,
    depositPolicy: "non_refundable",
    paymentStatus: "paid",
    status: "pending",
    expiresAt: "2026-07-20T16:30:00+07:00",
    notes: "Needs hijab-friendly set.",
    createdAt: "2026-07-19T16:30:00+07:00",
  },
];

const ayuTransactions: Omit<Transaction, "tenantId">[] = [
  { id: "AT101", bookingId: "AB101", date: "2026-07-17", deposit: 100000, lateFee: 0, damageFee: 0, total: 325000, method: "QRIS", paymentStatus: "paid" },
  { id: "AT102", bookingId: "AB102", date: "2026-07-15", deposit: 200000, lateFee: 0, damageFee: 0, total: 650000, method: "Cash", paymentStatus: "paid" },
  { id: "AT103", bookingId: "AB103", date: "2026-07-12", deposit: 100000, lateFee: 0, damageFee: 0, total: 350000, method: "DANA", paymentStatus: "partial" },
  { id: "AT104", bookingId: "AB104", date: "2026-07-08", deposit: 150000, lateFee: 0, damageFee: 25000, total: 475000, method: "QRIS", paymentStatus: "refunded" },
];

/* ---------- assembled per-tenant datasets ---------- */

function withTenant<T>(tenantId: string, rows: T[]): (T & { tenantId: string })[] {
  return rows.map((r) => ({ ...r, tenantId }));
}

function withPhotos(items: (ItemSeed & { tenantId: string })[]): KebayaItem[] {
  return items.map((it, idx) => ({
    ...it,
    dateAdded: `2026-06-${String(Math.max(1, 30 - idx)).padStart(2, "0")}`,
    photos: Array.from({ length: 2 + (idx % 3) }, (_, i) => photoUri(it.color, i + 1)),
  }));
}

export const seedData: Record<string, TenantDataset> = {
	  melati: {
	    inventory: withPhotos(withTenant("melati", melatiInventory)),
	    customers: withTenant("melati", melatiCustomers),
	    bookingRequests: withTenant("melati", melatiBookingRequests),
	    bookings: withTenant("melati", melatiBookings),
	    transactions: withTenant("melati", melatiTransactions),
    monthlyRevenue: [
      { month: "Feb", revenue: 9800000 },
      { month: "Mar", revenue: 11400000 },
      { month: "Apr", revenue: 10250000 },
      { month: "May", revenue: 13900000 },
      { month: "Jun", revenue: 16750000 },
      { month: "Jul", revenue: 12450000 },
    ],
  },
	  ayu: {
	    inventory: withPhotos(withTenant("ayu", ayuInventory)),
	    customers: withTenant("ayu", ayuCustomers),
	    bookingRequests: withTenant("ayu", ayuBookingRequests),
	    bookings: withTenant("ayu", ayuBookings),
    transactions: withTenant("ayu", ayuTransactions),
    monthlyRevenue: [
      { month: "Feb", revenue: 2400000 },
      { month: "Mar", revenue: 3100000 },
      { month: "Apr", revenue: 2850000 },
      { month: "May", revenue: 3600000 },
      { month: "Jun", revenue: 4700000 },
      { month: "Jul", revenue: 3950000 },
    ],
  },
};

/* ---------- formatters & pure helpers ---------- */

export function formatIDR(n: number): string {
  return "Rp " + n.toLocaleString("id-ID");
}

export function formatDate(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}

/** Date-range overlap — the core double-booking check. */
export function rangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart <= bEnd && bStart <= aEnd;
}

/** Bookings (already tenant-scoped) that hold an item for an overlapping range. */
export function conflictsIn(bookings: Booking[], itemId: string, start: string, end: string): Booking[] {
  return bookings.filter(
    (b) =>
      b.status !== "cancelled" &&
      b.status !== "returned" &&
      b.itemIds.includes(itemId) &&
      rangesOverlap(b.startDate, b.endDate, start, end),
  );
}

/** The soonest upcoming reservation (starts after today) for an item — powers
    the "Booked" badge, which is independent of the physical status. */
export function futureBookingIn(bookings: Booking[], itemId: string, today = TODAY): Booking | undefined {
  return bookings
    .filter(
      (b) =>
        b.status !== "cancelled" &&
        b.status !== "returned" &&
        b.itemIds.includes(itemId) &&
        b.startDate > today,
    )
    .sort((a, b) => a.startDate.localeCompare(b.startDate))[0];
}
