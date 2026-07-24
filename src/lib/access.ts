import type { Role } from "@/data/mock";

/**
 * Which `/app` routes each domain role may reach.
 *
 * This is the single source of truth for role-based navigation: both the
 * sidebar (which links to show) and the client-side route guard in
 * `app/app/layout.tsx` (which routes to bounce) read from it, so the two can
 * never drift apart.
 *
 * NOTE: this is a UX gate, not the security boundary. Tenant isolation is
 * enforced server-side from the session (CONTEXT.md rule 1); hardening the
 * per-role read surface (e.g. keeping finance rows out of a cashier's
 * bootstrap payload) is a separate, later concern.
 */
export const ROLE_ROUTES: Record<Role, readonly string[]> = {
  // Owner is the shop; they reach everything, including the counter.
  owner: [
    "/app",
    "/app/bookings",
    "/app/inventory",
    "/app/pos",
    "/app/customers",
    "/app/fitting",
    "/app/finance",
    "/app/settings",
    "/app/account",
  ],
  // Counter staff: rings up sales, sees who they serve and what's in stock
  // (read-only), works the booking calendar. No money view, no shop settings.
  cashier: ["/app", "/app/bookings", "/app/inventory", "/app/pos", "/app/customers", "/app/account"],
  // Fitting staff: the schedule and the pieces going out, nothing financial.
  fitting: ["/app", "/app/bookings", "/app/fitting", "/app/account"],
};

/** True when `role` may view `path` (exact route, not prefix). */
export function canAccessRoute(role: Role, path: string): boolean {
  return ROLE_ROUTES[role].includes(path);
}

/**
 * Roles that may edit inventory rather than only read it. A cashier sees the
 * inventory screen but its add/edit controls are hidden.
 */
export function canEditInventory(role: Role): boolean {
  return role === "owner";
}
