"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowUpDown,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  Grid2X2,
  Grid3X3,
  MessageCircle,
  Search,
  Shirt,
  SlidersHorizontal,
} from "lucide-react";
import { useTenant } from "../data/store";
import { TODAY, formatDate, formatIDR, rangesOverlap } from "../data/mock";
import type { PublicStore, PublicStoreBusy, PublicStoreItem } from "@/lib/tenant-data";

const inputCls =
  "w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-brand-400";
const labelCls = "mb-1 block text-xs font-medium text-ink-2";
const cardCls = "rounded-2xl border border-black/5 bg-white shadow-[0_1px_2px_rgba(11,11,11,0.03)]";
const MONTHS = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];
const WEEKDAYS = ["MIN", "SEN", "SEL", "RAB", "KAM", "JUM", "SAB"];

type Density = "comfortable" | "dense";
type FilterMode = "all" | "available" | "busy";
type SortMode = "default" | "price-low" | "price-high" | "name";

function addDays(value: string, days: number): string {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  return formatYmd(date);
}

function formatYmd(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function daysBetween(start: string, end: string): number {
  if (!start || !end || end < start) return 0;
  const startDate = new Date(`${start}T00:00:00`);
  const endDate = new Date(`${end}T00:00:00`);
  return Math.round((endDate.getTime() - startDate.getTime()) / 86400000) + 1;
}

function dateParts(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return { year, month, day };
}

function activeConflicts(
  busy: PublicStoreBusy[],
  itemId: string,
  start: string,
  end: string,
): PublicStoreBusy[] {
  if (!start || !end || end < start) return [];
  return busy.filter((row) => row.itemId === itemId && rangesOverlap(row.startDate, row.endDate, start, end));
}

function busyOnDay(busy: PublicStoreBusy[], itemId: string, day: string): boolean {
  return busy.some((row) => row.itemId === itemId && row.startDate <= day && row.endDate >= day);
}

function itemTags(item: PublicStoreItem): string[] {
  return [
    item.wearStyle === "hijab" ? "Hijab" : "Non-Hijab",
    ...item.occasions.slice(0, 2),
  ].filter(Boolean);
}

function waLink(phone: string, item?: PublicStoreItem) {
  const cleaned = phone.replace(/\D/g, "");
  const text = item ? `Halo admin, saya ingin tanya ${item.name} (${item.inventoryCode}).` : "Halo admin, saya ingin tanya katalog rental.";
  return `https://wa.me/${cleaned}?text=${encodeURIComponent(text)}`;
}

function StoreMark({ tenantName }: { tenantName: string }) {
  const initials = tenantName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-900 text-sm font-bold text-gold-400">
        {initials || "R"}
      </div>
      <div className="min-w-0">
        <div className="truncate text-base font-semibold tracking-tight text-ink">{tenantName}</div>
        <div className="text-[11px] text-ink-3">Katalog & booking</div>
      </div>
    </div>
  );
}

function ProductImage({ item, className }: { item: PublicStoreItem; className: string }) {
  if (item.photos[0]) {
    return <img src={item.photos[0]} alt={item.name} className={`${className} bg-page object-cover`} />;
  }

  return (
    <div className={`${className} flex items-center justify-center bg-brand-50 text-brand-700`}>
      <Shirt size={48} />
    </div>
  );
}

