import type { ReactNode } from "react";
import type { BookingStatus, ConditionGrade, ItemStatus } from "../data/mock";
import { STATUS_LABEL } from "../data/mock";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-black/5 bg-white shadow-[0_1px_2px_rgba(11,11,11,0.03)] ${className}`}>
      {children}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-2">{subtitle}</p>}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}

const ITEM_STATUS_STYLE: Record<ItemStatus, string> = {
  available: "bg-success/10 text-success ring-success/30",
  rented: "bg-brand-600/10 text-brand-600 ring-brand-600/30",
  maintenance: "bg-warning/20 text-gold-600 ring-warning/50",
};

export function ItemStatusBadge({ status }: { status: ItemStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${ITEM_STATUS_STYLE[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}

/** Reservation badge — orthogonal to physical status. An Available item can be
    Booked for a future date range; this badge carries that, not ItemStatusBadge. */
export function BookedBadge({ date }: { date?: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-info/10 px-2 py-0.5 text-xs font-medium text-info ring-1 ring-info/30">
      Booked{date ? ` · ${date}` : ""}
    </span>
  );
}

const BOOKING_STATUS_STYLE: Record<BookingStatus, string> = {
  confirmed: "bg-info/10 text-info ring-info/30",
  active: "bg-success/10 text-success ring-success/30",
  returned: "bg-brand-100 text-ink-2 ring-hairline",
  late: "bg-error/10 text-error ring-error/40",
  cancelled: "bg-brand-100 text-ink-3 ring-hairline line-through",
};

export function BookingStatusBadge({ status }: { status: BookingStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ring-1 ${BOOKING_STATUS_STYLE[status]}`}>
      {status}
    </span>
  );
}

const GRADE_STYLE: Record<ConditionGrade, string> = {
  A: "bg-success/10 text-success ring-success/30",
  B: "bg-warning/20 text-gold-600 ring-warning/50",
  C: "bg-error/10 text-error ring-error/40",
};

export function GradeBadge({ grade }: { grade: ConditionGrade }) {
  return (
    <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ring-1 ${GRADE_STYLE[grade]}`}>
      {grade}
    </span>
  );
}

export function Th({ children, className = "" }: { children?: ReactNode; className?: string }) {
  return (
    <th className={`px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-ink-3 ${className}`}>
      {children}
    </th>
  );
}

export function Td({ children, className = "" }: { children?: ReactNode; className?: string }) {
  return <td className={`px-4 py-3 text-sm ${className}`}>{children}</td>;
}
