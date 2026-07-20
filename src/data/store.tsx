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
  tenants,
  users,
  type Booking,
  type BookingRequest,
  type Customer,
  type KebayaItem,
  type PaymentMethod,
  type Tenant,
  type TenantDataset,
  type Transaction,
  type User,
} from "./mock";

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
}

export interface AddUserInput {
  tenantId: string;
  name: string;
  role: User["role"];
}

/** Platform-level view for the developer console — spans ALL tenants, unlike the
    rest of the context, which is scoped to the signed-in user's shop. */
export interface PlatformValue {
  tenants: Tenant[];
  users: User[];
  datasets: Record<string, TenantDataset>;
  addUser: (input: AddUserInput) => void;
  removeUser: (id: string) => void;
  setUserRole: (id: string, role: User["role"]) => void;
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
  logout: () => void;

  /** Cross-tenant data + user management for the developer console. */
  platform: PlatformValue;

  inventory: KebayaItem[];
  customers: Customer[];
  bookingRequests: BookingRequest[];
  bookings: Booking[];
  transactions: TenantDataset["transactions"];
  monthlyRevenue: TenantDataset["monthlyRevenue"];

  /** Adds to the current tenant's inventory — tenantId is stamped by the store. */
  addItem: (item: Omit<KebayaItem, "tenantId" | "dateAdded">) => void;
  createReservation: (input: CreateReservationInput) => Booking;
  createPublicBookingRequest: (input: CreatePublicBookingRequestInput) => BookingRequest;
  approveBookingRequest: (input: ApproveBookingRequestInput) => Booking;
  rejectBookingRequest: (input: RejectBookingRequestInput) => BookingRequest;
  checkoutReservation: (input: CheckoutReservationInput) => TransactionReceipt;
  openTransaction: (input: OpenTransactionInput) => TransactionReceipt;
  closeTransaction: (input: ReturnTransactionInput) => TransactionReceipt;
  completeCleaning: (input: CleaningCompleteInput) => KebayaItem;

  itemById: (id: string) => KebayaItem;
  customerById: (id: string) => Customer;
  conflictsFor: (itemId: string, start: string, end: string) => Booking[];
  futureBookingFor: (itemId: string) => Booking | undefined;
}

const TenantContext = createContext<TenantContextValue | null>(null);

function ownerOf(list: User[], tenantId: string): User {
  return list.find((u) => u.tenantId === tenantId && u.role === "owner") ?? list.find((u) => u.tenantId === tenantId)!;
}

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

