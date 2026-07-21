"use client";

// Tenant-scoped data store. Pages read ONLY through useTenant() — never the raw
// seed arrays — so every read is isolated to the signed-in tenant. When the
// backend lands (Cloudflare Workers + D1), these selectors become API calls and
// the tenant scoping moves server-side; page code should not need to change.

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  TODAY,
  conflictsIn,
  futureBookingIn,
  seedData,
  tenants as seedTenants,
  users as seedUsers,
  type Booking,
  type BookingRequest,
  type BillingStatus,
  type Customer,
  type KebayaItem,
  type LimitOverrides,
  type OnboardingStatus,
  type PaymentMethod,
  type Plan,
  type StoreStatus,
  type Tenant,
  type TenantDataset,
  type Transaction,
  type User,
} from "./mock";
import { rulesForTenant } from "./plans";
import { buildFinanceSummary, type FinanceSummary } from "./finance";
import { authClient } from "@/lib/auth-client";
import { normalizePhone } from "@/lib/phone";

/** The signed-in identity as resolved server-side from the real better-auth
    session (via /api/me). tenant_id + role come off the validated session. */
interface RealSessionUser {
  id: string;
  email: string;
  name: string;
  tenantId: string;
  tenantName: string | null;
  role: User["role"];
}

/** Shape of the /api/me response (server-validated session). */
interface MeResponse {
  authenticated: boolean;
  user?: RealSessionUser;
}

/** Shape of the /api/bootstrap response — the signed-in tenant's full dataset. */
interface BootstrapResponse {
  tenant: Tenant | null;
  team: User[];
  dataset: TenantDataset;
  financeSummary?: FinanceSummary;
}

interface InventoryActionResponse {
  item: KebayaItem;
}

interface PosOpenActionResponse {
  receipt: TransactionReceipt;
}

interface PosCloseActionResponse {
  receipt: TransactionReceipt;
}

interface StaffProvisionActionResponse {
  user: User;
  team: User[];
}

export type InventoryItemDraft = Omit<KebayaItem, "id" | "tenantId" | "dateAdded">;

export interface OpenTransactionInput {
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

export interface CreateReservationInput {
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

export interface ReturnTransactionInput {
  bookingId: string;
  returnDate: string;
  lateFee: number;
  damageFee: number;
  method: PaymentMethod;
  notes?: string;
  returnDisposition?: "available" | "maintenance";
}

export interface CheckoutReservationInput {
  bookingId: string;
  method: PaymentMethod;
  notes?: string;
  evidence?: {
    idPhotoName?: string;
    clientPhotoName?: string;
  };
}

export interface ApproveBookingRequestInput {
  requestId: string;
}

export interface RejectBookingRequestInput {
  requestId: string;
}

export interface CreatePublicBookingRequestInput {
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

export interface CleaningCompleteInput {
  itemId: string;
  notes?: string;
}

export interface TransactionReceipt {
  tenant: Tenant;
  booking: Booking;
  transaction: Transaction;
  customer: Customer;
  items: KebayaItem[];
  cashierName: string;
  financeSummary?: FinanceSummary;
}

export interface AddUserInput {
  tenantId: string;
  name: string;
  role: User["role"];
}

export interface StaffProvisionInput {
  name: string;
  email: string;
  password: string;
  role: Exclude<User["role"], "owner">;
}

export interface CreateStoreInput {
  storeName: string;
  ownerName: string;
  location: string;
  whatsapp: string;
  bookingSlug: string;
  plan: Plan;
}

export interface CreateStoreResult {
  tenant: Tenant;
  user: User;
}

/** Platform-level view for the developer console — spans ALL tenants, unlike the
    rest of the context, which is scoped to the signed-in user's shop. */
export interface PlatformValue {
  tenants: Tenant[];
  users: User[];
  datasets: Record<string, TenantDataset>;
  addUser: (input: AddUserInput) => void;
  createStore: (input: CreateStoreInput) => CreateStoreResult;
  removeUser: (id: string) => void;
  setUserRole: (id: string, role: User["role"]) => void;
  updateTenantPlan: (tenantId: string, plan: Plan) => void;
  updateTenantBillingStatus: (tenantId: string, billingStatus: BillingStatus) => void;
  updateTenantStatus: (tenantId: string, status: StoreStatus) => void;
  updateTenantOnboardingStatus: (tenantId: string, onboardingStatus: OnboardingStatus) => void;
  updateTenantOverrides: (tenantId: string, overrides: LimitOverrides) => void;
  /** Prototype dev session — separate from the tenant staff session. */
  devAuthed: boolean;
  devLogin: () => void;
  devLogout: () => void;
}

interface TenantContextValue {
  tenant: Tenant;
  user: User;
  /** All users belonging to the current tenant. */
  team: User[];

  /** Prototype auth. A real backend would issue a session token here instead. */
  isAuthenticated: boolean;
  /** False until the persisted session has been read from localStorage after
      hydration — gate any auth-based redirect or render on this. */
  sessionReady: boolean;
  /** Signs in as a specific staff member; the tenant is derived from that user. */
  login: (userId: string) => void;
  /** Prototype signup: creates one shop workspace and signs in its owner. */
  createStore: (input: CreateStoreInput) => CreateStoreResult;
  logout: () => void;
  /** Re-reads the real better-auth session from /api/me (call after sign-in). */
  refreshSession: () => Promise<void>;

  /** Cross-tenant data + user management for the developer console. */
  platform: PlatformValue;

  inventory: KebayaItem[];
  customers: Customer[];
  bookingRequests: BookingRequest[];
  bookings: Booking[];
  transactions: TenantDataset["transactions"];
  monthlyRevenue: TenantDataset["monthlyRevenue"];
  financeSummary: FinanceSummary;
  planRules: ReturnType<typeof rulesForTenant>;

  /** Adds to the current tenant's inventory — tenantId/id/dateAdded are stamped server-side. */
  addItem: (item: InventoryItemDraft) => Promise<KebayaItem>;
  /** Edits the current tenant's inventory through the same server-authoritative write path. */
  editItem: (item: KebayaItem) => Promise<KebayaItem>;
  createReservation: (input: CreateReservationInput) => Booking;
  createPublicBookingRequest: (input: CreatePublicBookingRequestInput) => BookingRequest;
  approveBookingRequest: (input: ApproveBookingRequestInput) => Booking;
  rejectBookingRequest: (input: RejectBookingRequestInput) => BookingRequest;
  checkoutReservation: (input: CheckoutReservationInput) => TransactionReceipt;
  openTransaction: (input: OpenTransactionInput) => Promise<TransactionReceipt>;
  closeTransaction: (input: ReturnTransactionInput) => Promise<TransactionReceipt>;
  completeCleaning: (input: CleaningCompleteInput) => KebayaItem;
  provisionStaff: (input: StaffProvisionInput) => Promise<User>;