function AvailabilityPill({ available }: { available: boolean }) {
  const cls = available
    ? "bg-success/10 text-success ring-success/30"
    : "bg-error/10 text-error ring-error/40";

  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${cls}`}>
      {available ? "Tersedia" : "Terbooking"}
    </span>
  );
}

function ProductCard({
  item,
  available,
  selected,
  density,
  onSelect,
}: {
  item: PublicStoreItem;
  available: boolean;
  selected: boolean;
  density: Density;
  onSelect: () => void;
}) {
  const tags = itemTags(item);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`group min-w-0 overflow-hidden rounded-2xl border bg-white text-left transition hover:shadow-[0_8px_24px_-12px_rgba(19,26,51,0.25)] ${
        selected ? "border-brand-900 ring-1 ring-brand-900" : "border-black/5 shadow-[0_1px_2px_rgba(11,11,11,0.03)]"
      }`}
    >
      <div className="relative overflow-hidden bg-page">
        <ProductImage item={item} className={density === "dense" ? "aspect-[4/5] w-full" : "aspect-[3/4] w-full"} />
        <div className="absolute left-3 top-3">
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium backdrop-blur-sm ${
              available ? "bg-white/90 text-good-text" : "bg-ink/60 text-white"
            }`}
          >
            {available ? "Tersedia" : "Terbooking"}
          </span>
        </div>
        {tags.length > 0 && (
          <div className="absolute bottom-3 right-3 flex max-w-[calc(100%-1.5rem)] flex-wrap justify-end gap-1.5">
            {tags.slice(0, 2).map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-ink/55 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur-sm"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="space-y-1.5 p-4">
        <div className="text-[11px] font-medium text-ink-3">{item.model}</div>
        <h3 className="line-clamp-2 text-base font-semibold leading-snug tracking-tight text-ink">{item.name}</h3>
        <div className="flex flex-wrap items-baseline gap-x-1.5">
          <span className="text-base font-semibold tabular-nums">{formatIDR(item.rentalPrice)}</span>
          <span className="text-xs text-ink-3">/3 hari</span>
        </div>
        <div className="flex flex-wrap gap-1.5 pt-1">
          <span className="rounded bg-page px-1.5 py-0.5 text-[11px] text-ink-2">Fit {item.sizeLabel}</span>
          <span className="rounded bg-page px-1.5 py-0.5 text-[11px] text-ink-2">{item.color}</span>
        </div>
      </div>
    </button>
  );
}

function AvailabilityCalendar({
  item,
  busy,
  month,
  year,
  selectedStart,
  selectedEnd,
  onMonthChange,
  onYearChange,
  onSelectStart,
}: {
  item: PublicStoreItem | undefined;
  busy: PublicStoreBusy[];
  month: number;
  year: number;
  selectedStart: string;
  selectedEnd: string;
  onMonthChange: (month: number) => void;
  onYearChange: (year: number) => void;
  onSelectStart: (date: string) => void;
}) {
  const first = new Date(year, month, 1);
  const leading = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevMonthDays = new Date(year, month, 0).getDate();
  const cells: { date: string; day: number; current: boolean }[] = [];

  for (let index = leading - 1; index >= 0; index -= 1) {
    const day = prevMonthDays - index;
    cells.push({ date: formatYmd(new Date(year, month - 1, day)), day, current: false });
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({ date: formatYmd(new Date(year, month, day)), day, current: true });
  }
  while (cells.length % 7 !== 0 || cells.length < 42) {
    const nextDay = cells.length - leading - daysInMonth + 1;
    cells.push({ date: formatYmd(new Date(year, month + 1, nextDay)), day: nextDay, current: false });
  }

  const years = [year - 1, year, year + 1, year + 2];

  return (
    <section className={`${cardCls} p-5 sm:p-6`}>
      <h2 className="text-lg font-semibold tracking-tight">Cek ketersediaan tanggal</h2>
      <p className="mt-1 max-w-2xl text-sm leading-6 text-ink-2">
        Pilih tanggal pickup. Sistem akan menandai estimasi periode sewa 3 hari dan konflik booking.
      </p>
      <button
        type="button"
        disabled={!item}
        onClick={() => item && onSelectStart(selectedStart)}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-medium transition hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <CalendarDays size={16} />
        Cek tanggal
      </button>

      <div className="mt-5 border-t border-hairline pt-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <label>
            <span className={labelCls}>Bulan</span>
            <span className="relative block">
              <select value={month} onChange={(event) => onMonthChange(Number(event.target.value))} className={`${inputCls} appearance-none pr-9`}>
                {MONTHS.map((label, index) => (
                  <option key={label} value={index}>
                    {label}
                  </option>
                ))}
              </select>
              <ChevronDown size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-3" />
            </span>
          </label>
          <label>
            <span className={labelCls}>Tahun</span>
            <span className="relative block">
              <select value={year} onChange={(event) => onYearChange(Number(event.target.value))} className={`${inputCls} appearance-none pr-9`}>
                {years.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
              <ChevronDown size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-3" />
            </span>
          </label>
        </div>

        <div className="mt-5 grid grid-cols-7 border-b border-hairline pb-2 text-center text-[11px] font-medium uppercase tracking-wide text-ink-3">
          {WEEKDAYS.map((day) => (
            <div key={day}>{day}</div>
          ))}
        </div>
        <div className="mt-2 grid grid-cols-7 gap-1 sm:gap-1.5">
          {cells.map((cell) => {
            const past = cell.date < TODAY;
            const selected = cell.date >= selectedStart && cell.date <= selectedEnd;
            const busyDay = item ? busyOnDay(busy, item.id, cell.date) : false;
            const available = item && cell.current && !past && !busyDay;
            const cls = selected
              ? "border-brand-900 bg-brand-900 text-white"
              : available
                ? "border-hairline bg-white text-ink hover:border-brand-400 hover:bg-brand-50"
                : busyDay
                  ? "border-transparent bg-gold-400/15 text-gold-600"
                  : "border-transparent bg-page text-ink-3/50";

            return (
              <button
                key={cell.date}
                type="button"
                disabled={!available}
                onClick={() => onSelectStart(cell.date)}
                className={`aspect-square min-h-9 rounded-lg border text-sm font-medium tabular-nums transition ${cls} disabled:cursor-default`}
              >
                {cell.day}
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-ink-2">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded border border-hairline bg-white" /> Tanggal tersedia
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded bg-gold-400/15" /> Tidak tersedia / ter-booking
          </span>
        </div>
      </div>
    </section>
  );
}

export default function PublicBooking({ tenantSlug }: { tenantSlug: string }) {
  const { createPublicBookingRequest } = useTenant();
  const [store, setStore] = useState<PublicStore | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/public/store/${encodeURIComponent(tenantSlug)}`)
      .then((res) => (res.ok ? (res.json() as Promise<PublicStore>) : null))
      .then((data) => {
        if (!cancelled) setStore(data);
      })
      .catch(() => {
        if (!cancelled) setStore(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tenantSlug]);

  const tenant = store?.tenant;
  const items = store?.items ?? [];
  const busy = store?.busy ?? [];
  const initialDate = addDays(TODAY, 5);
  const initialMonth = dateParts(initialDate).month - 1;
  const initialYear = dateParts(initialDate).year;

  const [query, setQuery] = useState("");
  const [selectedItemId, setSelectedItemId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [eventType, setEventType] = useState("");
  const [eventDate, setEventDate] = useState(addDays(initialDate, 1));
  const [startDate, setStartDate] = useState(initialDate);
  const [endDate, setEndDate] = useState(addDays(initialDate, 2));
  const [notes, setNotes] = useState("");
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [sortMode, setSortMode] = useState<SortMode>("default");
  const [density, setDensity] = useState<Density>("comfortable");
  const [calendarMonth, setCalendarMonth] = useState(initialMonth);
  const [calendarYear, setCalendarYear] = useState(initialYear);
  const [mobileCtaVisible, setMobileCtaVisible] = useState(false);

  useEffect(() => {
    const updateVisibility = () => setMobileCtaVisible(window.scrollY > 720);
    updateVisibility();
    window.addEventListener("scroll", updateVisibility, { passive: true });
    return () => window.removeEventListener("scroll", updateVisibility);
  }, []);

  const availabilityByItem = useMemo(() => {
    return new Map(items.map((item) => [item.id, activeConflicts(busy, item.id, startDate, endDate).length === 0]));
  }, [busy, endDate, items, startDate]);

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = items.filter((item) => {
      const available = availabilityByItem.get(item.id) ?? true;
      if (filterMode === "available" && !available) return false;
      if (filterMode === "busy" && available) return false;
      if (!q) return true;
      return [item.name, item.inventoryCode, item.model, item.color, item.sizeLabel, item.wearStyle, ...item.occasions].some((value) =>
        value.toLowerCase().includes(q),
      );
    });

    return [...rows].sort((a, b) => {
      if (sortMode === "price-low") return a.rentalPrice - b.rentalPrice;
      if (sortMode === "price-high") return b.rentalPrice - a.rentalPrice;
      if (sortMode === "name") return a.name.localeCompare(b.name);
      return 0;
    });
  }, [availabilityByItem, filterMode, items, query, sortMode]);

  const selectedItem = items.find((item) => item.id === selectedItemId) ?? filteredItems[0];
  const selectedConflicts = selectedItem ? activeConflicts(busy, selectedItem.id, startDate, endDate) : [];
  const selectedAvailable = selectedConflicts.length === 0;
  const rentalDays = daysBetween(startDate, endDate);
  const validRange = Boolean(startDate && endDate && endDate >= startDate && startDate >= TODAY);
  const hasRequiredDetails = customerName.trim().length > 1 && whatsapp.trim().length > 5;
  const formValid = Boolean(tenant && selectedItem) && hasRequiredDetails && validRange;

  const selectItem = (item: PublicStoreItem, scrollDetail = false) => {
    setSelectedItemId(item.id);
    setError("");
    setSuccess("");
    if (scrollDetail) document.getElementById("item-detail")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const selectCalendarStart = (date: string) => {
    setStartDate(date);
    setEndDate(addDays(date, 2));
    if (!eventDate || eventDate < date) setEventDate(addDays(date, 1));
    setError("");
    setSuccess("");
  };

  const submit = async () => {
    if (sending) return;
    setError("");
    setSuccess("");
    if (!tenant || !selectedItem) return;
    setSending(true);
    try {
      const request = await createPublicBookingRequest({
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
      setSuccess(`Request ${request.id} terkirim. ${tenant.name} akan review dan confirm manual lewat WhatsApp.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send booking request.");
    } finally {
      setSending(false);
    }
  };

  const handleMobileAction = () => {
    if (formValid) {
      submit();
      return;
    }
    document.getElementById("request-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-page px-5 py-10">
        <div className={`mx-auto max-w-xl ${cardCls} p-6 text-sm text-ink-2`}>Memuat halaman booking...</div>
      </main>
    );
  }

  if (!tenant) {
    return (
      <main className="min-h-screen bg-page px-5 py-10">
        <div className={`mx-auto max-w-xl ${cardCls} p-6`}>
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-critical/10 text-critical">
            <AlertTriangle size={18} />
          </div>
          <h1 className="mt-4 text-xl font-semibold tracking-tight">Booking page not found</h1>
          <p className="mt-1 text-sm text-ink-2">This shop subdomain is not active in RENTIE.</p>
          <Link
            href="/"
            className="mt-5 inline-flex rounded-full bg-brand-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-800"
          >
            Back to RENTIE
          </Link>
        </div>
      </main>
    );
  }

  const selectedTags = selectedItem ? itemTags(selectedItem) : [];

  return (
    <main className="min-h-screen bg-page pb-28 text-ink lg:pb-10">
      <header className="sticky top-0 z-10 border-b border-black/5 bg-white/80 backdrop-blur-lg">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <StoreMark tenantName={tenant.name} />
          <div className="flex items-center gap-2">
            <a
              href={waLink(tenant.whatsapp, selectedItem)}
              target="_blank"
              rel="noreferrer"
              className="hidden items-center gap-1.5 rounded-full border border-black/10 bg-white px-3.5 py-2 text-sm font-medium transition hover:bg-brand-50 sm:inline-flex"
            >
              <MessageCircle size={15} />
              Admin
            </a>
            <label className="relative hidden w-64 md:block">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Cari koleksi"
                className="w-full rounded-full border border-black/10 bg-white py-2 pl-9 pr-3 text-sm outline-none placeholder:text-ink-3 focus:border-brand-400"
              />
            </label>
            <button
              type="button"
              onClick={() => document.getElementById("catalog-search")?.focus()}
              aria-label="Cari koleksi"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-black/10 bg-white text-ink-2 transition hover:bg-brand-50 md:hidden"
            >
              <Search size={16} />
            </button>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-success/30 bg-success/10 px-3.5 py-1.5 text-sm font-medium text-good-text">
          <CheckCircle2 size={15} className="shrink-0" />
          <span>Ketersediaan tersinkron dan terbaru</span>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_410px]">
          <div className="min-w-0">
            <div className="flex flex-col gap-3 border-b border-hairline pb-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="grid grid-cols-2 gap-2 sm:flex">
                <label className="col-span-2 relative sm:w-64 md:hidden">
                  <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3" />
                  <input
                    id="catalog-search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Cari nama, kode, warna"
                    className="w-full rounded-full border border-black/10 bg-white py-2 pl-9 pr-3 text-sm outline-none placeholder:text-ink-3 focus:border-brand-400"
                  />
                </label>
                <label className="relative">
                  <span className="pointer-events-none absolute left-3.5 top-1/2 flex -translate-y-1/2 items-center gap-1.5 text-sm font-medium text-ink-2">
                    <SlidersHorizontal size={15} /> Filter
                  </span>
                  <select
                    value={filterMode}
                    onChange={(event) => setFilterMode(event.target.value as FilterMode)}
                    className="w-full appearance-none rounded-full border border-black/10 bg-white py-2 pl-[4.75rem] pr-8 text-sm font-medium text-transparent outline-none focus:border-brand-400 sm:w-40"
                    aria-label="Filter katalog"
                  >
                    <option value="all">Semua</option>
                    <option value="available">Tersedia</option>
                    <option value="busy">Terbooking</option>
                  </select>
                  <ChevronDown size={14} className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-ink-3" />
                </label>
                <label className="relative">
                  <span className="pointer-events-none absolute left-3.5 top-1/2 flex -translate-y-1/2 items-center gap-1.5 text-sm font-medium text-ink-2">
                    <ArrowUpDown size={15} /> Urut
                  </span>
                  <select
                    value={sortMode}
                    onChange={(event) => setSortMode(event.target.value as SortMode)}
                    className="w-full appearance-none rounded-full border border-black/10 bg-white py-2 pl-[4.25rem] pr-8 text-sm font-medium text-transparent outline-none focus:border-brand-400 sm:w-40"
                    aria-label="Urutkan katalog"
                  >
                    <option value="default">Default</option>
                    <option value="price-low">Harga rendah</option>
                    <option value="price-high">Harga tinggi</option>
                    <option value="name">Nama</option>
                  </select>
                  <ChevronDown size={14} className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-ink-3" />
                </label>
              </div>

              <div className="flex w-full items-center justify-between gap-4 xl:w-auto">
                <p className="text-sm text-ink-2">
                  <span className="font-medium text-ink">{filteredItems.length}</span> koleksi
                </p>
                <div className="flex overflow-hidden rounded-full border border-black/10">
                  <button
                    type="button"
                    aria-label="Grid nyaman"
                    onClick={() => setDensity("comfortable")}
                    className={`flex h-9 w-10 items-center justify-center transition ${density === "comfortable" ? "bg-brand-900 text-white" : "bg-white text-ink-2 hover:bg-brand-50"}`}
                  >
                    <Grid2X2 size={16} />
                  </button>
                  <button
                    type="button"
                    aria-label="Grid rapat"
                    onClick={() => setDensity("dense")}
                    className={`flex h-9 w-10 items-center justify-center transition ${density === "dense" ? "bg-brand-900 text-white" : "bg-white text-ink-2 hover:bg-brand-50"}`}
                  >
                    <Grid3X3 size={16} />
                  </button>
                </div>
              </div>
            </div>

            <div className={`mt-5 grid gap-4 ${density === "dense" ? "grid-cols-2 xl:grid-cols-3" : "grid-cols-1 sm:grid-cols-2"}`}>
              {filteredItems.map((item) => (
                <ProductCard
                  key={item.id}
                  item={item}
                  available={availabilityByItem.get(item.id) ?? true}
                  selected={selectedItem?.id === item.id}
                  density={density}
                  onSelect={() => selectItem(item, true)}
                />
              ))}
            </div>

            {filteredItems.length === 0 && (
              <div className={`mt-5 ${cardCls} p-8 text-center text-sm text-ink-2`}>
                Tidak ada koleksi yang cocok dengan pencarian ini.
              </div>
            )}
          </div>

          <aside id="item-detail" className="scroll-mt-5 lg:sticky lg:top-5 lg:self-start">
            <div className={`overflow-hidden ${cardCls}`}>
              {selectedItem ? (
                <>
                  <div className="relative bg-page">
                    <ProductImage item={selectedItem} className="aspect-[4/5] w-full" />
                    <button
                      type="button"
                      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                      className="absolute left-3 top-3 flex items-center gap-1 rounded-full border border-black/5 bg-white/90 px-3 py-1.5 text-xs font-medium shadow-sm backdrop-blur-sm transition hover:bg-white"
                    >
                      <ChevronLeft size={14} />
                      Katalog
                    </button>
                    <div className="absolute bottom-3 right-3 rounded-full bg-ink/55 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur-sm">
                      Geser bawah untuk detail
                    </div>
                  </div>
                  <div className="space-y-4 p-5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded bg-page px-1.5 py-0.5 text-xs font-medium text-ink-2">
                        {selectedItem.inventoryCode}
                      </span>
                      <AvailabilityPill available={selectedAvailable} />
                    </div>
                    <div>
                      <h1 className="text-2xl font-semibold leading-tight tracking-tight">{selectedItem.name}</h1>
                      <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                        <span className="text-2xl font-semibold tabular-nums">{formatIDR(selectedItem.rentalPrice)}</span>
                        <span className="text-sm text-ink-3">/{rentalDays || 3} hari</span>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {[selectedItem.model, selectedItem.color, `Fit ${selectedItem.sizeLabel}`, ...selectedTags].map((tag) => (
                        <span key={tag} className="rounded-full border border-hairline bg-page px-2.5 py-1 text-xs text-ink-2">
                          {tag}
                        </span>
                      ))}
                    </div>
                    <p className="text-sm leading-6 text-ink-2">
                      Request ini belum confirmed. Admin akan cek kondisi item, jadwal fitting, dan deposit sebelum mengunci booking.
                    </p>
                    {!selectedAvailable && (
                      <div className="rounded-xl border border-critical/20 bg-critical/5 px-3 py-2.5 text-sm leading-6 text-critical">
                        <div className="mb-0.5 flex items-center gap-1.5 font-medium">
                          <AlertTriangle size={15} />
                          Tanggal bentrok
                        </div>
                        Item ini sudah terbooking pada {formatDate(selectedConflicts[0].startDate)} - {formatDate(selectedConflicts[0].endDate)}.
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="p-6 text-sm text-ink-2">Pilih satu koleksi untuk melihat detail.</div>
              )}
            </div>
          </aside>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_410px]">
          <AvailabilityCalendar
            item={selectedItem}
            busy={busy}
            month={calendarMonth}
            year={calendarYear}
            selectedStart={startDate}
            selectedEnd={endDate}
            onMonthChange={setCalendarMonth}
            onYearChange={setCalendarYear}
            onSelectStart={selectCalendarStart}
          />

          <section id="request-form" className={`scroll-mt-5 ${cardCls} p-5 sm:p-6`}>
            <h2 className="text-lg font-semibold tracking-tight">Kirim request booking</h2>
            <p className="mt-1 text-sm leading-6 text-ink-2">Isi kontak agar admin bisa review dan confirm manual lewat WhatsApp.</p>

            <div className="mt-4 rounded-xl border border-hairline bg-page p-4">
              <div className="text-xs font-medium text-ink-3">Harga sewa</div>
              <div className="mt-0.5 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <span className="text-2xl font-semibold tabular-nums">{selectedItem ? formatIDR(selectedItem.rentalPrice) : "-"}</span>
                <span className="text-sm text-ink-3">/{rentalDays || 3} hari</span>
              </div>
              <div className="mt-2 text-sm text-ink-2">
                Deposit booking: <span className="font-medium text-ink">{formatIDR(tenant.bookingDepositAmount)}</span>
              </div>
            </div>

            {(success || error) && (
              <div
                className={`mt-4 flex items-start gap-2 rounded-xl border px-3 py-2.5 text-sm ${
                  error ? "border-critical/20 bg-critical/5 text-critical" : "border-success/30 bg-success/10 text-good-text"
                }`}
              >
                {error ? <AlertTriangle size={15} className="mt-0.5 shrink-0" /> : <Check size={15} className="mt-0.5 shrink-0" />}
                <span>{error || success}</span>
              </div>
            )}

            <div className="mt-4 grid gap-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <label>
                  <span className={labelCls}>Pickup</span>
                  <input type="date" className={inputCls} value={startDate} onChange={(event) => selectCalendarStart(event.target.value)} />
                </label>
                <label>
                  <span className={labelCls}>Return</span>
                  <input type="date" className={inputCls} value={endDate} onChange={(event) => setEndDate(event.target.value)} />
                </label>
              </div>
              {!validRange && (
                <p className="flex items-center gap-1.5 text-xs font-medium text-critical">
                  <CalendarDays size={13} />
                  Pilih rentang tanggal di masa depan.
                </p>
              )}
              <label>
                <span className={labelCls}>Tanggal acara</span>
                <input type="date" className={inputCls} value={eventDate} onChange={(event) => setEventDate(event.target.value)} />
              </label>
              <label>
                <span className={labelCls}>Nama</span>
                <input className={inputCls} value={customerName} onChange={(event) => setCustomerName(event.target.value)} />
              </label>
              <label>
                <span className={labelCls}>WhatsApp</span>
                <input className={inputCls} value={whatsapp} onChange={(event) => setWhatsapp(event.target.value)} placeholder="+62" />
              </label>
              <label>
                <span className={labelCls}>Acara</span>
                <input className={inputCls} value={eventType} onChange={(event) => setEventType(event.target.value)} placeholder="Lamaran, wisuda..." />
              </label>
              <label>
                <span className={labelCls}>Catatan</span>
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  className={`${inputCls} min-h-24 resize-none`}
                  placeholder="Jam ambil, fitting, atau pertanyaan"
                />
              </label>
            </div>

            <button
              type="button"
              disabled={!formValid || sending}
              onClick={submit}
              className="mt-5 hidden w-full rounded-full bg-brand-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-800 disabled:cursor-not-allowed disabled:bg-brand-200 lg:block"
            >
              {sending ? "Mengirim..." : "Kirim request"}
            </button>
            <a
              href={waLink(tenant.whatsapp, selectedItem)}
              target="_blank"
              rel="noreferrer"
              className="mt-2 hidden w-full items-center justify-center gap-2 rounded-full border border-hairline bg-white px-4 py-2.5 text-sm font-semibold transition hover:bg-brand-50 lg:flex"
            >
              <MessageCircle size={15} />
              WhatsApp admin
            </a>
          </section>
        </div>
      </section>

      <div
        className={`fixed inset-x-0 bottom-0 z-30 border-t border-black/5 bg-white/90 px-4 py-3 shadow-[0_-12px_30px_-16px_rgba(19,26,51,0.25)] backdrop-blur-lg transition-transform duration-200 lg:hidden ${
          mobileCtaVisible ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <div className="mx-auto flex max-w-7xl items-center gap-2">
          <div className="min-w-0 flex-1">
            <div className="text-[11px] text-ink-3">Harga sewa</div>
            <div className="truncate text-base font-semibold tabular-nums">
              {selectedItem ? formatIDR(selectedItem.rentalPrice) : "Pilih koleksi"}
            </div>
          </div>
          <button
            type="button"
            disabled={!selectedItem || !validRange || sending}
            onClick={handleMobileAction}
            className="shrink-0 rounded-full bg-brand-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-800 disabled:cursor-not-allowed disabled:bg-brand-200"
          >
            Cek tanggal
          </button>
          <a
            href={waLink(tenant.whatsapp, selectedItem)}
            target="_blank"
            rel="noreferrer"
            className="flex shrink-0 items-center gap-1.5 rounded-full border border-hairline bg-white px-4 py-2.5 text-sm font-semibold transition hover:bg-brand-50"
          >
            <MessageCircle size={15} />
            WA
          </a>
        </div>
      </div>
    </main>
  );
}
