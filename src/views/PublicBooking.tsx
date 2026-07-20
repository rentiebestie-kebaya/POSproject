"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CalendarDays, Check, Clock, MessageCircle, Search, ShieldCheck, Shirt } from "lucide-react";
import { useTenant } from "../data/store";
import {
  TODAY,
  formatDate,
  formatIDR,
  rangesOverlap,
  type Booking,
  type KebayaItem,
  type Tenant,
} from "../data/mock";
import { rulesForTenant } from "../data/plans";

const inputCls = "w-full rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-400";
const labelCls = "mb-1.5 block text-xs font-semibold text-ink-2";

function addDays(value: string, days: number): string {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function resolveTenant(slug: string, tenants: Tenant[]): Tenant | undefined {
  const normalized = slug.toLowerCase();
  return tenants.find((tenant) => {
    const subdomain = tenant.subdomain.split(".")[0].toLowerCase();
    return tenant.id === normalized || subdomain === normalized || tenant.subdomain.toLowerCase() === normalized;
  });
}

function activeConflicts(bookings: Booking[], itemId: string, start: string, end: string): Booking[] {
  if (!start || !end || end < start) return [];
  return bookings.filter(
    (booking) =>
      booking.status !== "cancelled" &&
      booking.status !== "returned" &&
      booking.itemIds.includes(itemId) &&
      rangesOverlap(booking.startDate, booking.endDate, start, end),
  );
}

function ItemPhoto({ item, variant = "card" }: { item: KebayaItem; variant?: "card" | "selected" }) {
  const cls = variant === "selected" ? "h-20 w-16 rounded-xl" : "h-24 w-20 rounded-xl";
  if (item.photos[0]) {
    return <img src={item.photos[0]} alt="" className={`${cls} shrink-0 object-cover`} />;
  }
  return (
    <div className={`${cls} flex shrink-0 items-center justify-center bg-brand-100 text-brand-700`}>
      <Shirt size={variant === "selected" ? 19 : 22} />
    </div>
  );
}

function AvailabilityBadge({ available }: { available: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${
        available ? "bg-success/10 text-success ring-success/30" : "bg-error/10 text-error ring-error/40"
      }`}
    >
      {available ? "Available" : "Unavailable"}
    </span>
  );
}

function StepHeader({ number, title, caption }: { number: string; title: string; caption: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-900 text-sm font-semibold text-white">
        {number}
      </div>
      <div className="min-w-0">
        <h2 className="text-base font-semibold tracking-tight">{title}</h2>
        <p className="mt-0.5 text-xs leading-5 text-ink-3">{caption}</p>
      </div>
    </div>
  );
}

export default function PublicBooking({ tenantSlug }: { tenantSlug: string }) {
  const { platform, createPublicBookingRequest } = useTenant();
  const tenant = resolveTenant(tenantSlug, platform.tenants);
  const dataset = tenant ? platform.datasets[tenant.id] : undefined;
  const planRules = tenant ? rulesForTenant(tenant) : undefined;

  const [query, setQuery] = useState("");
  const [selectedItemId, setSelectedItemId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [eventType, setEventType] = useState("");
  const [eventDate, setEventDate] = useState(addDays(TODAY, 14));
  const [startDate, setStartDate] = useState(addDays(TODAY, 13));
  const [endDate, setEndDate] = useState(addDays(TODAY, 15));
  const [notes, setNotes] = useState("");
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const items = dataset?.inventory ?? [];
  const bookings = dataset?.bookings ?? [];
  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      if (!q) return true;
      return [item.name, item.inventoryCode, item.model, item.color, item.sizeLabel].some((value) =>
        value.toLowerCase().includes(q),
      );
    });
  }, [items, query]);
  const selectedItem = items.find((item) => item.id === selectedItemId) ?? filteredItems[0];
  const selectedConflicts = selectedItem ? activeConflicts(bookings, selectedItem.id, startDate, endDate) : [];
  const selectedAvailable = selectedConflicts.length === 0;
  const validRange = Boolean(startDate && endDate && endDate >= startDate && startDate > TODAY);
  const hasRequiredDetails = customerName.trim().length > 1 && whatsapp.trim().length > 5;
  const formValid =
    Boolean(tenant && selectedItem) &&
    hasRequiredDetails &&
    validRange;

  const handleMobileAction = () => {
    if (formValid) {
      submit();
      return;
    }
    document.getElementById("booking-details")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const submit = () => {
    setError("");
    setSuccess("");
    if (!tenant || !selectedItem) return;
    try {
      const request = createPublicBookingRequest({
        tenantId: tenant.id,
        itemId: selectedItem.id,
        customerName,
        whatsapp,
        eventType,
        eventDate,
        startDate,
        endDate,
        notes,
      });
      setCustomerName("");
      setWhatsapp("");
      setNotes("");
      setSuccess(`Request ${request.id} terkirim. ${tenant.name} akan cek dan confirm manual lewat WhatsApp.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send booking request.");
    }
  };

  if (!tenant || !dataset) {
    return (
      <main className="min-h-screen bg-page px-5 py-10">
        <div className="mx-auto max-w-xl rounded-2xl border border-hairline bg-white p-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-error/10 text-error">
            <AlertTriangle size={18} />
          </div>
          <h1 className="mt-4 text-xl font-semibold">Booking page not found</h1>
          <p className="mt-2 text-sm text-ink-2">This shop subdomain is not active in RENTIE.</p>
          <Link href="/" className="mt-5 inline-flex rounded-full bg-brand-900 px-4 py-2 text-sm font-semibold text-white">
            Back to RENTIE
          </Link>
        </div>
      </main>
    );
  }

  if (!planRules?.publicBookingEnabled || tenant.status === "suspended") {
    return (
      <main className="min-h-screen bg-page px-5 py-10">
        <div className="mx-auto max-w-xl rounded-2xl border border-hairline bg-white p-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-warning/20 text-gold-600">
            <AlertTriangle size={18} />
          </div>
          <h1 className="mt-4 text-xl font-semibold">Booking page is not active</h1>
          <p className="mt-2 text-sm leading-6 text-ink-2">
            Public booking is available on Pro. Contact {tenant.name} through WhatsApp for manual rental help.
          </p>
          <a
            href={`https://wa.me/${tenant.whatsapp.replace(/\D/g, "")}`}
            target="_blank"
            rel="noreferrer"
            className="mt-5 inline-flex rounded-full bg-brand-900 px-4 py-2 text-sm font-semibold text-white"
          >
            Chat {tenant.name}
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-page pb-28 lg:pb-10">
      <header className="sticky top-0 z-20 border-b border-hairline bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-900 text-sm font-bold text-gold-400">
              R
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">{tenant.name}</div>
              <div className="truncate text-xs text-ink-3">{tenant.location}</div>
            </div>
          </div>
          <a
            href={`https://wa.me/${tenant.whatsapp.replace(/\D/g, "")}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-9 shrink-0 items-center gap-2 rounded-full border border-hairline bg-white px-3 text-xs font-semibold hover:bg-brand-50"
          >
            <MessageCircle size={14} /> Chat
          </a>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-4 py-4 sm:px-6 lg:py-8">
        <div className="mb-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">Booking request</p>
          <h1 className="mt-1 text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
            Request kebaya untuk acara kamu
          </h1>
          <p className="mt-2 text-sm leading-6 text-ink-2">
            Pilih tanggal dan satu kebaya. Request ini belum confirmed sampai admin butik menghubungi kamu.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="min-w-0 space-y-4">
            <section className="rounded-2xl border border-hairline bg-white p-4">
              <StepHeader
                number="1"
                title="Tanggal pemakaian"
                caption="Tanggal dipakai untuk mengecek bentrok booking."
              />
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <label>
                  <span className={labelCls}>Ambil *</span>
                  <input type="date" className={inputCls} value={startDate} onChange={(event) => setStartDate(event.target.value)} />
                </label>
                <label>
                  <span className={labelCls}>Kembali *</span>
                  <input type="date" className={inputCls} value={endDate} onChange={(event) => setEndDate(event.target.value)} />
                </label>
                <label>
                  <span className={labelCls}>Tanggal acara</span>
                  <input type="date" className={inputCls} value={eventDate} onChange={(event) => setEventDate(event.target.value)} />
                </label>
              </div>
              {!validRange && (
                <p className="mt-3 flex items-center gap-1.5 text-xs font-medium text-critical">
                  <CalendarDays size={13} /> Pilih rentang tanggal di masa depan.
                </p>
              )}
            </section>

            <section className="rounded-2xl border border-hairline bg-white p-4">
              <StepHeader
                number="2"
                title="Pilih satu kebaya"
                caption="Item yang bentrok tetap terlihat, tapi diberi badge unavailable."
              />
              <div className="relative mt-4">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Cari nama, kode, warna, atau size"
                  className="w-full rounded-full border border-black/10 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-brand-400"
                />
              </div>

              <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {filteredItems.map((item) => {
                  const conflicts = activeConflicts(bookings, item.id, startDate, endDate);
                  const available = conflicts.length === 0;
                  const selected = selectedItem?.id === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setSelectedItemId(item.id);
                        setError("");
                        setSuccess("");
                      }}
                      className={`min-w-0 rounded-2xl border bg-white p-3 text-left transition-colors ${
                        selected ? "border-brand-700 ring-2 ring-brand-200" : "border-hairline hover:border-brand-300"
                      }`}
                    >
                      <div className="flex min-w-0 gap-3">
                        <ItemPhoto item={item} />
                        <div className="min-w-0 flex-1">
                          <div className="flex min-w-0 items-center gap-2">
                            <AvailabilityBadge available={available} />
                            <span className="truncate text-xs text-ink-3">{item.inventoryCode}</span>
                          </div>
                          <div className="mt-2 truncate text-sm font-semibold">{item.name}</div>
                          <div className="mt-0.5 truncate text-xs text-ink-3">
                            {item.color} · size {item.sizeLabel}
                          </div>
                          <div className="mt-2 text-sm font-semibold tabular-nums">{formatIDR(item.rentalPrice)}</div>
                          {!available && (
                            <div className="mt-1 line-clamp-2 text-xs font-medium text-critical">
                              Bentrok {formatDate(conflicts[0].startDate)} - {formatDate(conflicts[0].endDate)}
                            </div>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          </div>

          <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
            <section id="booking-details" className="scroll-mt-20 rounded-2xl border border-hairline bg-white p-4">
              <StepHeader
                number="3"
                title="Detail pelanggan"
                caption="Admin butik akan review dan confirm manual lewat WhatsApp."
              />

              {selectedItem ? (
                <div className="mt-4 flex min-w-0 gap-3 rounded-2xl bg-page p-3">
                  <ItemPhoto item={selectedItem} variant="selected" />
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-2">
                      <AvailabilityBadge available={selectedAvailable} />
                      <span className="truncate text-xs text-ink-3">{selectedItem.inventoryCode}</span>
                    </div>
                    <div className="mt-1 truncate text-sm font-semibold">{selectedItem.name}</div>
                    <div className="mt-0.5 truncate text-xs text-ink-3">
                      {selectedItem.color} · size {selectedItem.sizeLabel}
                    </div>
                    <div className="mt-2 text-sm font-semibold tabular-nums">{formatIDR(selectedItem.rentalPrice)}</div>
                  </div>
                </div>
              ) : (
                <p className="mt-4 rounded-xl bg-page p-3 text-sm text-ink-2">Pilih satu kebaya untuk membuat request.</p>
              )}

              <div className="mt-4 rounded-xl border border-hairline bg-page p-3">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <ShieldCheck size={15} className="text-good-text" /> Booking deposit
                </div>
                <div className="mt-2 text-sm text-ink-2">
                  Nominal: <span className="font-semibold text-ink">{formatIDR(tenant.bookingDepositAmount)}</span>
                </div>
                <div className="mt-1 text-xs capitalize text-ink-3">
                  {tenant.bookingDepositPolicy.replace("_", " ")}. Pembayaran diatur setelah admin review.
                </div>
              </div>

              {(success || error) && (
                <div
                  className={`mt-4 flex items-start gap-2 rounded-xl p-3 text-sm ${
                    error ? "bg-error/10 text-error" : "bg-success/10 text-good-text"
                  }`}
                >
                  {error ? <AlertTriangle size={16} className="mt-0.5 shrink-0" /> : <Check size={16} className="mt-0.5 shrink-0" />}
                  <span>{error || success}</span>
                </div>
              )}

              <div className="mt-4 grid gap-3">
                <label>
                  <span className={labelCls}>Nama *</span>
                  <input className={inputCls} value={customerName} onChange={(event) => setCustomerName(event.target.value)} />
                </label>
                <label>
                  <span className={labelCls}>WhatsApp *</span>
                  <input
                    className={inputCls}
                    value={whatsapp}
                    onChange={(event) => setWhatsapp(event.target.value)}
                    placeholder="+62"
                  />
                </label>
                <label>
                  <span className={labelCls}>Acara</span>
                  <input
                    className={inputCls}
                    value={eventType}
                    onChange={(event) => setEventType(event.target.value)}
                    placeholder="Lamaran, wisuda..."
                  />
                </label>
                <label>
                  <span className={labelCls}>Catatan</span>
                  <textarea
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    className={`${inputCls} min-h-20 resize-none`}
                    placeholder="Jam ambil, fitting, atau pertanyaan"
                  />
                </label>
              </div>

              {selectedItem && !selectedAvailable && (
                <p className="mt-3 flex items-start gap-1.5 text-xs font-medium text-critical">
                  <Clock size={13} className="mt-0.5 shrink-0" /> Item ini unavailable untuk tanggal pilihan, tapi kamu tetap bisa minta admin review.
                </p>
              )}

              <button
                type="button"
                disabled={!formValid}
                onClick={submit}
                className="mt-5 hidden w-full rounded-full bg-brand-900 py-3 text-sm font-semibold text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:bg-brand-200 lg:block"
              >
                Send Booking Request
              </button>
            </section>
          </aside>
        </div>
      </section>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-hairline bg-white/95 px-4 py-3 shadow-[0_-12px_30px_rgba(15,23,42,0.08)] backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-6xl items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold">{selectedItem ? selectedItem.name : "Pilih kebaya"}</div>
            <div className="mt-0.5 truncate text-xs text-ink-3">
              {formatDate(startDate)} - {formatDate(endDate)}
            </div>
          </div>
          <button
            type="button"
            disabled={!selectedItem || !validRange}
            onClick={handleMobileAction}
            className="h-11 shrink-0 rounded-full bg-brand-900 px-5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-brand-200"
          >
            {formValid ? "Request" : "Isi data"}
          </button>
        </div>
      </div>
    </main>
  );
}
