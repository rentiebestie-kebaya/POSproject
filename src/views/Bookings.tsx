"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarPlus,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  MessageCircle,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";
import { Card, PageHeader, BookingStatusBadge, ItemStatusBadge, Th, Td } from "../components/Ui";
import { useTenant } from "../data/store";
import { TODAY, formatDate, formatIDR, rangesOverlap, type BookingRequest, type KebayaItem } from "../data/mock";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const BASE_RENT_DAYS = 3;
const EXTRA_DAY_FEE = 100000;
const DEFAULT_DEPOSIT = 100000;
const labelCls = "mb-1 block text-xs font-medium text-ink-2";
const inputCls = "w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-brand-400";
type BookingTab = "requests" | "reserve" | "calendar" | "confirmed";

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(value: string, days: number): string {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function dayDiff(start: string, end: string): number {
  const [startYear, startMonth, startDay] = start.split("-").map(Number);
  const [endYear, endMonth, endDay] = end.split("-").map(Number);
  const a = Date.UTC(startYear, startMonth - 1, startDay);
  const b = Date.UTC(endYear, endMonth - 1, endDay);
  return Math.round((b - a) / 86400000);
}

function rentalDays(start: string, end: string): number {
  if (!start || !end || end < start) return 0;
  return dayDiff(start, end) + 1;
}

function RequestStatusBadge({ status }: { status: BookingRequest["status"] }) {
  const style = {
    pending: "bg-warning/20 text-gold-600 ring-warning/50",
    approved: "bg-success/10 text-success ring-success/30",
    rejected: "bg-brand-100 text-ink-2 ring-hairline",
    expired: "bg-error/10 text-error ring-error/40",
  }[status];
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ring-1 ${style}`}>
      {status}
    </span>
  );
}

function paymentLabel(status: BookingRequest["paymentStatus"]): string {
  if (status === "paid") return "Deposit paid";
  if (status === "waived") return "Deposit waived";
  return "Deposit unpaid";
}

function expiryLabel(expiresAt: string): string {
  const ms = new Date(expiresAt).getTime() - new Date(`${TODAY}T12:00:00+07:00`).getTime();
  const hours = Math.max(0, Math.ceil(ms / 3600000));
  return `${hours}h left`;
}

function RequestInbox() {
  const {
    bookingRequests,
    conflictsFor,
    itemById,
    approveBookingRequest,
    rejectBookingRequest,
  } = useTenant();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const sorted = [...bookingRequests].sort((a, b) => {
    if (a.status === b.status) return a.expiresAt.localeCompare(b.expiresAt);
    return a.status === "pending" ? -1 : 1;
  });

  const reset = () => {
    setMessage("");
    setError("");
  };

  const approve = (requestId: string) => {
    reset();
    try {
      const booking = approveBookingRequest({ requestId });
      setMessage(`Request approved. Booking ${booking.id} is now confirmed.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not approve request.");
    }
  };

  const reject = (requestId: string) => {
    reset();
    try {
      rejectBookingRequest({ requestId });
      setMessage("Request rejected.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reject request.");
    }
  };

  return (
    <div className="space-y-4">
      {(message || error) && (
        <div className={`flex items-start gap-2 rounded-xl p-3 text-sm ${error ? "bg-error/10 text-error" : "bg-success/10 text-good-text"}`}>
          {error ? <AlertTriangle size={16} className="mt-0.5" /> : <Check size={16} className="mt-0.5" />}
          <span>{error || message}</span>
        </div>
      )}

      <div className="grid gap-3">
        {sorted.map((request) => {
          const item = itemById(request.itemId);
          const conflicts = conflictsFor(request.itemId, request.startDate, request.endDate);
          const available = conflicts.length === 0;
          const pending = request.status === "pending";
          return (
            <Card key={request.id} className="overflow-hidden">
              <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_260px]">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <RequestStatusBadge status={request.status} />
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${
                      available ? "bg-success/10 text-success ring-success/30" : "bg-error/10 text-error ring-error/40"
                    }`}>
                      {available ? "Available" : "Unavailable"}
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs text-ink-3">
                      <Clock size={12} /> {expiryLabel(request.expiresAt)}
                    </span>
                  </div>

                  <div className="mt-3 flex items-start gap-3">
                    {item.photos[0] ? (
                      <img src={item.photos[0]} alt="" className="h-20 w-16 shrink-0 rounded-lg object-cover" />
                    ) : (
                      <div className="flex h-20 w-16 shrink-0 items-center justify-center rounded-lg bg-brand-100 text-xs">KB</div>
                    )}
                    <div className="min-w-0">
                      <h2 className="truncate text-base font-semibold">{request.customerName}</h2>
                      <div className="mt-0.5 text-sm text-ink-2">{request.whatsapp}</div>
                      <div className="mt-2 text-sm font-medium">{item.name}</div>
                      <div className="mt-0.5 text-xs text-ink-3">
                        {formatDate(request.startDate)} - {formatDate(request.endDate)}
                        {request.eventType && ` · ${request.eventType}`}
                        {request.eventDate && ` on ${formatDate(request.eventDate)}`}
                      </div>
                      {request.notes && <p className="mt-2 text-sm text-ink-2">{request.notes}</p>}
                      {!available && (
                        <p className="mt-2 text-xs font-medium text-critical">
                          Conflict: {conflicts[0].id} · {formatDate(conflicts[0].startDate)} - {formatDate(conflicts[0].endDate)}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-hairline bg-page p-3">
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between gap-3">
                      <span className="text-ink-2">Deposit</span>
                      <span className="font-medium tabular-nums">{formatIDR(request.depositAmount)}</span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-ink-2">Policy</span>
                      <span className="font-medium capitalize">{request.depositPolicy.replace("_", " ")}</span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-ink-2">Payment</span>
                      <span className={`font-medium ${request.paymentStatus === "paid" ? "text-good-text" : "text-critical"}`}>
                        {paymentLabel(request.paymentStatus)}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-2">
                    <a
                      href={`https://wa.me/${request.whatsapp.replace(/\D/g, "")}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center justify-center gap-2 rounded-full border border-hairline bg-white px-3 py-2 text-sm font-semibold hover:bg-brand-50"
                    >
                      <MessageCircle size={14} /> WhatsApp
                    </a>
                    <button
                      type="button"
                      disabled={!pending || !available}
                      onClick={() => approve(request.id)}
                      className="inline-flex items-center justify-center gap-2 rounded-full bg-brand-900 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:bg-brand-200"
                    >
                      <Check size={14} /> Approve
                    </button>
                    <button
                      type="button"
                      disabled={!pending}
                      onClick={() => reject(request.id)}
                      className="inline-flex items-center justify-center gap-2 rounded-full border border-hairline bg-white px-3 py-2 text-sm font-semibold text-ink-2 hover:bg-page disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <X size={14} /> Reject
                    </button>
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function ItemReservationRow({
  item,
  selected,
  disabled,
  hint,
  onClick,
}: {
  item: KebayaItem;
  selected: boolean;
  disabled: boolean;
  hint?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors ${
        selected
          ? "border-brand-500 bg-brand-50"
          : disabled
            ? "cursor-not-allowed border-hairline bg-page opacity-70"
            : "border-hairline bg-surface hover:bg-brand-50"
      }`}
    >
      {item.photos[0] ? (
        <img src={item.photos[0]} alt="" className="h-14 w-11 shrink-0 rounded-lg object-cover" />
      ) : (
        <div className="flex h-14 w-11 shrink-0 items-center justify-center rounded-lg bg-brand-100 text-xs">KB</div>
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{item.name}</div>
        <div className="mt-0.5 truncate text-xs text-ink-3">
          {item.inventoryCode} · {item.color} · size {item.sizeLabel}
        </div>
        {hint && <div className="mt-1 text-xs font-medium text-critical">{hint}</div>}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <ItemStatusBadge status={item.status} />
        <span className="text-xs font-medium tabular-nums text-ink-2">{formatIDR(item.rentalPrice)}</span>
      </div>
    </button>
  );
}

function ReservationForm() {
  const { inventory, planRules, conflictsFor, createReservation } = useTenant();
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [instagram, setInstagram] = useState("");
  const [email, setEmail] = useState("");
  const [eventType, setEventType] = useState("");
  const [eventDate, setEventDate] = useState(addDays(TODAY, 14));
  const [startDate, setStartDate] = useState(addDays(TODAY, 14));
  const [endDate, setEndDate] = useState(addDays(TODAY, 16));
  const [deposit, setDeposit] = useState(DEFAULT_DEPOSIT);
  const [notes, setNotes] = useState("");
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const validRange = Boolean(startDate && endDate && endDate >= startDate);
  const futureRange = Boolean(startDate && startDate > TODAY);
  const activeDays = rentalDays(startDate, endDate);
  const extraDays = Math.max(0, activeDays - BASE_RENT_DAYS);
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return inventory
      .filter((item) => {
        if (!q) return true;
        return [item.name, item.qrCode, item.inventoryCode, item.model, item.color].some((value) =>
          value.toLowerCase().includes(q),
        );
      })
      .map((item) => ({
        item,
        conflicts: validRange ? conflictsFor(item.id, startDate, endDate) : [],
      }));
  }, [conflictsFor, endDate, inventory, query, startDate, validRange]);

  const selectedItems = inventory.filter((item) => selectedIds.includes(item.id));
  const baseRental = selectedItems.reduce((sum, item) => sum + item.rentalPrice, 0);
  const extraDayFee = selectedItems.length * extraDays * EXTRA_DAY_FEE;
  const rentalTotal = baseRental + extraDayFee;
  const hasConflict = rows.some((row) => selectedIds.includes(row.item.id) && row.conflicts.length > 0);
  const formValid =
    selectedItems.length > 0 &&
    customerName.trim().length > 1 &&
    whatsapp.trim().length > 5 &&
    validRange &&
    futureRange &&
    !hasConflict;

  const resetMessages = () => {
    setError("");
    setSuccess("");
  };

  if (!planRules.manualBookingEnabled) {
    return (
      <Card className="mb-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <CalendarPlus size={16} /> Future kebaya reservation
            </h2>
            <p className="mt-1 text-sm text-ink-2">
              Manual future booking entry is available on Starter and Pro.
            </p>
          </div>
          <span className="rounded-full bg-warning/20 px-3 py-1 text-xs font-semibold text-gold-600">
            Locked
          </span>
        </div>
        <div className="mt-4 flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/10 px-3 py-2.5 text-sm text-ink-2">
          <AlertTriangle size={16} className="mt-0.5 shrink-0 text-gold-600" />
          <span>Upgrade to Starter to create manual reservations. POS rental transactions are still available on Free.</span>
        </div>
      </Card>
    );
  }

  const toggleItem = (itemId: string) => {
    resetMessages();
    setSelectedIds((prev) => (prev.includes(itemId) ? prev.filter((id) => id !== itemId) : [...prev, itemId]));
  };

  const handleCreate = async () => {
    if (submitting) return;
    resetMessages();
    setSubmitting(true);
    try {
      const booking = await createReservation({
        itemIds: selectedIds,
        customerName,
        whatsapp,
        instagram,
        email,
        eventType,
        eventDate,
        startDate,
        endDate,
        rentalTotal,
        deposit,
        notes,
      });
      setSelectedIds([]);
      setCustomerName("");
      setWhatsapp("");
      setInstagram("");
      setEmail("");
      setEventType("");
      setNotes("");
      setSuccess(`Reservation ${booking.id} confirmed. Inventory stays available until POS checkout.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reservation failed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="mb-4 p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <CalendarPlus size={16} /> Future kebaya reservation
          </h2>
          <p className="mt-1 text-sm text-ink-2">
            Manually input a future reservation without creating a POS rental or changing physical inventory status.
          </p>
        </div>
      </div>

      {(success || error) && (
        <div
          className={`mb-4 flex items-start gap-2 rounded-xl p-3 text-sm ${
            error ? "bg-error/10 text-error" : "bg-success/10 text-good-text"
          }`}
        >
          {error ? <AlertTriangle size={16} className="mt-0.5" /> : <Check size={16} className="mt-0.5" />}
          <span>{error || success}</span>
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(320px,0.9fr)_minmax(340px,1fr)_minmax(280px,0.7fr)]">
        <div>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold">1 · Select kebaya</h3>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search item"
                className="w-48 rounded-full border border-black/10 bg-white py-2 pl-8 pr-3 text-sm outline-none focus:border-brand-400"
              />
            </div>
          </div>
          <div className="grid max-h-[460px] gap-2 overflow-y-auto pr-1">
            {rows.map(({ item, conflicts }) => {
              const blocked = conflicts.length > 0;
              return (
                <ItemReservationRow
                  key={item.id}
                  item={item}
                  selected={selectedIds.includes(item.id)}
                  disabled={blocked}
                  hint={
                    blocked
                      ? `Reserved ${formatDate(conflicts[0].startDate)} - ${formatDate(conflicts[0].endDate)}`
                      : undefined
                  }
                  onClick={() => toggleItem(item.id)}
                />
              );
            })}
          </div>
        </div>

        <div>
          <h3 className="mb-3 text-sm font-semibold">2 · Customer and event</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <label>
              <span className={labelCls}>Nama pelanggan *</span>
              <input className={inputCls} value={customerName} onChange={(event) => setCustomerName(event.target.value)} />
            </label>
            <label>
              <span className={labelCls}>Nomor WhatsApp *</span>
              <input className={inputCls} value={whatsapp} onChange={(event) => setWhatsapp(event.target.value)} placeholder="+62" />
            </label>
            <label>
              <span className={labelCls}>Instagram</span>
              <input className={inputCls} value={instagram} onChange={(event) => setInstagram(event.target.value)} placeholder="@username" />
            </label>
            <label>
              <span className={labelCls}>Email</span>
              <input type="email" className={inputCls} value={email} onChange={(event) => setEmail(event.target.value)} />
            </label>
            <label>
              <span className={labelCls}>Event type</span>
              <input className={inputCls} value={eventType} onChange={(event) => setEventType(event.target.value)} placeholder="Lamaran, wisuda..." />
            </label>
            <label>
              <span className={labelCls}>Event date</span>
              <input type="date" className={inputCls} value={eventDate} onChange={(event) => setEventDate(event.target.value)} />
            </label>
            <label>
              <span className={labelCls}>Tanggal ambil / mulai sewa *</span>
              <input type="date" className={inputCls} value={startDate} onChange={(event) => setStartDate(event.target.value)} />
            </label>
            <label>
              <span className={labelCls}>Tanggal pengembalian *</span>
              <input type="date" className={inputCls} value={endDate} onChange={(event) => setEndDate(event.target.value)} />
            </label>
            <label>
              <span className={labelCls}>Booking deposit</span>
              <input
                type="number"
                min={0}
                step={50000}
                className={`${inputCls} tabular-nums`}
                value={deposit}
                onChange={(event) => setDeposit(Number(event.target.value))}
              />
            </label>
          </div>
          <label className="mt-3 block">
            <span className={labelCls}>Reservation notes</span>
            <textarea
              className={`${inputCls} min-h-20 resize-none`}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Pickup time, fitting note, requested alteration..."
            />
          </label>
        </div>

        <div>
          <h3 className="mb-3 text-sm font-semibold">3 · Reservation summary</h3>
          {selectedItems.length === 0 ? (
            <p className="rounded-lg bg-page p-3 text-sm text-ink-2">No kebaya selected yet.</p>
          ) : (
            <ul className="mb-3 divide-y divide-hairline rounded-xl border border-hairline">
              {selectedItems.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-3 p-3 text-sm">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{item.name}</div>
                    <div className="mt-0.5 truncate text-xs text-ink-3">{item.inventoryCode}</div>
                  </div>
                  <span className="shrink-0 tabular-nums">{formatIDR(item.rentalPrice)}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="space-y-1.5 border-t border-hairline pt-3 text-sm">
            <div className="flex justify-between text-ink-2">
              <span>Base rent ({BASE_RENT_DAYS} days)</span>
              <span className="tabular-nums">{formatIDR(baseRental)}</span>
            </div>
            <div className="flex justify-between text-ink-2">
              <span>Reservation days</span>
              <span className="tabular-nums">{activeDays || "-"}</span>
            </div>
            {extraDays > 0 && (
              <div className="flex justify-between text-critical">
                <span>Extra days ({extraDays} x {selectedItems.length})</span>
                <span className="tabular-nums">{formatIDR(extraDayFee)}</span>
              </div>
            )}
            <div className="flex justify-between text-ink-2">
              <span>Rental total</span>
              <span className="tabular-nums">{formatIDR(rentalTotal)}</span>
            </div>
            <div className="flex justify-between text-ink-2">
              <span>Booking deposit</span>
              <span className="tabular-nums">{formatIDR(deposit)}</span>
            </div>
          </div>
          {!futureRange && <p className="mt-3 text-xs font-medium text-critical">Use POS Rental for today or past in-store transactions.</p>}
          {!validRange && <p className="mt-3 text-xs font-medium text-critical">Return date must be after the rental start date.</p>}
          {hasConflict && <p className="mt-3 text-xs font-medium text-critical">One selected item already has an overlapping reservation.</p>}
          <button
            type="button"
            disabled={!formValid || submitting}
            onClick={handleCreate}
            className="mt-4 w-full rounded-full bg-brand-900 py-2.5 text-sm font-semibold text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:bg-brand-200"
          >
            {submitting ? "Saving…" : "Create Future Reservation"}
          </button>
        </div>
      </div>
    </Card>
  );
}

function MonthCalendar() {
  const { bookings, customerById, itemById } = useTenant();
  const [monthStart, setMonthStart] = useState(new Date(2026, 6, 1));
  const [selected, setSelected] = useState<string | null>("2026-07-19");

  const cells = useMemo(() => {
    const year = monthStart.getFullYear();
    const month = monthStart.getMonth();
    const first = new Date(Date.UTC(year, month, 1));
    const lead = (first.getUTCDay() + 6) % 7; // Monday-first
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const out: (string | null)[] = Array(lead).fill(null);
    for (let d = 1; d <= daysInMonth; d++) out.push(iso(new Date(Date.UTC(year, month, d))));
    while (out.length % 7 !== 0) out.push(null);
    return out;
  }, [monthStart]);

  const bookingsOn = (day: string) =>
    bookings.filter(
      (b) =>
        b.status !== "cancelled" &&
        b.status !== "returned" &&
        rangesOverlap(b.startDate, b.endDate, day, day),
    );

  const monthLabel = monthStart.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  const selectedBookings = selected ? bookingsOn(selected) : [];

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="p-5 lg:col-span-2">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold">{monthLabel}</h2>
          <div className="flex gap-1">
            <button
              onClick={() => setMonthStart(new Date(monthStart.getFullYear(), monthStart.getMonth() - 1, 1))}
              className="rounded-full p-1.5 text-ink-2 hover:bg-black/5"
              aria-label="Previous month"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => setMonthStart(new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1))}
              className="rounded-full p-1.5 text-ink-2 hover:bg-black/5"
              aria-label="Next month"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium uppercase tracking-wide text-ink-3">
          {WEEKDAYS.map((d) => (
            <div key={d} className="py-1">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((day, i) =>
            day === null ? (
              <div key={i} />
            ) : (
              <button
                key={i}
                onClick={() => setSelected(day)}
                className={`flex aspect-square flex-col items-center justify-center rounded-lg border text-sm transition-colors ${
                  selected === day
                    ? "border-brand-600 bg-brand-50 font-semibold text-brand-700"
                    : day === "2026-07-19"
                      ? "border-hairline bg-gold-500/10 font-semibold"
                      : "border-transparent hover:bg-brand-50"
                }`}
              >
                {Number(day.slice(8))}
                <span className="mt-0.5 flex h-1.5 gap-0.5">
                  {bookingsOn(day).slice(0, 3).map((b) => (
                    <span
                      key={b.id}
                      className={`h-1.5 w-1.5 rounded-full ${b.status === "late" ? "bg-critical" : "bg-brand-500"}`}
                    />
                  ))}
                </span>
              </button>
            ),
          )}
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="mb-1 text-sm font-semibold">
          {selected ? `Bookings on ${formatDate(selected)}` : "Select a date"}
        </h2>
        <p className="mb-3 flex items-center gap-1.5 text-xs text-ink-3">
          <ShieldCheck size={13} className="text-good-text" />
          Double-booking prevention is active
        </p>
        {selectedBookings.length === 0 ? (
          <p className="text-sm text-ink-2">No bookings overlap this date.</p>
        ) : (
          <ul className="space-y-3">
            {selectedBookings.map((b) => (
              <li key={b.id} className="rounded-lg border border-hairline p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{customerById(b.customerId).name}</span>
                  <BookingStatusBadge status={b.status} />
                </div>
                <div className="mt-1 text-xs text-ink-2">
                  {b.itemIds.map((id) => `${itemById(id).name} (${itemById(id).qrCode})`).join(", ")}
                </div>
                <div className="mt-1 text-xs text-ink-3">
                  {formatDate(b.startDate)} → {formatDate(b.endDate)}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function ConfirmedBookingsTable() {
  const { bookings, customerById, itemById } = useTenant();
  const sorted = [...bookings].sort((a, b) => b.startDate.localeCompare(a.startDate));
  return (
    <Card className="overflow-hidden">
      <table className="w-full">
        <thead className="border-b border-hairline bg-page">
          <tr>
            <Th>Booking</Th>
            <Th>Customer</Th>
            <Th>Items</Th>
            <Th>Dates</Th>
            <Th className="text-right">Total</Th>
            <Th className="text-right">Deposit</Th>
            <Th>Status</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-hairline">
          {sorted.map((b) => (
            <tr key={b.id} className="hover:bg-brand-50/40">
              <Td className="font-medium">{b.id}</Td>
              <Td>{customerById(b.customerId).name}</Td>
              <Td className="max-w-56">
                <span className="line-clamp-1 text-ink-2">
                  {b.itemIds.map((id) => itemById(id).name).join(", ")}
                </span>
              </Td>
              <Td className="whitespace-nowrap text-ink-2">
                {formatDate(b.startDate)} → {formatDate(b.endDate)}
              </Td>
              <Td className="text-right tabular-nums">{formatIDR(b.total)}</Td>
              <Td className="text-right tabular-nums text-ink-2">{formatIDR(b.deposit)}</Td>
              <Td><BookingStatusBadge status={b.status} /></Td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

export default function Bookings() {
  const { bookingRequests } = useTenant();
  const pendingCount = bookingRequests.filter((request) => request.status === "pending").length;
  const [activeTab, setActiveTab] = useState<BookingTab>(pendingCount > 0 ? "requests" : "calendar");
  const tabs: { id: BookingTab; label: string; count?: number }[] = [
    { id: "requests", label: "Requests", count: pendingCount },
    { id: "reserve", label: "Add Booking" },
    { id: "calendar", label: "Calendar" },
    { id: "confirmed", label: "Confirmed Bookings" },
  ];

  return (
    <>
      <PageHeader
        title="Bookings"
        subtitle="Review public booking requests, manually input future reservations, and keep POS Rental for present in-store checkout."
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${
              activeTab === tab.id
                ? "border-brand-900 bg-brand-900 text-white"
                : "border-hairline bg-surface text-ink-2 hover:bg-brand-50"
            }`}
          >
            {tab.label}
            {tab.count ? (
              <span className={`rounded-full px-1.5 py-0.5 text-[11px] ${
                activeTab === tab.id ? "bg-white/20 text-white" : "bg-brand-100 text-brand-700"
              }`}>
                {tab.count}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {activeTab === "requests" && <RequestInbox />}
      {activeTab === "reserve" && <ReservationForm />}
      {activeTab === "calendar" && <MonthCalendar />}
      {activeTab === "confirmed" && <ConfirmedBookingsTable />}
    </>
  );
}
