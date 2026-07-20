import type { CustomerAccess, FinanceAccess, Plan, Tenant } from "./mock";

export interface PlanRules {
  inventoryLimit: number | null;
  staffLimit: number;
  publicBookingEnabled: boolean;
  manualBookingEnabled: boolean;
  posEnabled: boolean;
  customReceiptBranding: boolean;
  finance: FinanceAccess;
  customers: CustomerAccess;
  exportEnabled: boolean;
}

export const PLAN_RULES: Record<Plan, PlanRules> = {
  free: {
    inventoryLimit: 30,
    staffLimit: 1,
    publicBookingEnabled: false,
    manualBookingEnabled: false,
    posEnabled: true,
    customReceiptBranding: false,
    finance: "basic",
    customers: "basic",
    exportEnabled: false,
  },
  starter: {
    inventoryLimit: 100,
    staffLimit: 3,
    publicBookingEnabled: false,
    manualBookingEnabled: true,
    posEnabled: true,
    customReceiptBranding: false,
    finance: "basic",
    customers: "history",
    exportEnabled: false,
  },
  pro: {
    inventoryLimit: null,
    staffLimit: 11,
    publicBookingEnabled: true,
    manualBookingEnabled: true,
    posEnabled: true,
    customReceiptBranding: true,
    finance: "full",
    customers: "analytics",
    exportEnabled: true,
  },
};

export function rulesForTenant(tenant: Tenant): PlanRules {
  const base = PLAN_RULES[tenant.plan];
  const overrides = tenant.limitOverrides ?? {};
  return {
    ...base,
    inventoryLimit:
      overrides.inventoryLimit === undefined ? base.inventoryLimit : overrides.inventoryLimit,
    staffLimit: overrides.staffLimit ?? base.staffLimit,
    publicBookingEnabled: overrides.publicBookingEnabled ?? base.publicBookingEnabled,
    manualBookingEnabled: overrides.manualBookingEnabled ?? base.manualBookingEnabled,
    exportEnabled: overrides.exportEnabled ?? base.exportEnabled,
  };
}

export function planRequiredFor(feature: "manualBooking" | "publicBooking" | "export" | "customReceiptBranding"): Plan {
  if (feature === "publicBooking" || feature === "export" || feature === "customReceiptBranding") return "pro";
  return "starter";
}

export function limitText(limit: number | null): string {
  return limit === null ? "Unlimited" : String(limit);
}
