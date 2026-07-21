"use client";

import { AlertTriangle, Download } from "lucide-react";
import { Card, PageHeader, Th, Td } from "../components/Ui";
import { useTenant } from "../data/store";
import { formatDate, formatIDR, type Transaction } from "../data/mock";
import { buildFinanceTransactionLine } from "../data/finance";

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
  a.download = `rentie-${tenantSlug}-transactions.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export default function Finance() {
  const { tenant, bookings, transactions, financeSummary, planRules, customerById } = useTenant();
  const sortedTransactions = [...transactions].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));

  return (
    <>
      <PageHeader
        title="Finance"
        subtitle={
          planRules.finance === "full"
            ? "Payments, deposits, and fees recorded through POS for this store."
            : "Basic revenue summary from real POS transactions for this store."
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
          ["Today's takings", financeSummary.todayTakings],
          ["Basic revenue", financeSummary.grossRevenue],
          ["Deposits held", financeSummary.depositsHeld],
          ["Late + damage fees", financeSummary.feeRevenue],
        ].map(([label, v]) => (
          <Card key={label as string} className="px-5 py-4">
            <div className="text-[13px] text-ink-2">{label}</div>
            <div className="mt-1 text-xl font-semibold tracking-tight tabular-nums">
              {formatIDR(v as number)}
            </div>
          </Card>
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="px-5 py-4">
          <div className="text-[13px] text-ink-2">Checkout takings</div>
          <div className="mt-1 text-lg font-semibold tabular-nums">{formatIDR(financeSummary.checkoutTakings)}</div>
          <p className="mt-1 text-xs leading-5 text-ink-3">
            Rental payments plus deposits received at checkout.
          </p>
        </Card>
        <Card className="px-5 py-4">
          <div className="text-[13px] text-ink-2">Outstanding</div>
          <div className="mt-1 text-lg font-semibold tabular-nums">{formatIDR(financeSummary.outstanding)}</div>
          <p className="mt-1 text-xs leading-5 text-ink-3">
            Partial or pending transaction totals still to reconcile.
          </p>
        </Card>
        <Card className="px-5 py-4">
          <div className="text-[13px] text-ink-2">Transactions</div>
          <div className="mt-1 text-lg font-semibold tabular-nums">{financeSummary.transactionCount}</div>
          <p className="mt-1 text-xs leading-5 text-ink-3">
            {financeSummary.todayTransactionCount} recorded today.
          </p>
        </Card>
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
              <Th>Type</Th>
              <Th className="text-right">Deposit</Th>
              <Th className="text-right">Deposit returned</Th>
              <Th className="text-right">Late fee</Th>
              <Th className="text-right">Damage fee</Th>
              <Th className="text-right">Revenue</Th>
              <Th className="text-right">Total</Th>
              <Th>Method</Th>
              <Th>Status</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            {sortedTransactions.map((t) => {
              const booking = bookings.find((b) => b.id === t.bookingId);
              const line = buildFinanceTransactionLine(t);
              return (
                <tr key={t.id} className="hover:bg-brand-50/40">
                  <Td className="font-medium">{t.id}</Td>
                  <Td className="whitespace-nowrap text-ink-2">{formatDate(t.date)}</Td>
                  <Td>{t.customerName ?? (booking ? customerById(booking.customerId).name : "Unknown")}</Td>
                  <Td className="capitalize text-ink-2">{t.transactionType ?? "record"}</Td>
                  <Td className="text-right tabular-nums text-ink-2">{formatIDR(t.deposit)}</Td>
                  <Td className="text-right tabular-nums text-ink-2">
                    {t.depositReturned ? formatIDR(t.depositReturned) : "—"}
                  </Td>
                  <Td className={`text-right tabular-nums ${t.lateFee ? "font-medium text-critical" : "text-ink-3"}`}>
                    {t.lateFee ? formatIDR(t.lateFee) : "—"}
                  </Td>
                  <Td className={`text-right tabular-nums ${t.damageFee ? "font-medium text-critical" : "text-ink-3"}`}>
                    {t.damageFee ? formatIDR(t.damageFee) : "—"}
                  </Td>
                  <Td className="text-right font-medium tabular-nums">{formatIDR(line.recognizedRevenue)}</Td>
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