function uniqueId(prefix: string): string {
  return `${prefix}${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
}

// Persisted so a page reload keeps the "signed-in" user, like a real session.
const SESSION_KEY = "rentie.userId";
// Separate dev-console session — the platform admin is not a tenant staff member.
const DEV_KEY = "rentie.dev";
const DATA_KEY = "rentie.tenantData.v1";

export function TenantProvider({ children }: { children: ReactNode }) {
  // Session-mutable user directory — the dev console adds/removes entries here,
  // and the login screen reads from it, so newly created users can sign in.
  const [userList, setUserList] = useState<User[]>(users);
  // The signed-in user is the session source of truth; null means logged out.
  // Starts null on the server and is restored from localStorage after
  // hydration (Next.js renders this component on the server first, where
  // localStorage does not exist); sessionReady flips once that read is done.
  const [userId, setUserId] = useState<string | null>(null);
  const [devAuthed, setDevAuthed] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [dataReady, setDataReady] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(SESSION_KEY);
    if (saved && users.some((u) => u.id === saved)) setUserId(saved);
    setDevAuthed(localStorage.getItem(DEV_KEY) === "1");
    const savedData = localStorage.getItem(DATA_KEY);
    if (savedData) {
      try {
        setData(JSON.parse(savedData) as Record<string, TenantDataset>);
      } catch {
        localStorage.removeItem(DATA_KEY);
      }
    }
    setDataReady(true);
    setSessionReady(true);
  }, []);
  // Tenant is derived from the signed-in user — signing in as staff scopes their
  // shop automatically. Falls back to the first tenant only while logged out, so
  // the store's selectors stay valid (the app never renders them unauthenticated).
  const currentUser = (userId && userList.find((u) => u.id === userId)) || null;
  const tenantId = currentUser ? currentUser.tenantId : tenants[0].id;
  // Session-mutable copy of the per-tenant datasets (added items live here).
  const [data, setData] = useState(seedData);

  useEffect(() => {
    if (!dataReady) return;
    localStorage.setItem(DATA_KEY, JSON.stringify(data));
  }, [data, dataReady]);

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
  }, []);

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
    if (!name || !tenants.some((t) => t.id === input.tenantId)) return;
    setUserList((prev) => [...prev, { id: uniqueId("U"), tenantId: input.tenantId, name, role: input.role }]);
  }, []);

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

  const addItem = useCallback(
    (item: Omit<KebayaItem, "tenantId" | "dateAdded">) => {
      setData((prev) => ({
        ...prev,
        [tenantId]: {
          ...prev[tenantId],
          inventory: [{ ...item, tenantId, dateAdded: TODAY }, ...prev[tenantId].inventory],
        },
      }));
    },
    [tenantId],
  );

  const openTransaction = useCallback(
    (input: OpenTransactionInput): TransactionReceipt => {
      const tenant = tenants.find((t) => t.id === tenantId)!;
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
    [data, tenantId, currentUser, userList],
  );

  const createReservation = useCallback(
    (input: CreateReservationInput): Booking => {
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
    [data, tenantId],
  );

  const createPublicBookingRequest = useCallback(
    (input: CreatePublicBookingRequestInput): BookingRequest => {
      const tenant = tenants.find((row) => row.id === input.tenantId);
      const ds = tenant ? data[tenant.id] : undefined;
      if (!tenant || !ds) {
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
    [data],
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
      const tenant = tenants.find((t) => t.id === tenantId)!;
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
    [data, tenantId, currentUser, userList],
  );

  const closeTransaction = useCallback(
    (input: ReturnTransactionInput): TransactionReceipt => {
      const tenant = tenants.find((t) => t.id === tenantId)!;
      const user = currentUser ?? ownerOf(userList, tenantId);
      const ds = data[tenantId];
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
      const receipt = { tenant, booking: returnedBooking, transaction, customer, items, cashierName: user.name };

      setData((prev) => ({
        ...prev,
        [tenantId]: {
          ...prev[tenantId],
          inventory: prev[tenantId].inventory.map((item) =>
            booking.itemIds.includes(item.id) ? { ...item, status: "maintenance" } : item,
          ),
          bookings: prev[tenantId].bookings.map((row) => (row.id === booking.id ? returnedBooking : row)),
          transactions: [transaction, ...prev[tenantId].transactions],
        },
      }));

      return receipt;
    },
    [data, tenantId, currentUser, userList],
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
    const tenant = tenants.find((t) => t.id === tenantId)!;
    // Fallback keeps `user` well-typed while logged out; the app gates on
    // isAuthenticated before rendering anything that reads it.
    const user = currentUser ?? ownerOf(userList, tenantId);
    const ds = data[tenantId];
    return {
      tenant,
      user,
      team: userList.filter((u) => u.tenantId === tenantId),
      isAuthenticated: currentUser !== null,
      sessionReady,
      login,
      logout,
      platform: {
        tenants,
        users: userList,
        datasets: data,
        addUser,
        removeUser,
        setUserRole,
        devAuthed,
        devLogin,
        devLogout,
      },
      ...ds,
      addItem,
      createReservation,
      createPublicBookingRequest,
      approveBookingRequest,
      rejectBookingRequest,
      checkoutReservation,
      openTransaction,
      closeTransaction,
      completeCleaning,
      itemById: (id) => ds.inventory.find((i) => i.id === id)!,
      customerById: (id) => ds.customers.find((c) => c.id === id)!,
      conflictsFor: (itemId, start, end) => conflictsIn(ds.bookings, itemId, start, end),
      futureBookingFor: (itemId) => futureBookingIn(ds.bookings, itemId),
    };
  }, [
    tenantId,
    currentUser,
    userList,
    data,
    devAuthed,
    sessionReady,
    login,
    logout,
    devLogin,
    devLogout,
    addUser,
    removeUser,
    setUserRole,
    addItem,
    createReservation,
    createPublicBookingRequest,
    approveBookingRequest,
    rejectBookingRequest,
    checkoutReservation,
    openTransaction,
    closeTransaction,
    completeCleaning,
  ]);

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}

export function useTenant(): TenantContextValue {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error("useTenant must be used inside <TenantProvider>");
  return ctx;
}
