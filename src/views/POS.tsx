"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  ClipboardCheck,
  FileText,
  History,
  ImagePlus,
  Minus,
  Plus,
  Printer,
  QrCode,
  Search,
  Shirt,
  Sparkles,
} from "lucide-react";
import { Card, ItemStatusBadge, PageHeader, Th, Td } from "../components/Ui";
import { useTenant, type TransactionReceipt } from "../data/store";
import {
  TODAY,
  formatDate,
  formatIDR,
  type Booking,
  type Customer,
  type KebayaItem,
  type PaymentMethod,
  type Tenant,
  type Transaction,
  type TransactionType,
} from "../data/mock";
import { rulesForTenant } from "../data/plans";

const METHODS: PaymentMethod[] = ["QRIS", "GoPay", "OVO", "DANA", "Cash", "Card"];
const BASE_RENT_DAYS = 3;
const EXTRA_DAY_FEE = 100000;
const DEFAULT_DEPOSIT = 100000;

type Mode = "open" | "close" | "clean" | "history";

const PAY_STATUS_STYLE: Record<string, string> = {
  paid: "bg-success/10 text-success ring-success/30",
  partial: "bg-warning/20 text-gold-600 ring-warning/50",
  pending: "bg-error/10 text-error ring-error/40",
  refunded: "bg-brand-100 text-ink-2 ring-hairline",
};

const labelCls = "mb-1 block text-xs font-medium text-ink-2";
const inputCls =
  "w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-brand-400";

