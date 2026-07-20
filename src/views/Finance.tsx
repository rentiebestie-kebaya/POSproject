"use client";

import { AlertTriangle, Download } from "lucide-react";
import { Card, PageHeader, Th, Td } from "../components/Ui";
import { useTenant } from "../data/store";
import { formatDate, formatIDR, type Transaction } from "../data/mock";

const PAY_STATUS_STYLE: Record<string, string> = {
  paid: "bg-success/10 text-success ring-success/30",
  partial: "bg-warning/20 text-gold-600 ring-warning/50",
  pending: "bg-error/10 text-error ring-error/40",
  refunded: "bg-brand-100 text-ink-2 ring-hairline",
};

function exportCsv(transactions: Transaction[], tenantSlug: string) {
  const header = "transaction,booking,date,deposit,late_fee,damage_fee,total,method,status";
  const rows = transactions.map((t) =>
    [t.id, t.bookingId, t.date, t.deposit, t.lateFee, t.damageFee, t.total, t.method, t.paymentStatus].join(","),
  );
  const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `rentie-${tenantSlug}-transactions-jul-2026.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export default function Finance() {
  const { tenant, bookings, transactions, planRules, customerById } = useTenant();
  const collected = transactions
    .filter((t) => t.paymentStatus === "paid")
    .reduce((a, t) => a + t.total, 0);
  const outstanding = transactions
    .filter((t) => t.paymentStatus === "partial" || t.paymentStatus === "pending")
    .reduce((a, t) => a + t.total, 0);
  const depositsHeld = transactions
    .filter((t) => t.paymentStatus !== "refunded")
    .reduce((a, t) => a + t.deposit, 0);
  const fees = transactions.reduce((a, t) => a + t.lateFee + t.damageFee, 0);

  return (
    <>
      <PageHeader
        title="Finance"
        subtitle={
          planRules.finance === "full"
            ? "Payments, deposits, and fees for this outlet — export anytime for your accountant."
            : "Basic revenue summary for this outlet."
        }
        actions={
          <button
            onClick={() => {
              if (planRules.exportEnabled) exportCsv(transactions, tenant.id);
            }}
            className={`flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-medium ${
              planRules.exportEnabled
                ? "border-black/10 bg-white hover:bg-brand-50"
                : "border-warning/30 bg-warning/10 text-gold-600"
            }`}
            title={planRules.exportEnabled ? "Export transactions" : "Data export is available on Pro."}
          >
            <Download size={15} /> Export CSV
          </button>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          ["Collected (July)", collected],
          ["Outstanding", outstanding],
          ["Deposits held", depositsHeld],
          ["Late + damage fees", fees],
        ].map(([label, v]) => (
          <Card key={label as string} className="px-5 py-4">
            <div className="text-[13px] text-ink-2">{label}</div>
            <div className="mt-1 text-xl font-semibold tracking-tight tabular-nums">
              {formatIDR(v as number)}
            </div>
          </Card>
        ))}
      </div>

      {planRules.finance !== "full" && (
        <Card className="mt-4 p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-warning/20 text-gold-600">
              <AlertTriangle size={17} />
            </div>
            <div>
              <h2 className="text-sm font-semibold">Full finance is available on Pro</h2>
              <p className="mt-1 text-sm leading-6 text-ink-2">
                Free and Starter include the summary above. Upgrade to Pro for transaction-level finance, full reports, and data export.
              </p>
            </div>
          </div>
        </Card>
      )}

      {planRules.finance === "full" && (
      <Card className="mt-4 overflow-hidden">
        <table className="w-full">
          <thead className="border-b border-hairline bg-page">
            <tr>
              <Th>Transaction</Th>
              <Th>Date</Th>
              <Th>Customer</Th>
              <Th className="text-right">Deposit</Th>
              <Th className="text-right">Late fee</Th>
              <Th className="text-right">Damage fee</Th>
              <Th className="text-right">Total</Th>
              <Th>Method</Th>
              <Th>Status</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            {transactions.map((t) => {
              const booking = bookings.find((b) => b.id === t.bookingId)!;
              return (
                <tr key={t.id} className="hover:bg-brand-50/40">
                  <Td className="font-medium">{t.id}</Td>
                  <Td className="whitespace-nowrap text-ink-2">{formatDate(t.date)}</Td>
                  <Td>{customerById(booking.customerId).name}</Td>
                  <Td className="text-right tabular-nums text-ink-2">{formatIDR(t.deposit)}</Td>
                  <Td className={`text-right tabular-nums ${t.lateFee ? "font-medium text-critical" : "text-ink-3"}`}>
                    {t.lateFee ? formatIDR(t.lateFee) : "—"}
                  </Td>
                  <Td className={`text-right tabular-nums ${t.damageFee ? "font-medium text-critical" : "text-ink-3"}`}>
                    {t.damageFee ? formatIDR(t.damageFee) : "—"}
                  </Td>
                  <Td className="text-right font-medium tabular-nums">{formatIDR(t.total)}</Td>
                  <Td className="text-ink-2">{t.method}</Td>
                  <Td>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ring-1 ${PAY_STATUS_STYLE[t.paymentStatus]}`}>
                      {t.paymentStatus}
                    </span>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
      )}
    </>
  );
}
