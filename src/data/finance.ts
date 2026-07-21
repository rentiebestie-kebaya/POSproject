import type { PaymentMethod, Transaction } from "./mock";

const PAYMENT_METHODS: PaymentMethod[] = ["QRIS", "GoPay", "OVO", "DANA", "Cash", "Card"];

export interface FinanceSummary {
  asOfDate: string;
  transactionCount: number;
  todayTransactionCount: number;
  checkoutTakings: number;
  todayTakings: number;
  todayCashOut: number;
  todayNetMovement: number;
  rentalRevenue: number;
  lateFees: number;
  damageFees: number;
  feeRevenue: number;
  grossRevenue: number;
  depositsCollected: number;
  depositsReturned: number;
  depositsAppliedToFees: number;
  depositsHeld: number;
  outstanding: number;
  paymentByMethod: Record<PaymentMethod, number>;
}

export interface FinanceSummaryOptions {
  asOfDate?: string;
}

export interface FinanceTransactionLine {
  transactionId: string;
  checkoutTakings: number;
  cashIn: number;
  cashOut: number;
  netMovement: number;
  rentalRevenue: number;
  feeRevenue: number;
  recognizedRevenue: number;
  depositCollected: number;
  depositReturned: number;
  depositAppliedToFees: number;
  outstanding: number;
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function positive(value: number | undefined): number {
  return Math.max(0, Math.round(Number(value ?? 0)));
}

function emptyPaymentByMethod(): Record<PaymentMethod, number> {
  return PAYMENT_METHODS.reduce(
    (acc, method) => ({ ...acc, [method]: 0 }),
    {} as Record<PaymentMethod, number>,
  );
}

function isCloseTransaction(transaction: Transaction): boolean {
  return (
    transaction.transactionType === "close" ||
    (transaction.paymentStatus === "refunded" &&
      (transaction.depositReturned != null || transaction.amountDue != null || transaction.returnNotes != null))
  );
}

function rentalRevenueForOpen(transaction: Transaction, fees: number): number {
  if (transaction.rentalTotal != null) return positive(transaction.rentalTotal);
  return positive(transaction.total - transaction.deposit - fees);
}

export function buildFinanceTransactionLine(transaction: Transaction): FinanceTransactionLine {
  const fees = positive(transaction.lateFee) + positive(transaction.damageFee);
  const isClose = isCloseTransaction(transaction);

  if (isClose) {
    const cashIn = positive(transaction.amountDue ?? Math.max(0, fees - positive(transaction.deposit)));
    const cashOut = positive(transaction.depositReturned ?? Math.max(0, positive(transaction.deposit) - fees));
    const feeRevenue = positive(transaction.lateFee) + positive(transaction.damageFee);
    return {
      transactionId: transaction.id,
      checkoutTakings: 0,
      cashIn,
      cashOut,
      netMovement: cashIn - cashOut,
      rentalRevenue: 0,
      feeRevenue,
      recognizedRevenue: feeRevenue,
      depositCollected: 0,
      depositReturned: cashOut,
      depositAppliedToFees: Math.min(positive(transaction.deposit), feeRevenue),
      outstanding: 0,
    };
  }

  const collected = transaction.paymentStatus === "paid";
  const recognized = collected || transaction.paymentStatus === "refunded";
  const cashIn = collected ? positive(transaction.total) : 0;
  const rentalRevenue = recognized ? rentalRevenueForOpen(transaction, fees) : 0;
  const feeRevenue = recognized ? fees : 0;
  const outstanding =
    transaction.paymentStatus === "partial" || transaction.paymentStatus === "pending" ? positive(transaction.total) : 0;

  return {
    transactionId: transaction.id,
    checkoutTakings: cashIn,
    cashIn,
    cashOut: 0,
    netMovement: cashIn,
    rentalRevenue,
    feeRevenue,
    recognizedRevenue: rentalRevenue + feeRevenue,
    depositCollected: collected ? positive(transaction.deposit) : 0,
    depositReturned: 0,
    depositAppliedToFees: 0,
    outstanding,
  };
}

export function buildFinanceSummary(
  transactions: Transaction[],
  options: FinanceSummaryOptions = {},
): FinanceSummary {
  const asOfDate = options.asOfDate ?? todayIsoDate();
  const paymentByMethod = emptyPaymentByMethod();
  let todayTransactionCount = 0;
  let checkoutTakings = 0;
  let todayCashIn = 0;
  let todayCashOut = 0;
  let rentalRevenue = 0;
  let lateFees = 0;
  let damageFees = 0;
  let depositsCollected = 0;
  let depositsReturned = 0;
  let depositsAppliedToFees = 0;
  let outstanding = 0;

  for (const transaction of transactions) {
    const isToday = transaction.date === asOfDate;
    const line = buildFinanceTransactionLine(transaction);

    if (isToday) todayTransactionCount += 1;

    checkoutTakings += line.checkoutTakings;
    rentalRevenue += line.rentalRevenue;
    lateFees += line.feeRevenue > 0 ? positive(transaction.lateFee) : 0;
    damageFees += line.feeRevenue > 0 ? positive(transaction.damageFee) : 0;
    depositsCollected += line.depositCollected;
    depositsReturned += line.depositReturned;
    depositsAppliedToFees += line.depositAppliedToFees;
    outstanding += line.outstanding;

    paymentByMethod[transaction.method] += line.netMovement;
    if (isToday) {
      todayCashIn += line.cashIn;
      todayCashOut += line.cashOut;
    }
  }

  const feeRevenue = lateFees + damageFees;
  const depositsHeld = Math.max(0, depositsCollected - depositsReturned - depositsAppliedToFees);

  return {
    asOfDate,
    transactionCount: transactions.length,
    todayTransactionCount,
    checkoutTakings,
    todayTakings: todayCashIn,
    todayCashOut,
    todayNetMovement: todayCashIn - todayCashOut,
    rentalRevenue,
    lateFees,
    damageFees,
    feeRevenue,
    grossRevenue: rentalRevenue + feeRevenue,
    depositsCollected,
    depositsReturned,
    depositsAppliedToFees,
    depositsHeld,
    outstanding,
    paymentByMethod,
  };
}