function addDays(iso: string, days: number): string {
  const [year, month, day] = iso.split("-").map(Number);
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

function escapeHtml(value: string | undefined): string {
  return (value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function Thumb({ item, size = "default" }: { item: KebayaItem; size?: "default" | "large" }) {
  const frameClass =
    size === "large"
      ? "h-20 w-16 rounded-lg"
      : "h-12 w-10 rounded-md";

  if (item.photos[0]) {
    return <img src={item.photos[0]} alt="" className={`${frameClass} shrink-0 object-cover`} />;
  }
  return <div className={`flex ${frameClass} shrink-0 items-center justify-center bg-brand-100 text-xs`}>KB</div>;
}

function MethodPicker({ value, onChange }: { value: PaymentMethod; onChange: (method: PaymentMethod) => void }) {
  return (
    <div className="grid grid-cols-3 gap-1.5">
      {METHODS.map((method) => (
        <button
          key={method}
          type="button"
          onClick={() => onChange(method)}
          className={`rounded-full border px-2 py-1.5 text-xs font-medium transition-colors ${
            value === method
              ? "border-brand-900 bg-brand-900 text-white"
              : "border-hairline bg-surface hover:bg-brand-50"
          }`}
        >
          {method}
        </button>
      ))}
    </div>
  );
}

function ConfirmModal({
  title,
  confirmLabel,
  children,
  confirmDisabled = false,
  busy = false,
  onCancel,
  onConfirm,
}: {
  title: string;
  confirmLabel: string;
  children: React.ReactNode;
  confirmDisabled?: boolean;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
}) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-ink/40 p-4">
      <Card className="w-full max-w-md p-5 shadow-xl">
        <h3 className="text-lg font-semibold">{title}</h3>
        <div className="mt-3 text-sm text-ink-2">{children}</div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-full border border-black/10 px-4 py-2 text-sm font-medium hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={confirmDisabled || busy}
            className="rounded-full bg-brand-900 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:bg-brand-200"
          >
            {confirmLabel}
          </button>
        </div>
      </Card>
    </div>
  );
}

function StaticQrisPlaceholder({ amount }: { amount: number }) {
  const cells = Array.from({ length: 169 }, (_, index) => {
    const row = Math.floor(index / 13);
    const col = index % 13;
    const inTopLeft = row < 4 && col < 4;
    const inTopRight = row < 4 && col > 8;
    const inBottomLeft = row > 8 && col < 4;
    const finder = inTopLeft || inTopRight || inBottomLeft;
    const finderCore =
      finder &&
      ((row % 9 === 0 || row % 9 === 3 || col % 9 === 0 || col % 9 === 3) ||
        (row % 9 === 1 && col % 9 === 1) ||
        (row % 9 === 2 && col % 9 === 2));
    const data = (row * 7 + col * 5 + row * col) % 4 === 0 || (row + col) % 7 === 0;
    return finder ? finderCore : data;
  });

  return (
    <div className="rounded-xl border border-hairline bg-white p-3 text-ink">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-3">
            <QrCode size={13} /> Static QRIS
          </div>
          <div className="mt-1 text-lg font-semibold tabular-nums">{formatIDR(amount)}</div>
        </div>
        <span className="rounded-md bg-warning/20 px-2 py-1 text-[11px] font-medium text-gold-600 ring-1 ring-warning/50">
          Placeholder
        </span>
      </div>
      <div className="mx-auto mt-3 grid aspect-square w-44 grid-cols-[repeat(13,minmax(0,1fr))] gap-0.5 rounded-lg bg-white p-2 ring-1 ring-hairline">
        {cells.map((active, index) => (
          <span key={index} className={active ? "bg-ink" : "bg-transparent"} />
        ))}
      </div>
      <p className="mt-3 text-xs leading-relaxed text-ink-2">
        Use this static QRIS placeholder for now. Confirm payment only after the cashier verifies the QRIS payment
        succeeded in the merchant app or bank notification.
      </p>
    </div>
  );
}

function PaymentConfirmationPanel({
  method,
  amount,
  checked,
  onCheckedChange,
}: {
  method: PaymentMethod;
  amount: number;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  const isQris = method === "QRIS";

  return (
    <div className="mt-4 space-y-3">
      {isQris ? (
        <StaticQrisPlaceholder amount={amount} />
      ) : (
        <div className="rounded-xl border border-hairline bg-page p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-ink-3">Manual payment</div>
              <div className="mt-1 text-sm font-semibold text-ink">{method}</div>
            </div>
            <div className="text-right text-base font-semibold tabular-nums text-ink">{formatIDR(amount)}</div>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-ink-2">
            Collect the payment using the selected method, then confirm after cash is received, card is approved,
            or wallet transfer is visible.
          </p>
        </div>
      )}

      <label className="flex items-start gap-2 rounded-lg border border-hairline bg-surface p-3 text-sm text-ink">
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => onCheckedChange(event.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-hairline accent-brand-700"
        />
        <span>
          Payment success confirmed by cashier.
          <span className="mt-0.5 block text-xs text-ink-3">
            The transaction can be created only after this confirmation.
          </span>
        </span>
      </label>
    </div>
  );
}

function receiptHtml(receipt: TransactionReceipt): string {
  const isClose = receipt.transaction.transactionType === "close";
  const planRules = rulesForTenant(receipt.tenant);
  const brandLine = planRules.customReceiptBranding
    ? receipt.tenant.logoUrl
      ? `<img class="logo" src="${escapeHtml(receipt.tenant.logoUrl)}" alt="${escapeHtml(receipt.tenant.name)} logo" />`
      : `<p class="brand-note">${escapeHtml(receipt.tenant.name)} receipt</p>`
    : `<p class="brand-note">Powered by RENTIE</p>`;
  const rows = receipt.items
    .map((item) => `<tr><td>${escapeHtml(item.name)}<br><small>${escapeHtml(item.qrCode)}</small></td><td>${formatIDR(item.rentalPrice)}</td></tr>`)
    .join("");
  const evidence = receipt.transaction.evidence;

  return `<!doctype html>
<html>
  <head>
    <title>${isClose ? "Return" : "Rental"} Receipt ${escapeHtml(receipt.transaction.id)}</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 24px; color: #111; }
      h1 { font-size: 18px; margin: 0 0 4px; }
      h2 { font-size: 13px; margin: 18px 0 8px; border-top: 1px solid #ddd; padding-top: 12px; }
      p { margin: 3px 0; font-size: 12px; }
      table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 12px; }
      td { border-bottom: 1px solid #e5e5e5; padding: 7px 0; vertical-align: top; }
      td:last-child { text-align: right; white-space: nowrap; }
      .total { font-size: 15px; font-weight: 700; }
      .brand-note { margin-top: 18px; border-top: 1px solid #ddd; padding-top: 12px; color: #555; }
      .logo { display: block; max-height: 44px; max-width: 160px; margin-top: 18px; border-top: 1px solid #ddd; padding-top: 12px; }
      small { color: #555; }
      @media print { button { display: none; } body { margin: 0; } }
    </style>
  </head>
  <body>
    <button onclick="window.print()">Print</button>
    <h1>${escapeHtml(receipt.tenant.name)}</h1>
    <p>${escapeHtml(receipt.tenant.location)}</p>
    <p>${isClose ? "Close Transaction" : "Open Transaction"} · ${escapeHtml(receipt.transaction.id)}</p>
    <p>Cashier: ${escapeHtml(receipt.cashierName)} · Date: ${formatDate(receipt.transaction.date)}</p>

    <h2>Customer</h2>
    <p>${escapeHtml(receipt.customer.name)} · ${escapeHtml(receipt.customer.whatsapp)}</p>
    <p>Rental: ${formatDate(receipt.booking.startDate)} - ${formatDate(receipt.booking.endDate)}</p>

    <h2>Items</h2>
    <table>${rows}</table>

    <h2>Summary</h2>
    <table>
      <tr><td>Base rental</td><td>${formatIDR(receipt.transaction.baseRental ?? receipt.booking.total)}</td></tr>
      ${receipt.transaction.extraDayFee ? `<tr><td>Extra day fee</td><td>${formatIDR(receipt.transaction.extraDayFee)}</td></tr>` : ""}
      <tr><td>Rental total</td><td>${formatIDR(receipt.transaction.rentalTotal ?? receipt.booking.total)}</td></tr>
      <tr><td>Jaminan</td><td>${formatIDR(receipt.transaction.deposit)}</td></tr>
      ${isClose ? `<tr><td>Late fee</td><td>${formatIDR(receipt.transaction.lateFee)}</td></tr>` : ""}
      ${isClose ? `<tr><td>Damage fee</td><td>${formatIDR(receipt.transaction.damageFee)}</td></tr>` : ""}
      ${isClose ? `<tr><td>Jaminan returned</td><td>${formatIDR(receipt.transaction.depositReturned ?? 0)}</td></tr>` : ""}
      <tr><td class="total">${isClose ? "Amount due" : "Due today"}</td><td class="total">${formatIDR(isClose ? receipt.transaction.amountDue ?? 0 : receipt.transaction.total)}</td></tr>
    </table>

    ${receipt.transaction.notes ? `<h2>Special Notes</h2><p>${escapeHtml(receipt.transaction.notes)}</p>` : ""}
    ${receipt.transaction.returnNotes ? `<h2>Return Notes</h2><p>${escapeHtml(receipt.transaction.returnNotes)}</p>` : ""}
    ${evidence?.idPhotoName || evidence?.clientPhotoName ? `<h2>Evidence</h2><p>ID: ${escapeHtml(evidence.idPhotoName || "-")}</p><p>Client: ${escapeHtml(evidence.clientPhotoName || "-")}</p>` : ""}
    ${brandLine}
  </body>
</html>`;
}

function printReceipt(receipt: TransactionReceipt) {
  const popup = window.open("", "_blank", "width=420,height=720");
  if (!popup) return;
  popup.document.write(receiptHtml(receipt));
  popup.document.close();
  popup.focus();
}

function ReceiptModal({ receipt, onClose }: { receipt: TransactionReceipt; onClose: () => void }) {
  const isClose = receipt.transaction.transactionType === "close";
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-ink/40 p-4">
      <Card className="max-h-full w-full max-w-lg overflow-y-auto p-5 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold">{isClose ? "Close receipt ready" : "Open receipt ready"}</h3>
            <p className="mt-1 text-sm text-ink-2">{receipt.transaction.id} · {receipt.customer.name}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-black/10 px-3 py-1.5 text-sm font-medium hover:bg-black/5"
          >
            Close
          </button>
        </div>

        <div className="mt-4 rounded-lg border border-hairline bg-page p-4 text-sm">
          <div className="font-semibold">{receipt.tenant.name}</div>
          <div className="mt-1 text-xs text-ink-2">{formatDate(receipt.booking.startDate)} - {formatDate(receipt.booking.endDate)}</div>
          <div className="mt-3 space-y-1.5">
            {receipt.items.map((item) => (
              <div key={item.id} className="flex justify-between gap-3">
                <span className="truncate">{item.name}</span>
                <span className="tabular-nums">{formatIDR(item.rentalPrice)}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 border-t border-hairline pt-3">
            <div className="flex justify-between">
              <span>Rental total</span>
              <span className="tabular-nums">{formatIDR(receipt.transaction.rentalTotal ?? receipt.booking.total)}</span>
            </div>
            <div className="flex justify-between">
              <span>Jaminan</span>
              <span className="tabular-nums">{formatIDR(receipt.transaction.deposit)}</span>
            </div>
            {isClose && (
              <>
                <div className="flex justify-between">
                  <span>Late + damage</span>
                  <span className="tabular-nums">{formatIDR(receipt.transaction.lateFee + receipt.transaction.damageFee)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Jaminan returned</span>
                  <span className="tabular-nums">{formatIDR(receipt.transaction.depositReturned ?? 0)}</span>
                </div>
              </>
            )}
            <div className="mt-2 flex justify-between text-base font-semibold">
              <span>{isClose ? "Amount due" : "Due today"}</span>
              <span className="tabular-nums">{formatIDR(isClose ? receipt.transaction.amountDue ?? 0 : receipt.transaction.total)}</span>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => printReceipt(receipt)}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-brand-900 py-2.5 text-sm font-semibold text-white hover:bg-brand-800"
        >
          <Printer size={15} /> Print receipt
        </button>
      </Card>
    </div>
  );
}

/** Seed transactions predate `transactionType`; deposits are only refunded on close. */
function transactionTypeOf(t: Transaction): TransactionType {
  return t.transactionType ?? (t.paymentStatus === "refunded" ? "close" : "open");
}

/** Rebuilds the receipt shown right after a sale from the persisted Transaction.
    Older/seed records miss denormalized fields, so every lookup needs a fallback —
    the modal must render (possibly sparsely) rather than crash. */
function rebuildReceipt(
  t: Transaction,
  ctx: { tenant: Tenant; bookings: Booking[]; customers: Customer[]; inventory: KebayaItem[] },
): TransactionReceipt {
  const booking = ctx.bookings.find((b) => b.id === t.bookingId);
  const customer = booking ? ctx.customers.find((c) => c.id === booking.customerId) : undefined;
  const itemIds = t.itemIds ?? booking?.itemIds ?? [];
  const items = itemIds
    .map((id) => ctx.inventory.find((item) => item.id === id))
    .filter((item): item is KebayaItem => Boolean(item));
  const type = transactionTypeOf(t);
  const fees = t.lateFee + t.damageFee;
  const transaction: Transaction =
    t.transactionType != null
      ? t
      : {
          ...t,
          transactionType: type,
          ...(type === "close"
            ? {
                depositReturned: t.depositReturned ?? Math.max(0, t.deposit - fees),
                amountDue: t.amountDue ?? Math.max(0, fees - t.deposit),
              }
            : {}),
        };
  return {
    tenant: ctx.tenant,
    transaction,
    items,
    booking: booking ?? {
      id: t.bookingId,
      tenantId: t.tenantId,
      customerId: customer?.id ?? "",
      itemIds,
      startDate: t.date,
      endDate: t.date,
      status: "returned",
      total: t.rentalTotal ?? Math.max(0, t.total - t.deposit),
      deposit: t.deposit,
    },
    customer: customer ?? {
      id: "",
      tenantId: t.tenantId,
      name: t.customerName ?? "Walk-in customer",
      whatsapp: t.customerWhatsapp ?? "—",
      measurements: [],
      totalRentals: 0,
      lastRental: t.date,
    },
    cashierName: t.cashierName ?? "—",
  };
}

function ItemRow({
  item,
  selected,
  disabled,
  hint,
  onClick,
}: {
  item: KebayaItem;
  selected?: boolean;
  disabled?: boolean;
  hint?: string;
  onClick: () => void;
}) {
  return (
    <li className={disabled ? "opacity-60" : ""}>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={`group flex w-full items-center gap-3 py-2.5 text-left transition-colors ${
          disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:bg-brand-50/50"
        }`}
      >
        <span
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition-colors ${
            selected
              ? "border-brand-900 bg-brand-900 text-white"
              : "border-hairline bg-surface group-hover:border-brand-400"
          }`}
        >
          {selected ? <Minus size={14} /> : <Plus size={14} />}
        </span>
        <Thumb item={item} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">
            {item.name} <span className="font-normal text-ink-3">· {item.qrCode} · size {item.sizeLabel}</span>
          </span>
          {hint && (
            <span className="mt-0.5 flex items-center gap-1 text-xs text-critical">
              <AlertTriangle size={12} /> {hint}
            </span>
          )}
        </span>
        <span className="w-24 text-right text-sm tabular-nums">{formatIDR(item.rentalPrice)}</span>
      </button>
    </li>
  );
}

function SelectableKebayaCard({
  item,
  selected,
  eyebrow,
  meta,
  right,
  onClick,
}: {
  item: KebayaItem;
  selected: boolean;
  eyebrow: React.ReactNode;
  meta: string;
  right?: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors ${
        selected
          ? "border-brand-700 bg-brand-50 ring-2 ring-brand-200"
          : "border-hairline bg-surface hover:border-brand-300 hover:bg-brand-50/50"
      }`}
    >
      <Thumb item={item} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate text-sm font-semibold">{item.name}</span>
        </div>
        <div className="mt-1 text-xs text-ink-2">{eyebrow}</div>
        <div className="mt-0.5 truncate text-xs text-ink-2">{meta}</div>
      </div>
      <div className="shrink-0 text-right">
        {right}
        <div className="mt-1 font-mono text-[11px] text-ink-3">{item.qrCode}</div>
      </div>
    </button>
  );
}

export default function POS() {
  const {
    tenant,
    inventory,
    bookings,
    customers,
    transactions,
    customerById,
    conflictsFor,
    openTransaction,
    closeTransaction,
    completeCleaning,
  } = useTenant();

  const [mode, setMode] = useState<Mode>("open");
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [instagram, setInstagram] = useState("");
  const [email, setEmail] = useState("");
  const [startDate, setStartDate] = useState(TODAY);
  const [endDate, setEndDate] = useState(addDays(TODAY, BASE_RENT_DAYS - 1));
  const [deposit, setDeposit] = useState(DEFAULT_DEPOSIT);
  const [method, setMethod] = useState<PaymentMethod>("QRIS");
  const [notes, setNotes] = useState("");
  const [idPhotoName, setIdPhotoName] = useState("");
  const [clientPhotoName, setClientPhotoName] = useState("");

  const [returnItemId, setReturnItemId] = useState("");
  const [returnQuery, setReturnQuery] = useState("");
  const [returnDate, setReturnDate] = useState(TODAY);
  const [returnMethod, setReturnMethod] = useState<PaymentMethod>("Cash");
  const [damageFee, setDamageFee] = useState(0);
  const [returnNotes, setReturnNotes] = useState("");

  const [maintenanceItemId, setMaintenanceItemId] = useState("");
  const [maintenanceQuery, setMaintenanceQuery] = useState("");
  const [cleaningNotes, setCleaningNotes] = useState("");

  const [historyQuery, setHistoryQuery] = useState("");
  const [historyType, setHistoryType] = useState<"all" | TransactionType>("all");

  const [pending, setPending] = useState<Mode | null>(null);
  const [savingMode, setSavingMode] = useState<"open" | null>(null);
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const [receipt, setReceipt] = useState<TransactionReceipt | null>(null);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const validRange = Boolean(startDate && endDate && endDate >= startDate);
  const activeDays = rentalDays(startDate, endDate);
  const extraDays = Math.max(0, activeDays - BASE_RENT_DAYS);

  const availableRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return inventory
      .filter((item) => item.status === "available")
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
  const dueToday = rentalTotal + deposit;
  const hasConflict = availableRows.some((row) => selectedIds.includes(row.item.id) && row.conflicts.length > 0);
  const openValid =
    selectedItems.length > 0 &&
    customerName.trim().length > 1 &&
    whatsapp.trim().length > 5 &&
    validRange &&
    !hasConflict;

  const rentedItems = inventory.filter((item) => item.status === "rented");
  const currentReturnItemId = returnItemId || rentedItems[0]?.id || "";
  const returnBooking = bookings.find(
    (booking) => booking.status === "active" && booking.itemIds.includes(currentReturnItemId),
  );
  const returnItems = returnBooking ? inventory.filter((item) => returnBooking.itemIds.includes(item.id)) : [];
  const returnLateDays = returnBooking ? Math.max(0, dayDiff(returnBooking.endDate, returnDate)) : 0;
  const returnLateFee = returnLateDays * EXTRA_DAY_FEE * Math.max(1, returnItems.length);
  const totalReturnFees = returnLateFee + damageFee;
  const depositReturned = Math.max(0, (returnBooking?.deposit ?? 0) - totalReturnFees);
  const returnAmountDue = Math.max(0, totalReturnFees - (returnBooking?.deposit ?? 0));

  const returnRows = useMemo(() => {
    const q = returnQuery.trim().toLowerCase();
    return rentedItems
      .map((item) => {
        const booking = bookings.find((row) => row.status === "active" && row.itemIds.includes(item.id));
        const customer = booking ? customerById(booking.customerId) : undefined;
        return { item, booking, customer };
      })
      .filter(({ item, booking, customer }) => {
        if (!q) return true;
        return [
          item.name,
          item.qrCode,
          item.inventoryCode,
          item.model,
          item.color,
          booking?.id || "",
          customer?.name || "",
          customer?.whatsapp || "",
        ].some((value) => value.toLowerCase().includes(q));
      });
  }, [bookings, customerById, rentedItems, returnQuery]);

  const maintenanceItems = inventory.filter((item) => item.status === "maintenance");
  const currentMaintenanceItemId = maintenanceItemId || maintenanceItems[0]?.id || "";
  const currentMaintenanceItem = inventory.find((item) => item.id === currentMaintenanceItemId);
  const maintenanceRows = useMemo(() => {
    const q = maintenanceQuery.trim().toLowerCase();
    return maintenanceItems
      .map((item) => {
        const booking = [...bookings]
          .filter((row) => row.itemIds.includes(item.id))
          .sort((a, b) => b.endDate.localeCompare(a.endDate))[0];
        const customer = booking ? customerById(booking.customerId) : undefined;
        return { item, booking, customer };
      })
      .filter(({ item, booking, customer }) => {
        if (!q) return true;
        return [
          item.name,
          item.qrCode,
          item.inventoryCode,
          item.model,
          item.color,
          booking?.id || "",
          customer?.name || "",
          customer?.whatsapp || "",
        ].some((value) => value.toLowerCase().includes(q));
      });
  }, [bookings, customerById, maintenanceItems, maintenanceQuery]);

  const historyRows = useMemo(() => {
    const q = historyQuery.trim().toLowerCase();
    return transactions
      .map((t) => {
        const booking = bookings.find((b) => b.id === t.bookingId);
        const customer = booking ? customers.find((c) => c.id === booking.customerId) : undefined;
        return {
          t,
          customerName: t.customerName ?? customer?.name ?? "—",
          type: transactionTypeOf(t),
        };
      })
      .filter((row) => historyType === "all" || row.type === historyType)
      .filter((row) => {
        if (!q) return true;
        return [row.t.id, row.t.bookingId, row.customerName].some((value) =>
          value.toLowerCase().includes(q),
        );
      });
  }, [bookings, customers, historyQuery, historyType, transactions]);

  const resetMessages = () => {
    setError("");
    setSuccess("");
  };

  const toggleItem = (itemId: string) => {
    resetMessages();
    setSelectedIds((prev) => (prev.includes(itemId) ? prev.filter((id) => id !== itemId) : [...prev, itemId]));
  };

  const handleConfirm = async () => {
    if (!pending || savingMode) return;
    const action = pending;
    if (action === "open") setSavingMode("open");
    try {
      if (action === "open") {
        const nextReceipt = await openTransaction({
          itemIds: selectedIds,
          customerName,
          whatsapp,
          instagram,
          email,
          startDate,
          endDate,
          baseRental,
          extraDayFee,
          rentalTotal,
          deposit,
          method,
          notes,
          evidence: {
            idPhotoName: idPhotoName || undefined,
            clientPhotoName: clientPhotoName || undefined,
          },
        });
        setReceipt(nextReceipt);
        setSelectedIds([]);
        setNotes("");
        setIdPhotoName("");
        setClientPhotoName("");
        setPaymentConfirmed(false);
        setSuccess("Transaction created. Selected item status is now rented.");
      }

      if (action === "close" && returnBooking) {
        const nextReceipt = closeTransaction({
          bookingId: returnBooking.id,
          returnDate,
          lateFee: returnLateFee,
          damageFee,
          method: returnMethod,
          notes: returnNotes,
        });
        setReceipt(nextReceipt);
        setReturnItemId("");
        setDamageFee(0);
        setReturnNotes("");
        setSuccess("Return processed. Item moved to cleaning / maintenance.");
      }

      if (action === "clean" && currentMaintenanceItemId) {
        const item = completeCleaning({ itemId: currentMaintenanceItemId, notes: cleaningNotes });
        setMaintenanceItemId("");
        setCleaningNotes("");
        setSuccess(`${item.name} is now available.`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transaction failed.");
    } finally {
      setSavingMode(null);
      setPending(null);
    }
  };

  return (
    <>
      <PageHeader
        title="Rental POS"
        subtitle="Open rentals, process returns, and release cleaned items back into inventory."
      />

      <div className="mb-4 flex items-center gap-2">
        <div className="grid flex-1 gap-2 sm:grid-cols-3">
          {[
            ["open", "Open transaction", FileText],
            ["close", "Close transaction", ClipboardCheck],
            ["clean", "Make available", Sparkles],
          ].map(([key, label, Icon]) => (
            <button
              key={key as string}
              type="button"
              onClick={() => {
                resetMessages();
                setMode(key as Mode);
              }}
              className={`flex items-center justify-center gap-2 rounded-full border px-4 py-3 text-sm font-semibold transition-colors ${
                mode === key
                  ? "border-brand-900 bg-brand-900 text-white"
                  : "border-hairline bg-surface hover:bg-brand-50"
              }`}
            >
              <Icon size={16} /> {label as string}
            </button>
          ))}
        </div>
        <button
          type="button"
          aria-label="Receipt history"
          title="Receipt history"
          onClick={() => {
            resetMessages();
            setMode("history");
          }}
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border transition-colors ${
            mode === "history"
              ? "border-brand-900 bg-brand-900 text-white"
              : "border-hairline bg-surface hover:bg-brand-50"
          }`}
        >
          <History size={18} />
        </button>
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

      {mode === "open" && (
        <div className="grid gap-4 xl:grid-cols-[minmax(340px,0.95fr)_minmax(360px,1fr)_minmax(300px,0.75fr)]">
          <Card className="p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-sm font-semibold">1 · Pick available kebaya item(s)</h2>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search item or QR"
                  className="w-52 rounded-full border border-black/10 bg-white py-2 pl-8 pr-3 text-sm outline-none focus:border-brand-400"
                />
              </div>
            </div>

            <ul className="divide-y divide-hairline">
              {availableRows.map(({ item, conflicts }) => {
                const blocked = conflicts.length > 0;
                return (
                  <ItemRow
                    key={item.id}
                    item={item}
                    selected={selectedIds.includes(item.id)}
                    disabled={blocked}
                    hint={
                      blocked
                        ? `Booked ${formatDate(conflicts[0].startDate)} - ${formatDate(conflicts[0].endDate)}`
                        : undefined
                    }
                    onClick={() => toggleItem(item.id)}
                  />
                );
              })}
            </ul>
          </Card>

          <Card className="p-5">
              <h2 className="mb-3 text-sm font-semibold">2 · Rental detail</h2>
              <div className="grid gap-3 2xl:grid-cols-2">
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
                  <span className={labelCls}>Tanggal sewa</span>
                  <input type="date" className={inputCls} value={startDate} onChange={(event) => setStartDate(event.target.value)} />
                </label>
                <label>
                  <span className={labelCls}>Tanggal pengembalian</span>
                  <input type="date" className={inputCls} value={endDate} onChange={(event) => setEndDate(event.target.value)} />
                </label>
                <label>
                  <span className={labelCls}>Value jaminan</span>
                  <input
                    type="number"
                    min={0}
                    step={50000}
                    className={`${inputCls} tabular-nums`}
                    value={deposit}
                    onChange={(event) => setDeposit(Number(event.target.value))}
                  />
                </label>
                <div>
                  <span className={labelCls}>Payment method</span>
                  <MethodPicker value={method} onChange={setMethod} />
                </div>
              </div>

              <div className="mt-3 grid gap-3 2xl:grid-cols-2">
                <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-hairline px-3 py-3 text-sm text-ink-2 hover:border-brand-400">
                  <ImagePlus size={16} />
                  <span className="min-w-0 flex-1 truncate">{idPhotoName || "Upload ID photo"}</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => setIdPhotoName(event.target.files?.[0]?.name || "")}
                  />
                </label>
                <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-hairline px-3 py-3 text-sm text-ink-2 hover:border-brand-400">
                  <ImagePlus size={16} />
                  <span className="min-w-0 flex-1 truncate">{clientPhotoName || "Upload client photo"}</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => setClientPhotoName(event.target.files?.[0]?.name || "")}
                  />
                </label>
              </div>

              <label className="mt-3 block">
                <span className={labelCls}>Catatan khusus</span>
                <textarea
                  className={`${inputCls} min-h-24 resize-none`}
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Alteration request, pickup note, damage before rental..."
                />
              </label>
          </Card>

          <Card className="p-5">
              <h2 className="mb-3 text-sm font-semibold">3 · Transaction summary</h2>
              {selectedItems.length === 0 ? (
                <p className="rounded-lg bg-page p-3 text-sm text-ink-2">No kebaya selected yet.</p>
              ) : (
                <ul className="mb-3 divide-y divide-hairline rounded-xl border border-hairline">
                  {selectedItems.map((item) => (
                    <li key={item.id} className="flex items-center gap-4 p-3 text-sm">
                      <Thumb item={item} size="large" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">{item.name}</div>
                        <div className="mt-0.5 truncate text-xs text-ink-3">
                          {item.qrCode} · size {item.sizeLabel}
                        </div>
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
                  <span>Rental days</span>
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
                  <span>Jaminan</span>
                  <span className="tabular-nums">{formatIDR(deposit)}</span>
                </div>
                <div className="flex justify-between border-t border-hairline pt-2 text-base font-semibold">
                  <span>Due today</span>
                  <span className="tabular-nums">{formatIDR(dueToday)}</span>
                </div>
              </div>
              {!validRange && <p className="mt-3 text-xs font-medium text-critical">Tanggal pengembalian harus setelah tanggal sewa.</p>}
              <button
                type="button"
                disabled={!openValid || savingMode === "open"}
                onClick={() => {
                  resetMessages();
                  setPaymentConfirmed(false);
                  setPending("open");
                }}
                className="mt-4 w-full rounded-full bg-brand-900 py-2.5 text-sm font-semibold text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:bg-brand-200"
              >
                {savingMode === "open" ? "Creating..." : "Create Transaction"}
              </button>
          </Card>
        </div>
      )}

      {mode === "close" && (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(420px,0.9fr)]">
          <Card className="p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-sm font-semibold">1 · Select rented item</h2>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
                <input
                  value={returnQuery}
                  onChange={(event) => setReturnQuery(event.target.value)}
                  placeholder="Search rented item"
                  className="w-56 rounded-full border border-black/10 bg-white py-2 pl-8 pr-3 text-sm outline-none focus:border-brand-400"
                />
              </div>
            </div>

            {rentedItems.length ? (
              <div className="grid gap-2">
                {returnRows.map(({ item, booking, customer }) => (
                  <SelectableKebayaCard
                    key={item.id}
                    item={item}
                    selected={item.id === currentReturnItemId}
                    eyebrow={customer ? `${customer.name} · ${customer.whatsapp}` : "No active rental record"}
                    meta={
                      booking
                        ? `${formatDate(booking.startDate)} - ${formatDate(booking.endDate)} · ${booking.id}`
                        : "Needs booking reconciliation before return"
                    }
                    right={
                      <div className="space-y-1">
                        <ItemStatusBadge status="rented" />
                        {booking && booking.itemIds.length > 1 && (
                          <div className="text-[11px] font-medium text-ink-3">{booking.itemIds.length} items</div>
                        )}
                      </div>
                    }
                    onClick={() => {
                      resetMessages();
                      setReturnItemId(item.id);
                    }}
                  />
                ))}
                {returnRows.length === 0 && (
                  <p className="rounded-lg bg-page p-3 text-sm text-ink-2">No rented item matches this search.</p>
                )}
              </div>
            ) : (
              <p className="rounded-lg bg-page p-3 text-sm text-ink-2">No item is currently rented.</p>
            )}
          </Card>

          <div className="space-y-4">
            <Card className="p-5">
              <h2 className="mb-3 text-sm font-semibold">2 · Return detail</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <label>
                  <span className={labelCls}>Actual return date</span>
                  <input type="date" className={inputCls} value={returnDate} onChange={(event) => setReturnDate(event.target.value)} />
                </label>
                <label>
                  <span className={labelCls}>Late fee</span>
                  <input className={`${inputCls} tabular-nums`} value={formatIDR(returnLateFee)} readOnly />
                </label>
                <label>
                  <span className={labelCls}>Damage / cleaning charge</span>
                  <input
                    type="number"
                    min={0}
                    step={50000}
                    className={`${inputCls} tabular-nums`}
                    value={damageFee}
                    onChange={(event) => setDamageFee(Number(event.target.value))}
                  />
                </label>
                <div>
                  <span className={labelCls}>Payment method for extra charge</span>
                  <MethodPicker value={returnMethod} onChange={setReturnMethod} />
                </div>
              </div>

              {returnBooking ? (
                <div className="mt-4 rounded-xl border border-hairline bg-page p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold">{customerById(returnBooking.customerId).name}</div>
                      <div className="mt-0.5 text-xs text-ink-2">
                        {formatDate(returnBooking.startDate)} - {formatDate(returnBooking.endDate)} · {returnBooking.id}
                      </div>
                    </div>
                    <ItemStatusBadge status="rented" />
                  </div>
                  <ul className="mt-3 divide-y divide-hairline">
                    {returnItems.map((item) => (
                      <li key={item.id} className="flex items-center gap-3 py-2">
                        <Thumb item={item} />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium">{item.name}</div>
                          <div className="text-xs text-ink-3">{item.qrCode}</div>
                        </div>
                        <span className="text-sm tabular-nums">{formatIDR(item.rentalPrice)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="mt-4 rounded-lg bg-page p-3 text-sm text-ink-2">No active booking found for this rented item.</p>
              )}

              <label className="mt-3 block">
                <span className={labelCls}>Catatan pengembalian</span>
                <textarea
                  className={`${inputCls} min-h-24 resize-none`}
                  value={returnNotes}
                  onChange={(event) => setReturnNotes(event.target.value)}
                  placeholder="Returned condition, missing parts, stains, deposit decision..."
                />
              </label>
            </Card>

            <Card className="p-5">
              <h2 className="mb-3 text-sm font-semibold">3 · Close summary</h2>
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between text-ink-2">
                  <span>Rental total</span>
                  <span className="tabular-nums">{formatIDR(returnBooking?.total ?? 0)}</span>
                </div>
                <div className="flex justify-between text-ink-2">
                  <span>Jaminan held</span>
                  <span className="tabular-nums">{formatIDR(returnBooking?.deposit ?? 0)}</span>
                </div>
                <div className="flex justify-between text-ink-2">
                  <span>Late days</span>
                  <span className="tabular-nums">{returnLateDays}</span>
                </div>
                <div className="flex justify-between text-critical">
                  <span>Late + damage</span>
                  <span className="tabular-nums">{formatIDR(totalReturnFees)}</span>
                </div>
                <div className="flex justify-between border-t border-hairline pt-2 text-ink-2">
                  <span>Jaminan returned</span>
                  <span className="tabular-nums">{formatIDR(depositReturned)}</span>
                </div>
                <div className="flex justify-between text-base font-semibold">
                  <span>Amount due</span>
                  <span className="tabular-nums">{formatIDR(returnAmountDue)}</span>
                </div>
              </div>
              <button
                type="button"
                disabled={!returnBooking}
                onClick={() => {
                  resetMessages();
                  setPending("close");
                }}
                className="mt-4 w-full rounded-full bg-brand-900 py-2.5 text-sm font-semibold text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:bg-brand-200"
              >
                Proses Pengembalian
              </button>
            </Card>
          </div>
        </div>
      )}

      {mode === "clean" && (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(420px,0.9fr)]">
          <Card className="p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-sm font-semibold">1 · Select cleaning / maintenance item</h2>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
                <input
                  value={maintenanceQuery}
                  onChange={(event) => setMaintenanceQuery(event.target.value)}
                  placeholder="Search cleaning item"
                  className="w-56 rounded-full border border-black/10 bg-white py-2 pl-8 pr-3 text-sm outline-none focus:border-brand-400"
                />
              </div>
            </div>
            {maintenanceItems.length ? (
              <div className="grid gap-2">
                {maintenanceRows.map(({ item, booking, customer }) => (
                  <SelectableKebayaCard
                    key={item.id}
                    item={item}
                    selected={item.id === currentMaintenanceItemId}
                    eyebrow={
                      customer ? (
                        <div className="space-y-0.5">
                          <div className="font-semibold uppercase tracking-wide text-ink-3">Last rented by:</div>
                          <div className="font-medium text-ink">{customer.name}</div>
                          <div className="font-mono text-ink-2">{customer.whatsapp}</div>
                        </div>
                      ) : (
                        <span className="font-medium text-ink-3">No previous rental record</span>
                      )
                    }
                    meta={
                      booking
                        ? `${formatDate(booking.startDate)} - ${formatDate(booking.endDate)} · ${booking.id}`
                        : `${item.model} · ${item.color} · size ${item.sizeLabel}`
                    }
                    right={<ItemStatusBadge status="maintenance" />}
                    onClick={() => {
                      resetMessages();
                      setMaintenanceItemId(item.id);
                    }}
                  />
                ))}
                {maintenanceRows.length === 0 && (
                  <p className="rounded-lg bg-page p-3 text-sm text-ink-2">No cleaning item matches this search.</p>
                )}
              </div>
            ) : (
              <p className="rounded-lg bg-page p-3 text-sm text-ink-2">No item is currently in cleaning / maintenance.</p>
            )}
          </Card>
          <div className="space-y-4">
            <Card className="p-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-100 text-brand-800">
                <Shirt size={18} />
              </div>
              <h2 className="mt-3 text-sm font-semibold">Make item available</h2>
              <p className="mt-1 text-sm text-ink-2">This moves the selected kebaya from cleaning / maintenance back to available inventory.</p>
              {currentMaintenanceItem ? (
                <div className="mt-4 rounded-xl border border-hairline bg-page p-3">
                  <div className="flex items-start gap-3">
                    <Thumb item={currentMaintenanceItem} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">{currentMaintenanceItem.name}</div>
                      <div className="mt-0.5 font-mono text-xs text-ink-3">{currentMaintenanceItem.qrCode}</div>
                    </div>
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                    <div>
                      <dt className="text-ink-3">Status</dt>
                      <dd className="mt-0.5"><ItemStatusBadge status={currentMaintenanceItem.status} /></dd>
                    </div>
                    <div>
                      <dt className="text-ink-3">Rental price</dt>
                      <dd className="mt-0.5 font-medium tabular-nums">{formatIDR(currentMaintenanceItem.rentalPrice)}</dd>
                    </div>
                    <div>
                      <dt className="text-ink-3">Model</dt>
                      <dd className="mt-0.5 font-medium">{currentMaintenanceItem.model}</dd>
                    </div>
                    <div>
                      <dt className="text-ink-3">Size</dt>
                      <dd className="mt-0.5 font-medium">{currentMaintenanceItem.sizeLabel}</dd>
                    </div>
                    <div className="col-span-2">
                      <dt className="text-ink-3">Included parts</dt>
                      <dd className="mt-0.5 line-clamp-2 font-medium">{currentMaintenanceItem.includes.join(", ")}</dd>
                    </div>
                  </dl>
                </div>
              ) : (
                <p className="mt-4 rounded-lg bg-page p-3 text-sm text-ink-2">Select an item to review before making it available.</p>
              )}
              <label className="mt-4 block">
                <span className={labelCls}>Catatan pengembalian / cuci</span>
                <textarea
                  className={`${inputCls} min-h-24 resize-none`}
                  value={cleaningNotes}
                  onChange={(event) => setCleaningNotes(event.target.value)}
                  placeholder="Laundry complete, repair finished, missing item resolved..."
                />
              </label>
              <button
                type="button"
                disabled={!currentMaintenanceItemId}
                onClick={() => {
                  resetMessages();
                  setPending("clean");
                }}
                className="mt-4 w-full rounded-full bg-brand-900 py-2.5 text-sm font-semibold text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:bg-brand-200"
              >
                Tandai Selesai Cuci
              </button>
            </Card>
          </div>
        </div>
      )}

      {mode === "history" && (
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline p-5">
            <h2 className="text-sm font-semibold">Receipt history</h2>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 rounded-full border border-hairline bg-surface p-1">
                {(
                  [
                    ["all", "All"],
                    ["open", "Rental"],
                    ["close", "Return"],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setHistoryType(key)}
                    className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                      historyType === key ? "bg-brand-900 text-white" : "text-ink-2 hover:bg-brand-50"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
                <input
                  value={historyQuery}
                  onChange={(event) => setHistoryQuery(event.target.value)}
                  placeholder="Search receipt, booking, customer"
                  className="w-64 rounded-full border border-black/10 bg-white py-2 pl-8 pr-3 text-sm outline-none focus:border-brand-400"
                />
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-hairline bg-page">
                <tr>
                  <Th>Transaction</Th>
                  <Th>Date</Th>
                  <Th>Type</Th>
                  <Th>Customer</Th>
                  <Th className="text-right">Total</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Receipt</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {historyRows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-sm text-ink-3">
                      No receipts match.
                    </td>
                  </tr>
                )}
                {historyRows.map(({ t, customerName: rowCustomerName, type }) => (
                  <tr key={t.id} className="hover:bg-brand-50/40">
                    <Td className="font-medium">{t.id}</Td>
                    <Td className="whitespace-nowrap text-ink-2">{formatDate(t.date)}</Td>
                    <Td>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${
                          type === "close"
                            ? "bg-brand-100 text-ink-2 ring-hairline"
                            : "bg-brand-50 text-brand-900 ring-brand-200"
                        }`}
                      >
                        {type === "close" ? "Return" : "Rental"}
                      </span>
                    </Td>
                    <Td>{rowCustomerName}</Td>
                    <Td className="text-right font-medium tabular-nums">{formatIDR(t.total)}</Td>
                    <Td>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ring-1 ${PAY_STATUS_STYLE[t.paymentStatus]}`}
                      >
                        {t.paymentStatus}
                      </span>
                    </Td>
                    <Td className="text-right">
                      <button
                        type="button"
                        onClick={() => setReceipt(rebuildReceipt(t, { tenant, bookings, customers, inventory }))}
                        className="inline-flex items-center gap-1.5 rounded-full border border-hairline bg-surface px-3 py-1.5 text-xs font-semibold hover:bg-brand-50"
                      >
                        <Printer size={13} /> View receipt
                      </button>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {pending === "open" && (
        <ConfirmModal
          title="Confirm payment first"
          confirmLabel={savingMode === "open" ? "Creating..." : "Create Transaction"}
          confirmDisabled={!paymentConfirmed}
          busy={savingMode === "open"}
          onCancel={() => {
            if (!savingMode) setPending(null);
          }}
          onConfirm={handleConfirm}
        >
          <p>This will mark {selectedItems.length} selected item(s) as rented and generate an open transaction receipt.</p>
          <p className="mt-2 font-semibold text-ink">Due today: {formatIDR(dueToday)}</p>
          <PaymentConfirmationPanel
            method={method}
            amount={dueToday}
            checked={paymentConfirmed}
            onCheckedChange={setPaymentConfirmed}
          />
        </ConfirmModal>
      )}

      {pending === "close" && returnBooking && (
        <ConfirmModal
          title="Process return?"
          confirmLabel="Proses Pengembalian"
          onCancel={() => setPending(null)}
          onConfirm={handleConfirm}
        >
          <p>This will close booking {returnBooking.id} and move all items in this rental to cleaning / maintenance.</p>
          <p className="mt-2 font-semibold text-ink">Jaminan returned: {formatIDR(depositReturned)}</p>
        </ConfirmModal>
      )}

      {pending === "clean" && currentMaintenanceItem && (
        <ConfirmModal
          title="Mark item available?"
          confirmLabel="Tandai Selesai Cuci"
          onCancel={() => setPending(null)}
          onConfirm={handleConfirm}
        >
          <p>{currentMaintenanceItem.name} will become available for the next rental.</p>
        </ConfirmModal>
      )}

      {receipt && <ReceiptModal receipt={receipt} onClose={() => setReceipt(null)} />}
    </>
  );
}
