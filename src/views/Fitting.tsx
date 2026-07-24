"use client";

import { useMemo, useState } from "react";
import { CalendarDays, Ruler, Shirt } from "lucide-react";
import { Card, PageHeader } from "../components/Ui";
import { useTenant } from "../data/store";
import { TODAY, formatDate } from "../data/mock";

const inputCls =
  "w-full rounded-lg border border-black/10 bg-white px-2.5 py-1.5 text-sm outline-none placeholder:text-ink-3 focus:border-brand-400";

/** The pieces going out soon, oldest first — the fitting bench's work queue. */
export default function Fitting() {
  const { bookings, customers, inventory, recordMeasurement } = useTenant();
  const [openId, setOpenId] = useState<string | null>(null);
  const [bust, setBust] = useState("");
  const [waist, setWaist] = useState("");
  const [hip, setHip] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const upcoming = useMemo(
    () =>
      bookings
        .filter((b) => (b.status === "confirmed" || b.status === "active") && b.endDate >= TODAY)
        .sort((a, b) => a.startDate.localeCompare(b.startDate)),
    [bookings],
  );

  const customerById = useMemo(() => new Map(customers.map((c) => [c.id, c])), [customers]);
  const itemById = useMemo(() => new Map(inventory.map((i) => [i.id, i])), [inventory]);

  const openForm = (customerId: string) => {
    setOpenId(openId === customerId ? null : customerId);
    setBust("");
    setWaist("");
    setHip("");
    setError(null);
    setMessage(null);
  };

  const save = async (customerId: string, customerName: string) => {
    if (saving) return;
    setError(null);
    setMessage(null);
    setSaving(true);
    try {
      await recordMeasurement({
        customerId,
        bust: Number(bust),
        waist: Number(waist),
        hip: Number(hip),
      });
      setOpenId(null);
      setMessage(`Measurements saved for ${customerName}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Measurement could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Fitting"
        subtitle="Upcoming pickups and the measurements each customer was last fitted for."
      />

      {(error || message) && (
        <div
          className={`mb-4 rounded-xl px-3 py-2.5 text-sm ${
            error ? "border border-critical/20 bg-critical/5 text-critical" : "bg-success/10 text-good-text"
          }`}
        >
          {error ?? message}
        </div>
      )}

      {upcoming.length === 0 ? (
        <Card className="p-8 text-center">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-brand-700">
            <CalendarDays size={18} />
          </div>
          <p className="mt-3 text-sm font-medium">No fittings scheduled</p>
          <p className="mt-1 text-sm text-ink-3">Confirmed bookings will appear here as their dates approach.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {upcoming.map((booking) => {
            const customer = customerById.get(booking.customerId);
            const latest = customer?.measurements[customer.measurements.length - 1];
            const items = booking.itemIds.map((id) => itemById.get(id)).filter(Boolean);
            const canSave = bust !== "" && waist !== "" && hip !== "" && !saving;

            return (
              <Card key={booking.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{customer?.name ?? "Unknown customer"}</span>
                      <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-700">
                        {booking.status === "active" ? "Out now" : "Confirmed"}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-ink-3">
                      {formatDate(booking.startDate)} – {formatDate(booking.endDate)}
                      {customer?.whatsapp ? ` · ${customer.whatsapp}` : ""}
                    </p>
                    <p className="mt-2 flex flex-wrap items-center gap-1.5 text-sm text-ink-2">
                      <Shirt size={14} className="text-ink-3" />
                      {items.length > 0 ? items.map((i) => i!.name).join(", ") : "No items on this booking"}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-3">Last fitted</p>
                    <p className="mt-0.5 text-sm font-medium tabular-nums">
                      {latest ? `${latest.bust} / ${latest.waist} / ${latest.hip} cm` : "Not recorded"}
                    </p>
                    {latest && <p className="text-[11px] text-ink-3">{formatDate(latest.recordedAt)}</p>}
                    {customer && (
                      <button
                        type="button"
                        onClick={() => openForm(customer.id)}
                        className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-hairline px-2.5 py-1 text-xs font-medium text-ink-2 hover:bg-page"
                      >
                        <Ruler size={13} /> {openId === customer.id ? "Cancel" : "Record fitting"}
                      </button>
                    )}
                  </div>
                </div>

                {customer && openId === customer.id && (
                  <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-hairline pt-3">
                    {([
                      ["Bust", bust, setBust],
                      ["Waist", waist, setWaist],
                      ["Hip", hip, setHip],
                    ] as const).map(([label, value, setter]) => (
                      <div key={label} className="w-24">
                        <label className="mb-1 block text-[11px] font-semibold text-ink-2">{label} (cm)</label>
                        <input
                          type="number"
                          inputMode="numeric"
                          value={value}
                          onChange={(e) => setter(e.target.value)}
                          className={inputCls}
                        />
                      </div>
                    ))}
                    <button
                      type="button"
                      disabled={!canSave}
                      onClick={() => save(customer.id, customer.name)}
                      className="rounded-full bg-brand-900 px-3.5 py-2 text-sm font-medium text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:bg-brand-200"
                    >
                      {saving ? "Saving…" : "Save"}
                    </button>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
