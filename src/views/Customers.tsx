"use client";

import { useState } from "react";
import { AlertTriangle, CalendarHeart, MessageCircle, Ruler, Plus } from "lucide-react";
import { Card, PageHeader, BookingStatusBadge } from "../components/Ui";
import { useTenant } from "../data/store";
import { formatDate, formatIDR, type Customer, type CustomerAccess } from "../data/mock";

function CustomerDetail({ access, customer }: { access: CustomerAccess; customer: Customer }) {
  const { bookings, itemById } = useTenant();
  const history = bookings
    .filter((b) => b.customerId === customer.id)
    .sort((a, b) => b.startDate.localeCompare(a.startDate));
  const latest = customer.measurements[0];
  const canViewHistory = access === "history" || access === "analytics";
  const canViewMeasurements = access === "analytics";

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">{customer.name}</h2>
            <div className="mt-0.5 text-sm text-ink-2">{customer.whatsapp}</div>
          </div>
          <button className="flex items-center gap-1.5 rounded-full bg-success px-3 py-2 text-sm font-medium text-white hover:bg-good-text">
            <MessageCircle size={15} /> WhatsApp
          </button>
        </div>
        {customer.event && (
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-brand-50 px-3 py-2 text-sm">
            <CalendarHeart size={15} className="text-brand-600" />
            <span>
              <span className="font-medium">{customer.event.type}</span>
              <span className="text-ink-2"> on {formatDate(customer.event.date)} — reminder scheduled 7 days before.</span>
            </span>
          </div>
        )}
      </Card>

      {canViewMeasurements ? (
        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <Ruler size={15} className="text-ink-3" /> Measurements
            </h3>
            <button className="flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline">
              <Plus size={13} /> New fitting
            </button>
          </div>
          {latest ? (
            <>
              <div className="grid grid-cols-3 gap-3">
                {[
                  ["Bust", latest.bust],
                  ["Waist", latest.waist],
                  ["Hip", latest.hip],
                ].map(([label, v]) => (
                  <div key={label} className="rounded-lg bg-page px-3 py-2.5 text-center">
                    <div className="text-lg font-semibold tabular-nums">{v} cm</div>
                    <div className="text-xs text-ink-3">{label}</div>
                  </div>
                ))}
              </div>
              <div className="mt-2 text-xs text-ink-3">
                Recorded {formatDate(latest.recordedAt)}
                {customer.measurements.length > 1 &&
                  ` · ${customer.measurements.length - 1} earlier record${customer.measurements.length > 2 ? "s" : ""} kept`}
              </div>
            </>
          ) : (
            <p className="text-sm text-ink-2">No measurements recorded yet.</p>
          )}
        </Card>
      ) : (
        <Card className="p-5">
          <div className="flex items-start gap-2 text-sm text-ink-2">
            <AlertTriangle size={16} className="mt-0.5 shrink-0 text-gold-600" />
            <span>Measurements and customer analytics are available on Pro.</span>
          </div>
        </Card>
      )}

      <Card className="p-5">
        <h3 className="mb-3 text-sm font-semibold">Rental history</h3>
        {!canViewHistory ? (
          <p className="text-sm text-ink-2">Customer history is available on Starter and Pro.</p>
        ) : history.length === 0 ? (
          <p className="text-sm text-ink-2">No rentals yet.</p>
        ) : (
          <ul className="divide-y divide-hairline">
            {history.map((b) => (
              <li key={b.id} className="py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium">
                    {b.itemIds.map((id) => itemById(id).name).join(", ")}
                  </span>
                  <BookingStatusBadge status={b.status} />
                </div>
                <div className="mt-0.5 flex justify-between text-xs text-ink-2">
                  <span>{formatDate(b.startDate)} → {formatDate(b.endDate)}</span>
                  <span className="tabular-nums">{formatIDR(b.total)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

export default function Customers() {
  const { customers, planRules } = useTenant();
  const [selectedId, setSelectedId] = useState(customers[0]?.id ?? "");
  const selected = customers.find((c) => c.id === selectedId) ?? customers[0];

  return (
    <>
      <PageHeader
        title="Customers"
        subtitle="Profiles with measurement history — no repeat customer gets re-measured."
        actions={
          <button className="flex items-center gap-1.5 rounded-full bg-brand-900 px-3.5 py-2 text-sm font-medium text-white hover:bg-brand-800">
            <Plus size={15} /> New customer
          </button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="self-start overflow-hidden">
          {customers.length === 0 ? (
            <p className="p-5 text-sm text-ink-2">No customers yet. Customers are created from POS rentals and bookings.</p>
          ) : (
            <ul className="divide-y divide-hairline">
              {customers.map((c) => (
              <li key={c.id}>
                <button
                  onClick={() => setSelectedId(c.id)}
                  className={`w-full px-4 py-3 text-left transition-colors ${
                    selectedId === c.id ? "bg-brand-50" : "hover:bg-brand-50/50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{c.name}</span>
                    {c.event && <CalendarHeart size={14} className="text-brand-500" />}
                  </div>
                  <div className="mt-0.5 text-xs text-ink-2">
                    {c.totalRentals} rental{c.totalRentals !== 1 ? "s" : ""} · last {formatDate(c.lastRental)}
                  </div>
                </button>
              </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="lg:col-span-2">
          {selected ? (
            <CustomerDetail access={planRules.customers} customer={selected} />
          ) : (
            <Card className="p-8 text-center text-sm text-ink-2">Select a customer to view details.</Card>
          )}
        </div>
      </div>
    </>
  );
}
