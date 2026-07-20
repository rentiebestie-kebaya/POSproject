"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Card, PageHeader, BookingStatusBadge } from "../components/Ui";
import { useTenant } from "../data/store";
import { formatDate, formatIDR, STATUS_LABEL, type ItemStatus } from "../data/mock";

function StatTile({ label, value, delta }: { label: string; value: string; delta?: { text: string; up: boolean } }) {
  return (
    <Card className="px-5 py-4">
      <div className="text-[13px] text-ink-2">{label}</div>
      <div className="mt-1 text-2xl font-semibold tracking-tight">{value}</div>
      {delta && (
        <div className={`mt-1 flex items-center gap-1 text-xs font-medium ${delta.up ? "text-good-text" : "text-critical"}`}>
          {delta.up ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
          {delta.text}
        </div>
      )}
    </Card>
  );
}

/* Revenue by month — single series, so one hue and no legend (title names it). */
function RevenueChart({ data }: { data: { month: string; revenue: number }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 520;
  const H = 210;
  const PAD = { top: 16, right: 8, bottom: 26, left: 44 };
  const peak = Math.max(...data.map((d) => d.revenue));
  // Round the axis top up to a clean 3-jt step above the peak.
  const max = Math.max(3000000, Math.ceil(peak / 3000000) * 3000000);
  const ticks = [0, max / 3, (2 * max) / 3, max];
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const band = plotW / data.length;
  const barW = 34;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Monthly revenue, February through July 2026">
        {ticks.map((t) => {
          const y = PAD.top + plotH - (t / max) * plotH;
          return (
            <g key={t}>
              <line x1={PAD.left} x2={W - PAD.right} y1={y} y2={y} stroke="var(--color-hairline)" strokeWidth={1} />
              <text x={PAD.left - 8} y={y + 3.5} textAnchor="end" fontSize={10} fill="var(--color-ink-3)">
                {t === 0 ? "0" : `${Math.round(t / 100000) / 10} jt`}
              </text>
            </g>
          );
        })}
        {data.map((d, i) => {
          const h = (d.revenue / max) * plotH;
          const x = PAD.left + band * i + (band - barW) / 2;
          const y = PAD.top + plotH - h;
          return (
            <g key={d.month}>
              <path
                d={`M ${x} ${y + 4} q 0 -4 4 -4 h ${barW - 8} q 4 0 4 4 v ${h - 4} h ${-barW} Z`}
                fill="var(--color-viz-1)"
                opacity={hover === null || hover === i ? 1 : 0.45}
              />
              <rect
                x={PAD.left + band * i}
                y={PAD.top}
                width={band}
                height={plotH}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              />
              <text x={x + barW / 2} y={H - 8} textAnchor="middle" fontSize={11} fill="var(--color-ink-3)">
                {d.month}
              </text>
            </g>
          );
        })}
        <line x1={PAD.left} x2={W - PAD.right} y1={PAD.top + plotH} y2={PAD.top + plotH} stroke="var(--color-brand-300)" strokeWidth={1} />
      </svg>
      {hover !== null && (
        <div
          className="pointer-events-none absolute -top-1 rounded-lg border border-hairline bg-surface px-3 py-1.5 text-xs shadow-md"
          style={{ left: `${PAD.left / W * 100 + ((hover + 0.5) * (100 - (PAD.left + PAD.right) / W * 100)) / data.length}%`, transform: "translateX(-50%)" }}
        >
          <span className="font-medium">{data[hover].month} 2026</span>
          <span className="mx-1.5 text-ink-3">·</span>
          {formatIDR(data[hover].revenue)}
        </div>
      )}
    </div>
  );
}

/* Ranking of one measure across items — single hue with direct value labels. */
function TopItems() {
  const { inventory } = useTenant();
  const top = [...inventory].sort((a, b) => b.timesRented - a.timesRented).slice(0, 5);
  const max = top[0]?.timesRented || 1;
  return (
    <div className="space-y-3">
      {top.map((s) => (
        <div key={s.id}>
          <div className="mb-1 flex items-baseline justify-between text-[13px]">
            <span className="truncate pr-2">{s.name}</span>
            <span className="font-medium text-ink-2">{s.timesRented}×</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-brand-50">
            <div
              className="h-full rounded-full"
              style={{ width: `${(s.timesRented / max) * 100}%`, background: "var(--color-viz-1)" }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

const STATUS_ORDER: ItemStatus[] = ["available", "rented", "maintenance"];
/* Fixed categorical slot order (validated palette) — identity carried by label + count, never color alone. */
const STATUS_COLOR: Record<ItemStatus, string> = {
  available: "var(--color-viz-1)",
  rented: "var(--color-viz-5)",
  maintenance: "var(--color-viz-4)",
};

function InventoryBreakdown() {
  const { inventory, futureBookingFor } = useTenant();
  const counts = STATUS_ORDER.map((s) => ({
    status: s,
    n: inventory.filter((i) => i.status === s).length,
  })).filter((c) => c.n > 0);
  const total = counts.reduce((a, c) => a + c.n, 0);
  const bookedAhead = inventory.filter((i) => futureBookingFor(i.id)).length;
  return (
    <div>
      <div className="flex h-3.5 gap-[2px] overflow-hidden rounded-full">
        {counts.map((c) => (
          <div
            key={c.status}
            style={{ width: `${(c.n / total) * 100}%`, background: STATUS_COLOR[c.status] }}
            title={`${STATUS_LABEL[c.status]}: ${c.n}`}
          />
        ))}
      </div>
      <ul className="mt-4 space-y-2">
        {counts.map((c) => (
          <li key={c.status} className="flex items-center justify-between text-[13px]">
            <span className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: STATUS_COLOR[c.status] }} />
              {STATUS_LABEL[c.status]}
            </span>
            <span className="font-medium text-ink-2">{c.n}</span>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex items-center justify-between border-t border-hairline pt-3 text-[13px]">
        <span className="flex items-center gap-2 text-ink-2">
          <span className="h-2.5 w-2.5 rounded-sm bg-viz-1" />
          Booked ahead (reserved)
        </span>
        <span className="font-medium text-ink-2">{bookedAhead}</span>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { tenant, user, inventory, bookings, transactions, monthlyRevenue, customerById, itemById } = useTenant();

  const activeCount = bookings.filter((b) => b.status === "active" || b.status === "late").length;
  const out = inventory.filter((i) => i.status === "rented").length;
  const utilization = inventory.length ? Math.round((out / inventory.length) * 100) : 0;
  const depositsHeld = transactions
    .filter((t) => t.paymentStatus !== "refunded")
    .reduce((a, t) => a + t.deposit, 0);

  const thisMonth = monthlyRevenue[monthlyRevenue.length - 1];
  const prevMonth = monthlyRevenue[monthlyRevenue.length - 2];
  const revDeltaPct = prevMonth ? Math.round(((thisMonth.revenue - prevMonth.revenue) / prevMonth.revenue) * 100) : 0;

  const upcoming = bookings
    .filter((b) => b.status === "active" || b.status === "late")
    .sort((a, b) => a.endDate.localeCompare(b.endDate));

  return (
    <>
      <PageHeader
        title={`Good afternoon, ${user.name.split(" ")[0]}`}
        subtitle={`Saturday, 19 July 2026 — here's how ${tenant.name} is doing.`}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile
          label="Revenue this month"
          value={formatIDR(thisMonth.revenue)}
          delta={{ text: `${revDeltaPct >= 0 ? "+" : ""}${revDeltaPct}% vs ${prevMonth?.month}`, up: revDeltaPct >= 0 }}
        />
        <StatTile label="Active rentals" value={String(activeCount)} />
        <StatTile label="Inventory utilization" value={`${utilization}%`} />
        <StatTile label="Deposits held" value={formatIDR(depositsHeld)} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold">Revenue — last 6 months</h2>
          <RevenueChart data={monthlyRevenue} />
        </Card>
        <Card className="p-5">
          <h2 className="mb-3 text-sm font-semibold">Inventory by status</h2>
          <InventoryBreakdown />
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="p-5">
          <h2 className="mb-4 text-sm font-semibold">Most-rented kebaya</h2>
          <TopItems />
        </Card>

        <Card className="p-5 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Returns due</h2>
            <Link href="/app/bookings" className="text-xs font-medium text-brand-600 hover:underline">
              View all bookings
            </Link>
          </div>
          {upcoming.length === 0 ? (
            <p className="py-6 text-sm text-ink-3">No active rentals right now.</p>
          ) : (
            <ul className="divide-y divide-hairline">
              {upcoming.map((b) => {
                const c = customerById(b.customerId);
                const names = b.itemIds.map((id) => itemById(id).name).join(", ");
                return (
                  <li key={b.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{c.name}</div>
                      <div className="truncate text-xs text-ink-2">{names}</div>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      {b.status === "late" && (
                        <span className="flex items-center gap-1 text-xs font-medium text-critical">
                          <AlertTriangle size={13} /> Overdue
                        </span>
                      )}
                      <span className="text-sm text-ink-2">due {formatDate(b.endDate)}</span>
                      <BookingStatusBadge status={b.status} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      <Card className="mt-4 flex items-start gap-3 border-warning/50 bg-warning/15 p-4">
        <AlertTriangle size={17} className="mt-0.5 shrink-0 text-gold-600" />
        <div className="text-sm">
          <span className="font-medium">Graduation season is close.</span>{" "}
          <span className="text-ink-2">
            Wisuda-category kebaya are heavily booked for 23–28 July. Consider adding stock or
            suggesting alternatives to new enquiries.
          </span>
        </div>
      </Card>
    </>
  );
}
