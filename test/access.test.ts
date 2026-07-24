import { describe, expect, it } from "vitest";
import { ROLE_ROUTES, canAccessRoute, canEditInventory } from "../src/lib/access";

/**
 * The role→route map drives both the sidebar and the client route guard, so a
 * silent edit here changes who can see what. These assertions pin the intent.
 */
describe("role-based route access", () => {
  it("lets the owner reach every route the app defines", () => {
    const everyRoute = new Set(Object.values(ROLE_ROUTES).flat());
    for (const route of everyRoute) {
      expect(canAccessRoute("owner", route)).toBe(true);
    }
  });

  it("keeps money and shop settings owner-only", () => {
    for (const route of ["/app/finance", "/app/settings"]) {
      expect(canAccessRoute("owner", route)).toBe(true);
      expect(canAccessRoute("cashier", route)).toBe(false);
      expect(canAccessRoute("fitting", route)).toBe(false);
    }
  });

  it("gives the cashier the counter but not the fitting bench", () => {
    for (const route of ["/app", "/app/pos", "/app/customers", "/app/bookings", "/app/inventory"]) {
      expect(canAccessRoute("cashier", route)).toBe(true);
    }
    expect(canAccessRoute("cashier", "/app/fitting")).toBe(false);
  });

  it("gives fitting staff their bench and the schedule, nothing else", () => {
    for (const route of ["/app", "/app/bookings", "/app/fitting"]) {
      expect(canAccessRoute("fitting", route)).toBe(true);
    }
    for (const route of ["/app/pos", "/app/inventory", "/app/customers"]) {
      expect(canAccessRoute("fitting", route)).toBe(false);
    }
  });

  it("gives everyone their own account page", () => {
    for (const role of ["owner", "cashier", "fitting"] as const) {
      expect(canAccessRoute(role, "/app/account")).toBe(true);
    }
  });

  it("rejects unknown routes for every role", () => {
    for (const role of ["owner", "cashier", "fitting"] as const) {
      expect(canAccessRoute(role, "/app/does-not-exist")).toBe(false);
      expect(canAccessRoute(role, "/dev")).toBe(false);
    }
  });

  it("lets only the owner edit inventory", () => {
    expect(canEditInventory("owner")).toBe(true);
    expect(canEditInventory("cashier")).toBe(false);
    expect(canEditInventory("fitting")).toBe(false);
  });
});