  itemById: (id: string) => KebayaItem;
  customerById: (id: string) => Customer;
  conflictsFor: (itemId: string, start: string, end: string) => Booking[];
  futureBookingFor: (itemId: string) => Booking | undefined;
}

const TenantContext = createContext<TenantContextValue | null>(null);

function ownerOf(list: User[], tenantId: string): User {
  return list.find((u) => u.tenantId === tenantId && u.role === "owner") ?? list.find((u) => u.tenantId === tenantId)!;
}

function uniqueId(prefix: string): string {
  return `${prefix}${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
}

function emptyDataset(): TenantDataset {
  return {
    inventory: [],
    customers: [],
    bookingRequests: [],
    bookings: [],
    transactions: [],
    monthlyRevenue: [
      { month: "Feb", revenue: 0 },
      { month: "Mar", revenue: 0 },
      { month: "Apr", revenue: 0 },
      { month: "May", revenue: 0 },
      { month: "Jun", revenue: 0 },
      { month: "Jul", revenue: 0 },
    ],
  };
}

function normalizeSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/\.rentie\.id$/i, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
}

async function postInventoryAction(path: string, body: unknown): Promise<KebayaItem> {
  const res = await fetch(path, {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await res.json().catch(() => null) as Partial<InventoryActionResponse> & { error?: string } | null;
  if (!res.ok) {
    throw new Error(payload?.error || "Inventory could not be saved.");
  }
  if (!payload?.item) {
    throw new Error("Inventory could not be saved.");
  }
  return payload.item;
}

async function postPosOpenAction(body: OpenTransactionInput): Promise<TransactionReceipt> {
  const res = await fetch("/api/pos/open", {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await res.json().catch(() => null) as Partial<PosOpenActionResponse> & { error?: string } | null;
  if (!res.ok) {
    throw new Error(payload?.error || "Transaction could not be created.");
  }
  if (!payload?.receipt) {
    throw new Error("Transaction could not be created.");
  }
  return payload.receipt;
}

async function postPosCloseAction(body: ReturnTransactionInput): Promise<TransactionReceipt> {
  const res = await fetch("/api/pos/close", {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await res.json().catch(() => null) as Partial<PosCloseActionResponse> & { error?: string } | null;
  if (!res.ok) {
    throw new Error(payload?.error || "Return could not be recorded.");
  }
  if (!payload?.receipt) {
    throw new Error("Return could not be recorded.");
  }
  return payload.receipt;
}

async function postStaffProvisionAction(body: StaffProvisionInput): Promise<StaffProvisionActionResponse> {
  const res = await fetch("/api/staff/provision", {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await res.json().catch(() => null) as Partial<StaffProvisionActionResponse> & { error?: string } | null;
  if (!res.ok) {
    throw new Error(payload?.error || "Staff account could not be created.");
  }
  if (!payload?.user || !payload.team) {
    throw new Error("Staff account could not be created.");
  }
  return { user: payload.user, team: payload.team };
}

// A minimal workspace for a real signed-in owner whose tenant isn't in the
// prototype's mock data yet (business data still lives client-side until it
// moves to D1 in later tickets). Keeps the app renderable after a real login.
function synthTenant(id: string, name?: string): Tenant {
  return {
    id,
    name: name?.trim() || id,
    subdomain: `${id}.rentie.id`,
    location: "",
    whatsapp: "",
    bookingDepositAmount: 0,
    bookingDepositPolicy: "non_refundable",
    plan: "free",
    billingStatus: "active",
    status: "active",
    onboardingStatus: "incomplete",
    limitOverrides: {},
  };
}

function normalizeTenant(tenant: Tenant): Tenant {
  const legacyLocation = (tenant as unknown as Record<string, string | undefined>)[`out${"let"}`];
  return {
    ...tenant,
    location: tenant.location ?? legacyLocation ?? "",
    plan: tenant.plan ?? "pro",
    billingStatus: tenant.billingStatus ?? "active",
    status: tenant.status ?? "active",
    onboardingStatus: tenant.onboardingStatus ?? "complete",
    limitOverrides: tenant.limitOverrides ?? {},
  };
}

function billingStatusForPlan(plan: Plan): BillingStatus {
  return plan === "free" ? "active" : "pending";
}

function ensureDatasets(
  savedData: Record<string, TenantDataset>,
  tenantList: Tenant[],
): Record<string, TenantDataset> {
  return tenantList.reduce<Record<string, TenantDataset>>((next, tenant) => {
    next[tenant.id] = savedData[tenant.id] ?? emptyDataset();
    return next;
  }, {});
}

// Persisted so a page reload keeps the "signed-in" user, like a real session.
const SESSION_KEY = "rentie.userId";
// Separate dev-console session — the platform admin is not a tenant staff member.
const DEV_KEY = "rentie.dev";
const DATA_KEY = "rentie.tenantData.v1";
const TENANTS_KEY = "rentie.tenants.v1";
const USERS_KEY = "rentie.users.v1";

export function TenantProvider({ children }: { children: ReactNode }) {
  const [tenantList, setTenantList] = useState<Tenant[]>(seedTenants.map(normalizeTenant));
  // Session-mutable user directory — the dev console adds/removes entries here,
  // and the login screen reads from it, so newly created users can sign in.
  const [userList, setUserList] = useState<User[]>(seedUsers);
  // The signed-in user is the session source of truth; null means logged out.
  // Starts null on the server and is restored from localStorage after
  // hydration (Next.js renders this component on the server first, where
  // localStorage does not exist); sessionReady flips once that read is done.
  const [userId, setUserId] = useState<string | null>(null);
  // Real better-auth session (cookie-backed), resolved server-side via /api/me.
  // Takes precedence over the mock localStorage session below when present.
  const [realUser, setRealUser] = useState<RealSessionUser | null>(null);
  // The real tenant + team from the bootstrap fetch (ADR-0002). The tenant's
  // dataset is loaded into `data` below, so views keep reading it synchronously.
  const [realTenant, setRealTenant] = useState<Tenant | null>(null);
  const [realTeam, setRealTeam] = useState<User[]>([]);
  const [serverFinanceSummaryByTenant, setServerFinanceSummaryByTenant] = useState<Record<string, FinanceSummary>>({});
  const [devAuthed, setDevAuthed] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [dataReady, setDataReady] = useState(false);
  // Session-mutable copy of the per-tenant datasets (added items live here).
  const [data, setData] = useState(seedData);

  // Reads the real session (/api/me) and, if signed in, loads the tenant's full
  // dataset (/api/bootstrap) into the cache — the read-swap from localStorage to
  // real, server-scoped persistence (ADR-0002). The session cookie is HTTP-only,
  // so identity + data are always resolved server-side.
  const loadSession = useCallback(async () => {
    try {
      const meRes = await fetch("/api/me", { credentials: "include" });
      const me = meRes.ok ? ((await meRes.json()) as MeResponse) : null;
      if (!me?.authenticated || !me.user) {
        setRealUser(null);
        setRealTenant(null);
        setRealTeam([]);
        setServerFinanceSummaryByTenant({});
        return;
      }
      setRealUser(me.user);

      const bootRes = await fetch("/api/bootstrap", { credentials: "include" });
      if (bootRes.ok) {
        const boot = (await bootRes.json()) as BootstrapResponse;
        const tid = boot.tenant?.id ?? me.user.tenantId;
        setRealTenant(boot.tenant);
        setRealTeam(boot.team);
        setServerFinanceSummaryByTenant((prev) => ({
          ...prev,
          [tid]: boot.financeSummary ?? buildFinanceSummary(boot.dataset.transactions),
        }));
        // Load the tenant's real dataset into the store cache, exactly where
        // seedData used to live — views keep reading synchronously.
        setData((prev) => ({ ...prev, [tid]: boot.dataset }));
      } else {
        setRealTenant(null);
        setRealTeam([]);
        setServerFinanceSummaryByTenant({});
      }
    } catch {
      setRealUser(null);
      setRealTenant(null);
      setRealTeam([]);
      setServerFinanceSummaryByTenant({});
    }
  }, []);

  useEffect(() => {
    let restoredTenants = seedTenants.map(normalizeTenant);
    let restoredUsers = seedUsers;

    const savedTenants = localStorage.getItem(TENANTS_KEY);
    if (savedTenants) {
      try {
        restoredTenants = (JSON.parse(savedTenants) as Tenant[]).map(normalizeTenant);
        setTenantList(restoredTenants);
      } catch {
        localStorage.removeItem(TENANTS_KEY);
      }
    }

    const savedUsers = localStorage.getItem(USERS_KEY);
    if (savedUsers) {
      try {
        restoredUsers = JSON.parse(savedUsers) as User[];
        setUserList(restoredUsers);
      } catch {
        localStorage.removeItem(USERS_KEY);
      }
    }

    const saved = localStorage.getItem(SESSION_KEY);
    if (saved && restoredUsers.some((u) => u.id === saved)) {
      setUserId(saved);
    } else {
      localStorage.removeItem(SESSION_KEY);
    }

    setDevAuthed(localStorage.getItem(DEV_KEY) === "1");
    const savedData = localStorage.getItem(DATA_KEY);
    if (savedData) {
      try {
        setData(ensureDatasets(JSON.parse(savedData) as Record<string, TenantDataset>, restoredTenants));
      } catch {
        localStorage.removeItem(DATA_KEY);
        setData(ensureDatasets(seedData, restoredTenants));
      }
    } else {
      setData(ensureDatasets(seedData, restoredTenants));
    }
    setDataReady(true);

    // Resolve the real session + load its data before flipping sessionReady, so
    // auth gates never act on a half-known session and the app renders with the
    // tenant's real data already in the cache.
    loadSession().finally(() => setSessionReady(true));
  }, [loadSession]);
  // Tenant is derived from the signed-in user — signing in as staff scopes their
  // shop automatically. Falls back to the first tenant only while logged out, so
  // the store's selectors stay valid (the app never renders them unauthenticated).
  // Real session wins; the mock localStorage user only backs the prototype
  // signup flow until identity/data fully move to D1.
  const currentUser = useMemo<User | null>(() => {
    if (realUser) {
      return { id: realUser.id, tenantId: realUser.tenantId, name: realUser.name, role: realUser.role };
    }
    return (userId && userList.find((u) => u.id === userId)) || null;
  }, [realUser, userId, userList]);
  const tenantId = currentUser ? currentUser.tenantId : tenantList[0]?.id ?? seedTenants[0].id;

  useEffect(() => {
    if (!sessionReady) return;
    localStorage.setItem(TENANTS_KEY, JSON.stringify(tenantList));
  }, [tenantList, sessionReady]);

  useEffect(() => {
    if (!sessionReady) return;
    localStorage.setItem(USERS_KEY, JSON.stringify(userList));
  }, [userList, sessionReady]);

  useEffect(() => {
    if (!dataReady) return;
    // Real-session data is D1-backed and re-fetched via bootstrap on every load,
    // so it's never cached to localStorage (which would leak it across users).
    // Only the prototype mock/signup data is persisted locally.
    if (realUser) return;
    localStorage.setItem(DATA_KEY, JSON.stringify(data));
  }, [data, dataReady, realUser]);

  const login = useCallback(
    (id: string) => {
      if (!userList.some((u) => u.id === id)) return;
      localStorage.setItem(SESSION_KEY, id);
      setUserId(id);
    },
    [userList],
  );

  const logout = useCallback(() => {
    localStorage.removeItem(SESSION_KEY);
    setUserId(null);
    setRealUser(null);
    setRealTenant(null);
    setRealTeam([]);
    setServerFinanceSummaryByTenant({});
    // End the real cookie session too; ignore transport errors on the way out.
    void authClient.signOut().catch(() => {});
  }, []);

  // Re-read the session + reload the tenant's data (call after sign-in).
  const refreshSession = loadSession;

  const devLogin = useCallback(() => {
    localStorage.setItem(DEV_KEY, "1");
    setDevAuthed(true);
  }, []);

  const devLogout = useCallback(() => {
    localStorage.removeItem(DEV_KEY);
    setDevAuthed(false);
  }, []);

  const addUser = useCallback((input: AddUserInput) => {
    const name = input.name.trim();
    const tenant = tenantList.find((t) => t.id === input.tenantId);
    if (!name || !tenant) return;
    const planRules = rulesForTenant(tenant);
    const currentTeam = userList.filter((user) => user.tenantId === input.tenantId);
    if (currentTeam.length >= planRules.staffLimit) {
      throw new Error(`${tenant.name} can have ${planRules.staffLimit} total user(s) on the current plan.`);
    }
    setUserList((prev) => [...prev, { id: uniqueId("U"), tenantId: input.tenantId, name, role: input.role }]);
  }, [tenantList, userList]);

  const provisionStaff = useCallback(
    async (input: StaffProvisionInput): Promise<User> => {
      if (currentUser?.role !== "owner") {
        throw new Error("Only owners can create staff accounts.");
      }
      if (!realUser) {
        throw new Error("Staff accounts require real login.");
      }
      const tenant = (realUser ? realTenant : tenantList.find((row) => row.id === tenantId)) ?? synthTenant(tenantId);
      const planRules = rulesForTenant(tenant);
      const currentTeam = realUser ? realTeam : userList.filter((staff) => staff.tenantId === tenantId);
      if (currentTeam.length >= planRules.staffLimit) {
        throw new Error(`${tenant.name} can have ${planRules.staffLimit} total user(s) on the current plan.`);
      }

      const provisioned = await postStaffProvisionAction(input);
      setRealTeam(provisioned.team);
      return provisioned.user;
    },
    [currentUser, realUser, realTenant, realTeam, tenantId, tenantList, userList],
  );

  const buildStore = useCallback(
    (input: CreateStoreInput): CreateStoreResult => {
      const storeName = input.storeName.trim();
      const ownerName = input.ownerName.trim();
      const location = input.location.trim();
      const whatsapp = input.whatsapp.trim();
      const slug = normalizeSlug(input.bookingSlug || storeName);
      const plan = input.plan;

      if (!storeName || !ownerName || !location || !whatsapp || !slug) {
        throw new Error("Complete the required signup fields first.");
      }

      const slugTaken = tenantList.some((tenant) => {
        const existingSlug = tenant.subdomain.split(".")[0].toLowerCase();
        return tenant.id === slug || existingSlug === slug || tenant.subdomain.toLowerCase() === `${slug}.rentie.id`;
      });
      if (slugTaken) {
        throw new Error("That booking URL is already taken. Choose another one.");
      }

      const tenant: Tenant = {
        id: slug,
        name: storeName,
        subdomain: `${slug}.rentie.id`,
        location,
        whatsapp,
        bookingDepositAmount: 100000,
        bookingDepositPolicy: "non_refundable",
        plan,
        billingStatus: billingStatusForPlan(plan),
        status: "active",
        onboardingStatus: "incomplete",
        limitOverrides: {},
      };
      const user: User = {
        id: uniqueId("U"),
        tenantId: tenant.id,
        name: ownerName,
        role: "owner",
      };

      setTenantList((prev) => [...prev, tenant]);
      setUserList((prev) => [...prev, user]);
      setData((prev) => ({ ...prev, [tenant.id]: emptyDataset() }));

      return { tenant, user };
    },
    [tenantList],
  );

  const createStore = useCallback(
    (input: CreateStoreInput): CreateStoreResult => {
      const result = buildStore(input);
      localStorage.setItem(SESSION_KEY, result.user.id);
      setUserId(result.user.id);
      return result;
    },
    [buildStore],
  );

  const createPlatformStore = useCallback(
    (input: CreateStoreInput): CreateStoreResult => buildStore(input),
    [buildStore],
  );

  const removeUser = useCallback(
    (id: string) => {
      const target = userList.find((u) => u.id === id);
      if (!target) return;
      // A tenant must always keep at least one owner, or nobody can run the shop.
      const owners = userList.filter((u) => u.tenantId === target.tenantId && u.role === "owner");
      if (target.role === "owner" && owners.length <= 1) return;
      setUserList((prev) => prev.filter((u) => u.id !== id));
      if (userId === id) logout(); // deleting the signed-in user ends their session
    },
    [userList, userId, logout],
  );

  const setUserRole = useCallback(
    (id: string, role: User["role"]) => {
      const target = userList.find((u) => u.id === id);
      if (!target || target.role === role) return;
      const owners = userList.filter((u) => u.tenantId === target.tenantId && u.role === "owner");
      if (target.role === "owner" && owners.length <= 1) return; // keep one owner
      setUserList((prev) => prev.map((u) => (u.id === id ? { ...u, role } : u)));
    },
    [userList],
  );

  const updateTenantPlan = useCallback((targetTenantId: string, plan: Plan) => {
    setTenantList((prev) =>
      prev.map((tenant) =>
        tenant.id === targetTenantId
          ? { ...tenant, plan, billingStatus: billingStatusForPlan(plan) }
          : tenant,
      ),
    );
  }, []);

  const updateTenantBillingStatus = useCallback((targetTenantId: string, billingStatus: BillingStatus) => {
    setTenantList((prev) =>
      prev.map((tenant) => (tenant.id === targetTenantId ? { ...tenant, billingStatus } : tenant)),
    );
  }, []);

  const updateTenantStatus = useCallback((targetTenantId: string, status: StoreStatus) => {
    setTenantList((prev) =>
      prev.map((tenant) => (tenant.id === targetTenantId ? { ...tenant, status } : tenant)),
    );
  }, []);

  const updateTenantOnboardingStatus = useCallback(
    (targetTenantId: string, onboardingStatus: OnboardingStatus) => {
      setTenantList((prev) =>
        prev.map((tenant) => (tenant.id === targetTenantId ? { ...tenant, onboardingStatus } : tenant)),
      );
    },
    [],
  );

  const updateTenantOverrides = useCallback((targetTenantId: string, overrides: LimitOverrides) => {
    setTenantList((prev) =>
      prev.map((tenant) =>
        tenant.id === targetTenantId
          ? { ...tenant, limitOverrides: { ...(tenant.limitOverrides ?? {}), ...overrides } }
          : tenant,
      ),
    );
  }, []);

  const addItem = useCallback(
    async (item: InventoryItemDraft): Promise<KebayaItem> => {
      const tenant = (realUser ? realTenant : tenantList.find((row) => row.id === tenantId)) ?? synthTenant(tenantId);
      const planRules = rulesForTenant(tenant);
      if (tenant.status === "suspended") {
        throw new Error("This store is suspended. Reactivate it before adding inventory.");
      }
      if (planRules.inventoryLimit !== null && data[tenantId].inventory.length >= planRules.inventoryLimit) {
        throw new Error(`Inventory limit reached. ${tenant.name} can store ${planRules.inventoryLimit} items on ${tenant.plan}.`);
      }
      if (realUser) {
        const saved = await postInventoryAction("/api/inventory/add", item);
        setData((prev) => ({
          ...prev,
          [saved.tenantId]: {
            ...(prev[saved.tenantId] ?? emptyDataset()),
            inventory: [saved, ...(prev[saved.tenantId]?.inventory ?? []).filter((row) => row.id !== saved.id)],
          },
        }));
        return saved;
      }
      const saved: KebayaItem = { ...item, id: uniqueId("I"), tenantId, dateAdded: TODAY };
      setData((prev) => ({
        ...prev,
        [tenantId]: {
          ...prev[tenantId],
          inventory: [saved, ...prev[tenantId].inventory],
        },
      }));
      return saved;
    },
    [data, tenantId, tenantList, realUser, realTenant],
  );

  const editItem = useCallback(
    async (item: KebayaItem): Promise<KebayaItem> => {
      if (item.tenantId !== tenantId) {
        throw new Error("Inventory item not found.");
      }
      if (realUser) {
        const saved = await postInventoryAction("/api/inventory/edit", item);
        setData((prev) => ({
          ...prev,
          [saved.tenantId]: {
            ...(prev[saved.tenantId] ?? emptyDataset()),
            inventory: (prev[saved.tenantId]?.inventory ?? []).map((row) => (row.id === saved.id ? saved : row)),
          },
        }));
        return saved;
      }
      setData((prev) => ({
        ...prev,
        [tenantId]: {
          ...prev[tenantId],
          inventory: prev[tenantId].inventory.map((row) => (row.id === item.id ? item : row)),
        },
      }));
      return item;
    },
    [tenantId, realUser],
  );

  const openTransaction = useCallback(
    async (input: OpenTransactionInput): Promise<TransactionReceipt> => {
      const tenant = (realUser ? realTenant : tenantList.find((t) => t.id === tenantId)) ?? synthTenant(tenantId);
      const user = currentUser ?? ownerOf(userList, tenantId);
      const ds = data[tenantId];
      const items = ds.inventory.filter((item) => input.itemIds.includes(item.id));
      if (items.length !== input.itemIds.length || items.some((item) => item.status !== "available")) {
        throw new Error("Only available items can be rented.");
      }
      const conflictingBooking = input.itemIds.flatMap((itemId) =>
        conflictsIn(ds.bookings, itemId, input.startDate, input.endDate),
      )[0];
      if (conflictingBooking) {
        throw new Error(`Item is already reserved for ${conflictingBooking.startDate} - ${conflictingBooking.endDate}.`);
      }
      if (realUser) {
        const receipt = await postPosOpenAction(input);
        if (receipt.financeSummary) {
          setServerFinanceSummaryByTenant((prev) => ({ ...prev, [receipt.tenant.id]: receipt.financeSummary! }));
        }
        setData((prev) => {
          const current = prev[receipt.tenant.id] ?? emptyDataset();
          const receiptItems = new Map(receipt.items.map((item) => [item.id, item]));
          const hasCustomer = current.customers.some((row) => row.id === receipt.customer.id);
          return {
            ...prev,
            [receipt.tenant.id]: {
              ...current,
              inventory: current.inventory.map((item) => receiptItems.get(item.id) ?? item),
              customers: hasCustomer
                ? current.customers.map((row) => (row.id === receipt.customer.id ? receipt.customer : row))
                : [receipt.customer, ...current.customers],
              bookings: [receipt.booking, ...current.bookings.filter((row) => row.id !== receipt.booking.id)],
              transactions: [
                receipt.transaction,
                ...current.transactions.filter((row) => row.id !== receipt.transaction.id),
              ],
            },
          };
        });
        return receipt;
      }

      const phoneKey = normalizePhone(input.whatsapp);
      const existingCustomer = ds.customers.find((customer) => normalizePhone(customer.whatsapp) === phoneKey);
      const customer: Customer = existingCustomer
        ? {
            ...existingCustomer,
            name: input.customerName.trim(),
            whatsapp: input.whatsapp.trim(),
            instagram: input.instagram?.trim() || existingCustomer.instagram,
            email: input.email?.trim() || existingCustomer.email,
            totalRentals: existingCustomer.totalRentals + 1,
            lastRental: input.startDate,
          }
        : {
            id: uniqueId("C"),
            tenantId,
            name: input.customerName.trim(),
            whatsapp: input.whatsapp.trim(),
            instagram: input.instagram?.trim() || undefined,
            email: input.email?.trim() || undefined,
            measurements: [],
            totalRentals: 1,
            lastRental: input.startDate,
          };

      const booking: Booking = {
        id: uniqueId("B"),
        tenantId,
        customerId: customer.id,
        itemIds: input.itemIds,
        startDate: input.startDate,
        endDate: input.endDate,
        status: "active",
        total: input.rentalTotal,
        deposit: input.deposit,
        notes: input.notes?.trim() || undefined,
      };

      const transaction: Transaction = {
        id: uniqueId("T"),
        tenantId,
        bookingId: booking.id,
        transactionType: "open",
        date: TODAY,
        deposit: input.deposit,
        lateFee: 0,
        damageFee: 0,
        total: input.rentalTotal + input.deposit,
        method: input.method,
        paymentStatus: "paid",
        itemIds: input.itemIds,
        customerName: customer.name,
        customerWhatsapp: customer.whatsapp,
        cashierName: user.name,
        rentalTotal: input.rentalTotal,
        baseRental: input.baseRental,
        extraDayFee: input.extraDayFee,
        notes: input.notes?.trim() || undefined,
        evidence: input.evidence,
      };

      const receipt = { tenant, booking, transaction, customer, items, cashierName: user.name };

      setData((prev) => ({
        ...prev,
        [tenantId]: {
          ...prev[tenantId],
          inventory: prev[tenantId].inventory.map((item) =>
            input.itemIds.includes(item.id)
              ? { ...item, status: "rented", timesRented: item.timesRented + 1 }
              : item,
          ),
          customers: existingCustomer
            ? prev[tenantId].customers.map((row) => (row.id === customer.id ? customer : row))
            : [customer, ...prev[tenantId].customers],
          bookings: [booking, ...prev[tenantId].bookings],
          transactions: [transaction, ...prev[tenantId].transactions],
        },
      }));

      return receipt;
    },
    [data, tenantId, currentUser, userList, tenantList, realUser, realTenant],
  );

  const createReservation = useCallback(
    (input: CreateReservationInput): Booking => {
      const tenant = tenantList.find((row) => row.id === tenantId)!;
      const planRules = rulesForTenant(tenant);
      if (!planRules.manualBookingEnabled) {
        throw new Error("Manual booking is available on Starter and Pro. Upgrade plan to create future reservations.");
      }
      if (tenant.status === "suspended") {
        throw new Error("This store is suspended. Reactivate it before creating reservations.");
      }
      const ds = data[tenantId];
      if (input.startDate <= TODAY) {
        throw new Error("Use POS Rental for today or past in-store transactions.");
      }
      const items = ds.inventory.filter((item) => input.itemIds.includes(item.id));
      if (items.length !== input.itemIds.length) {
        throw new Error("Select valid inventory items before creating a reservation.");
      }
      const conflictingBooking = input.itemIds.flatMap((itemId) =>
        conflictsIn(ds.bookings, itemId, input.startDate, input.endDate),
      )[0];
      if (conflictingBooking) {
        throw new Error(`Item is already reserved for ${conflictingBooking.startDate} - ${conflictingBooking.endDate}.`);
      }

      const phoneKey = normalizePhone(input.whatsapp);
      const existingCustomer = ds.customers.find((customer) => normalizePhone(customer.whatsapp) === phoneKey);
      const nextEvent =
        input.eventType?.trim() || input.eventDate
          ? {
              type: input.eventType?.trim() || "Event",
              date: input.eventDate || input.startDate,
            }
          : existingCustomer?.event;
      const customer: Customer = existingCustomer
        ? {
            ...existingCustomer,
            name: input.customerName.trim(),
            whatsapp: input.whatsapp.trim(),
            instagram: input.instagram?.trim() || existingCustomer.instagram,
            email: input.email?.trim() || existingCustomer.email,
            event: nextEvent,
          }
        : {
            id: uniqueId("C"),
            tenantId,
            name: input.customerName.trim(),
            whatsapp: input.whatsapp.trim(),
            instagram: input.instagram?.trim() || undefined,
            email: input.email?.trim() || undefined,
            event: nextEvent,
            measurements: [],
            totalRentals: 0,
            lastRental: input.startDate,
          };

      const booking: Booking = {
        id: uniqueId("B"),
        tenantId,
        customerId: customer.id,
        itemIds: input.itemIds,
        startDate: input.startDate,
        endDate: input.endDate,
        status: "confirmed",
        total: input.rentalTotal,
        deposit: input.deposit,
        notes: input.notes?.trim() || undefined,
      };

      setData((prev) => ({
        ...prev,
        [tenantId]: {
          ...prev[tenantId],
          customers: existingCustomer
            ? prev[tenantId].customers.map((row) => (row.id === customer.id ? customer : row))
            : [customer, ...prev[tenantId].customers],
          bookings: [booking, ...prev[tenantId].bookings],
        },
      }));

      return booking;
    },
    [data, tenantId, tenantList],
  );

  const createPublicBookingRequest = useCallback(
    (input: CreatePublicBookingRequestInput): BookingRequest => {
      const tenant = tenantList.find((row) => row.id === input.tenantId);
      const ds = tenant ? data[tenant.id] : undefined;
      if (!tenant || !ds) {
        throw new Error("Booking page is not available.");
      }
      const planRules = rulesForTenant(tenant);
      if (!planRules.publicBookingEnabled) {
        throw new Error("Public booking page is available on Pro. Upgrade plan to receive online booking requests.");
      }
      if (tenant.status === "suspended") {
        throw new Error("Booking page is not available.");
      }
      if (!input.startDate || !input.endDate || input.endDate < input.startDate) {
        throw new Error("Select a valid rental date range.");
      }
      if (input.startDate <= TODAY) {
        throw new Error("Online booking requests must be for a future date.");
      }
      const item = ds.inventory.find((row) => row.id === input.itemId);
      if (!item) {
        throw new Error("Selected item is no longer available.");
      }
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const request: BookingRequest = {
        id: uniqueId("BR"),
        tenantId: tenant.id,
        itemId: item.id,
        customerName: input.customerName.trim(),
        whatsapp: input.whatsapp.trim(),
        eventType: input.eventType?.trim() || undefined,
        eventDate: input.eventDate || undefined,
        startDate: input.startDate,
        endDate: input.endDate,
        depositAmount: tenant.bookingDepositAmount,
        depositPolicy: tenant.bookingDepositPolicy,
        paymentStatus: "unpaid",
        status: "pending",
        expiresAt,
        notes: input.notes?.trim() || undefined,
        createdAt: new Date().toISOString(),
      };

      setData((prev) => ({
        ...prev,
        [tenant.id]: {
          ...prev[tenant.id],
          bookingRequests: [request, ...prev[tenant.id].bookingRequests],
        },
      }));

      return request;
    },
    [data, tenantList],
  );

  const approveBookingRequest = useCallback(
    (input: ApproveBookingRequestInput): Booking => {
      const ds = data[tenantId];
      const request = ds.bookingRequests.find((row) => row.id === input.requestId);
      if (!request || request.status !== "pending") {
        throw new Error("Only pending booking requests can be approved.");
      }
      const item = ds.inventory.find((row) => row.id === request.itemId);
      if (!item) {
        throw new Error("Requested item no longer exists.");
      }
      const conflictingBooking = conflictsIn(ds.bookings, request.itemId, request.startDate, request.endDate)[0];
      if (conflictingBooking) {
        throw new Error(`Item is already reserved for ${conflictingBooking.startDate} - ${conflictingBooking.endDate}.`);
      }

      const phoneKey = normalizePhone(request.whatsapp);
      const existingCustomer = ds.customers.find((customer) => normalizePhone(customer.whatsapp) === phoneKey);
      const nextEvent =
        request.eventType || request.eventDate
          ? {
              type: request.eventType || "Event",
              date: request.eventDate || request.startDate,
            }
          : existingCustomer?.event;
      const customer: Customer = existingCustomer
        ? {
            ...existingCustomer,
            name: request.customerName.trim(),
            whatsapp: request.whatsapp.trim(),
            event: nextEvent,
          }
        : {
            id: uniqueId("C"),
            tenantId,
            name: request.customerName.trim(),
            whatsapp: request.whatsapp.trim(),
            event: nextEvent,
            measurements: [],
            totalRentals: 0,
            lastRental: request.startDate,
          };

      const booking: Booking = {
        id: uniqueId("B"),
        tenantId,
        customerId: customer.id,
        itemIds: [request.itemId],
        startDate: request.startDate,
        endDate: request.endDate,
        status: "confirmed",
        total: item.rentalPrice,
        deposit: request.depositAmount,
        notes: request.notes,
      };
      const approvedRequest = { ...request, status: "approved" as const };

      setData((prev) => ({
        ...prev,
        [tenantId]: {
          ...prev[tenantId],
          customers: existingCustomer
            ? prev[tenantId].customers.map((row) => (row.id === customer.id ? customer : row))
            : [customer, ...prev[tenantId].customers],
          bookingRequests: prev[tenantId].bookingRequests.map((row) =>
            row.id === request.id ? approvedRequest : row,
          ),
          bookings: [booking, ...prev[tenantId].bookings],
        },
      }));

      return booking;
    },
    [data, tenantId],
  );

  const rejectBookingRequest = useCallback(
    (input: RejectBookingRequestInput): BookingRequest => {
      const ds = data[tenantId];
      const request = ds.bookingRequests.find((row) => row.id === input.requestId);
      if (!request || request.status !== "pending") {
        throw new Error("Only pending booking requests can be rejected.");
      }
      const rejectedRequest = { ...request, status: "rejected" as const };
      setData((prev) => ({
        ...prev,
        [tenantId]: {
          ...prev[tenantId],
          bookingRequests: prev[tenantId].bookingRequests.map((row) =>
            row.id === request.id ? rejectedRequest : row,
          ),
        },
      }));
      return rejectedRequest;
    },
    [data, tenantId],
  );

  const checkoutReservation = useCallback(
    (input: CheckoutReservationInput): TransactionReceipt => {
      const tenant = tenantList.find((t) => t.id === tenantId)!;
      const user = currentUser ?? ownerOf(userList, tenantId);
      const ds = data[tenantId];
      const booking = ds.bookings.find((row) => row.id === input.bookingId);
      if (!booking || booking.status !== "confirmed") {
        throw new Error("Only confirmed reservations can be checked out.");
      }
      if (booking.startDate > TODAY) {
        throw new Error("Future reservations cannot be checked out before the pickup date.");
      }
      const customer = ds.customers.find((row) => row.id === booking.customerId)!;
      const items = ds.inventory.filter((item) => booking.itemIds.includes(item.id));
      if (items.length !== booking.itemIds.length || items.some((item) => item.status !== "available")) {
        throw new Error("All reserved items must be physically available before checkout.");
      }

      const activeBooking = { ...booking, status: "active" as const };
      const transaction: Transaction = {
        id: uniqueId("T"),
        tenantId,
        bookingId: booking.id,
        transactionType: "open",
        date: TODAY,
        deposit: booking.deposit,
        lateFee: 0,
        damageFee: 0,
        total: booking.total + booking.deposit,
        method: input.method,
        paymentStatus: "paid",
        itemIds: booking.itemIds,
        customerName: customer.name,
        customerWhatsapp: customer.whatsapp,
        cashierName: user.name,
        rentalTotal: booking.total,
        baseRental: booking.total,
        extraDayFee: 0,
        notes: input.notes?.trim() || booking.notes,
        evidence: input.evidence,
      };
      const rentedCustomer = {
        ...customer,
        totalRentals: customer.totalRentals + 1,
        lastRental: booking.startDate,
      };
      const receipt = { tenant, booking: activeBooking, transaction, customer: rentedCustomer, items, cashierName: user.name };

      setData((prev) => ({
        ...prev,
        [tenantId]: {
          ...prev[tenantId],
          inventory: prev[tenantId].inventory.map((item) =>
            booking.itemIds.includes(item.id)
              ? { ...item, status: "rented", timesRented: item.timesRented + 1 }
              : item,
          ),
          customers: prev[tenantId].customers.map((row) => (row.id === rentedCustomer.id ? rentedCustomer : row)),
          bookings: prev[tenantId].bookings.map((row) => (row.id === booking.id ? activeBooking : row)),
          transactions: [transaction, ...prev[tenantId].transactions],
        },
      }));

      return receipt;
    },
    [data, tenantId, currentUser, userList, tenantList],
  );

  const closeTransaction = useCallback(
    async (input: ReturnTransactionInput): Promise<TransactionReceipt> => {
      const tenant = (realUser ? realTenant : tenantList.find((t) => t.id === tenantId)) ?? synthTenant(tenantId);
      const user = currentUser ?? ownerOf(userList, tenantId);
      const ds = data[tenantId];
      if (realUser) {
        const receipt = await postPosCloseAction(input);
        if (receipt.financeSummary) {
          setServerFinanceSummaryByTenant((prev) => ({ ...prev, [receipt.tenant.id]: receipt.financeSummary! }));
        }
        setData((prev) => {
          const current = prev[receipt.tenant.id] ?? emptyDataset();
          const receiptItems = new Map(receipt.items.map((item) => [item.id, item]));
          const currentItemIds = new Set(current.inventory.map((item) => item.id));
          const hasBooking = current.bookings.some((row) => row.id === receipt.booking.id);
          const hasCustomer = current.customers.some((row) => row.id === receipt.customer.id);
          return {
            ...prev,
            [receipt.tenant.id]: {
              ...current,
              inventory: [
                ...current.inventory.map((item) => receiptItems.get(item.id) ?? item),
                ...receipt.items.filter((item) => !currentItemIds.has(item.id)),
              ],
              customers: hasCustomer
                ? current.customers.map((row) => (row.id === receipt.customer.id ? receipt.customer : row))
                : [receipt.customer, ...current.customers],
              bookings: hasBooking
                ? current.bookings.map((row) => (row.id === receipt.booking.id ? receipt.booking : row))
                : [receipt.booking, ...current.bookings],
              transactions: [
                receipt.transaction,
                ...current.transactions.filter((row) => row.id !== receipt.transaction.id),
              ],
            },
          };
        });
        return receipt;
      }

      const booking = ds.bookings.find((row) => row.id === input.bookingId);
      if (!booking || booking.status !== "active") {
        throw new Error("Only active rentals can be returned.");
      }
      const customer = ds.customers.find((row) => row.id === booking.customerId)!;
      const items = ds.inventory.filter((item) => booking.itemIds.includes(item.id));
      const totalFees = input.lateFee + input.damageFee;
      const transaction: Transaction = {
        id: uniqueId("T"),
        tenantId,
        bookingId: booking.id,
        transactionType: "close",
        date: input.returnDate,
        deposit: booking.deposit,
        lateFee: input.lateFee,
        damageFee: input.damageFee,
        total: Math.max(0, totalFees - booking.deposit),
        method: input.method,
        paymentStatus: "refunded",
        itemIds: booking.itemIds,
        customerName: customer.name,
        customerWhatsapp: customer.whatsapp,
        cashierName: user.name,
        rentalTotal: booking.total,
        returnNotes: input.notes?.trim() || undefined,
        depositReturned: Math.max(0, booking.deposit - totalFees),
        amountDue: Math.max(0, totalFees - booking.deposit),
      };
      const returnedBooking = { ...booking, status: "returned" as const };
      const returnedStatus: KebayaItem["status"] = input.returnDisposition ?? "maintenance";
      const returnedItems = items.map((item) => ({ ...item, status: returnedStatus }));
      const receipt = { tenant, booking: returnedBooking, transaction, customer, items: returnedItems, cashierName: user.name };

      setData((prev) => ({
        ...prev,
        [tenantId]: {
          ...prev[tenantId],
          inventory: prev[tenantId].inventory.map((item) =>
            booking.itemIds.includes(item.id) ? { ...item, status: returnedStatus } : item,
          ),
          bookings: prev[tenantId].bookings.map((row) => (row.id === booking.id ? returnedBooking : row)),
          transactions: [transaction, ...prev[tenantId].transactions],
        },
      }));

      return receipt;
    },
    [data, tenantId, currentUser, userList, tenantList, realUser, realTenant],
  );

  const completeCleaning = useCallback(
    (input: CleaningCompleteInput): KebayaItem => {
      const ds = data[tenantId];
      const item = ds.inventory.find((row) => row.id === input.itemId);
      if (!item || item.status !== "maintenance") {
        throw new Error("Only cleaning or maintenance items can be marked available.");
      }
      const completed = { ...item, status: "available" as const };
      setData((prev) => ({
        ...prev,
        [tenantId]: {
          ...prev[tenantId],
          inventory: prev[tenantId].inventory.map((row) => (row.id === item.id ? completed : row)),
        },
      }));
      void input.notes;
      return completed;
    },
    [data, tenantId],
  );

  const value = useMemo<TenantContextValue>(() => {
    // Real session → the tenant/team come from the bootstrap fetch; the mock
    // path only backs the prototype signup flow. Either way, fall back to a
    // synthetic empty workspace so the app still renders after login.
    const usingReal = realUser !== null;
    const tenant =
      (usingReal ? realTenant : tenantList.find((t) => t.id === tenantId)) ??
      synthTenant(tenantId, realUser?.tenantName ?? currentUser?.name);
    // Fallback keeps `user` well-typed while logged out; the app gates on
    // isAuthenticated before rendering anything that reads it.
    const user = currentUser ?? ownerOf(userList, tenantId);
    const ds = data[tenantId] ?? emptyDataset();
    const planRules = rulesForTenant(tenant);
    const financeSummary =
      usingReal && serverFinanceSummaryByTenant[tenantId]
        ? serverFinanceSummaryByTenant[tenantId]
        : buildFinanceSummary(ds.transactions);
    const baseTeam = usingReal ? realTeam : userList.filter((u) => u.tenantId === tenantId);
    // Ensure the signed-in user appears in their own team even before staff
    // records exist.
    const team =
      currentUser && !baseTeam.some((u) => u.id === currentUser.id)
        ? [currentUser, ...baseTeam]
        : baseTeam;
    return {
      tenant,
      user,
      team,
      isAuthenticated: currentUser !== null,
      sessionReady,
      login,
      createStore,
      logout,
      refreshSession,
      platform: {
        tenants: tenantList,
        users: userList,
        datasets: data,
        addUser,
        createStore: createPlatformStore,
        removeUser,
        setUserRole,
        updateTenantPlan,
        updateTenantBillingStatus,
        updateTenantStatus,
        updateTenantOnboardingStatus,
        updateTenantOverrides,
        devAuthed,
        devLogin,
        devLogout,
      },
      ...ds,
      financeSummary,
      planRules,
      addItem,
      editItem,
      createReservation,
      createPublicBookingRequest,
      approveBookingRequest,
      rejectBookingRequest,
      checkoutReservation,
      openTransaction,
      closeTransaction,
      completeCleaning,
      provisionStaff,
      itemById: (id) => ds.inventory.find((i) => i.id === id)!,
      customerById: (id) => ds.customers.find((c) => c.id === id)!,
      conflictsFor: (itemId, start, end) => conflictsIn(ds.bookings, itemId, start, end),
      futureBookingFor: (itemId) => futureBookingIn(ds.bookings, itemId),
    };
  }, [
    tenantId,
    tenantList,
    currentUser,
    realUser,
    realTenant,
    realTeam,
    serverFinanceSummaryByTenant,
    userList,
    data,
    devAuthed,
    sessionReady,
    login,
    createStore,
    createPlatformStore,
    logout,
    refreshSession,
    devLogin,
    devLogout,
    addUser,
    removeUser,
    setUserRole,
    updateTenantPlan,
    updateTenantBillingStatus,
    updateTenantStatus,
    updateTenantOnboardingStatus,
    updateTenantOverrides,
    addItem,
    editItem,
    createReservation,
    createPublicBookingRequest,
    approveBookingRequest,
    rejectBookingRequest,
    checkoutReservation,
    openTransaction,
    closeTransaction,
    completeCleaning,
    provisionStaff,
  ]);

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}

export function useTenant(): TenantContextValue {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error("useTenant must be used inside <TenantProvider>");
  return ctx;
}
