"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  LayoutDashboard,
  CalendarDays,
  Shirt,
  ShoppingBag,
  Users,
  Wallet,
  Settings,
  Bell,
  ChevronDown,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { useTenant } from "../data/store";
import { ROLE_LABEL } from "../data/mock";

const NAV = [
  { to: "/app", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/app/bookings", label: "Bookings", icon: CalendarDays },
  { to: "/app/inventory", label: "Inventory", icon: Shirt },
  { to: "/app/pos", label: "Rental POS", icon: ShoppingBag },
  { to: "/app/customers", label: "Customers", icon: Users },
  { to: "/app/finance", label: "Finance", icon: Wallet },
  { to: "/app/settings", label: "Settings", icon: Settings },
];

export default function Layout({ children }: { children: ReactNode }) {
  const { tenant, user, logout } = useTenant();
  const pathname = usePathname();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => window.localStorage.getItem("rentie-sidebar-collapsed") === "true",
  );
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const initials = user.name
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();

  useEffect(() => {
    window.localStorage.setItem("rentie-sidebar-collapsed", String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  // Close the user menu on outside click or Escape.
  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  return (
    <div className="flex min-h-screen">
      <aside
        className={`fixed inset-y-0 left-0 z-20 flex flex-col border-r border-black/5 bg-page transition-[width] duration-200 ${
          sidebarCollapsed ? "w-16" : "w-60"
        }`}
      >
        <div className={`flex items-center gap-2.5 py-5 ${sidebarCollapsed ? "justify-center px-3" : "px-5"}`}>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-900 font-bold text-gold-400">
            R
          </div>
          <div className={sidebarCollapsed ? "hidden" : ""}>
            <div className="text-base font-semibold tracking-tight">rentie</div>
            <div className="text-[11px] text-ink-3">Kebaya Rental OS</div>
          </div>
        </div>

        <nav className="mt-2 flex-1 space-y-1 px-3">
          {NAV.map(({ to, label, icon: Icon, end }) => {
            const isActive = end ? pathname === to : pathname === to || pathname.startsWith(`${to}/`);
            return (
              <Link
                key={to}
                href={to}
                title={sidebarCollapsed ? label : undefined}
                className={`flex items-center rounded-full px-3.5 py-2 text-sm font-medium transition-colors ${
                  sidebarCollapsed ? "justify-center" : "gap-3"
                } ${
                  isActive
                    ? "bg-brand-900 text-white"
                    : "text-ink-2 hover:bg-black/5 hover:text-ink"
                }`}
              >
                <Icon size={18} strokeWidth={1.8} />
                {!sidebarCollapsed && <span>{label}</span>}
              </Link>
            );
          })}
        </nav>

        <div className={`border-t border-black/5 py-4 ${sidebarCollapsed ? "px-3" : "px-5"}`}>
          <button
            type="button"
            onClick={() => setSidebarCollapsed((value) => !value)}
            className={`flex w-full items-center rounded-full py-2 text-sm font-medium text-ink-2 hover:bg-black/5 hover:text-ink ${
              sidebarCollapsed ? "justify-center px-0" : "justify-between px-3.5"
            }`}
            aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {!sidebarCollapsed && <span>Collapse</span>}
            {sidebarCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>
        </div>
      </aside>

      <div className={`flex-1 transition-[margin-left] duration-200 ${sidebarCollapsed ? "ml-16" : "ml-60"}`}>
        <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-black/5 bg-white/80 px-6 backdrop-blur-lg">
          <div className="text-sm text-ink-2">
            <span className="font-medium text-ink">{tenant.name}</span>
            <span className="mx-2 text-hairline">|</span>
            {tenant.outlet}
          </div>
          <div className="flex items-center gap-3">
            <button className="relative rounded-full p-2 text-ink-2 hover:bg-black/5" aria-label="Notifications">
              <Bell size={18} />
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-critical" />
            </button>

            {/* User menu — switch/sign out of the prototype session. */}
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                className="flex items-center gap-2 rounded-full px-2 py-1.5 text-sm hover:bg-black/5"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-900 text-xs font-semibold text-gold-400">
                  {initials}
                </div>
                <span className="font-medium">{user.name.split(" ")[0]}</span>
                <span className="text-xs text-ink-3">{ROLE_LABEL[user.role]}</span>
                <ChevronDown size={15} className={`text-ink-3 transition-transform ${menuOpen ? "rotate-180" : ""}`} />
              </button>

              {menuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 top-full z-30 mt-1.5 w-60 overflow-hidden rounded-2xl border border-black/5 bg-white shadow-[0_16px_50px_-16px_rgba(53,20,31,0.25)]"
                >
                  <div className="flex items-center gap-3 border-b border-black/5 px-4 py-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-900 text-sm font-semibold text-gold-400">
                      {initials}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{user.name}</div>
                      <div className="text-xs text-ink-3">
                        {ROLE_LABEL[user.role]} · {tenant.name}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={logout}
                    className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm font-medium text-critical hover:bg-brand-50"
                  >
                    <LogOut size={16} /> Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Keyed by tenant: switching tenants remounts pages, clearing any
            page-local state (selections, carts) from the previous tenant. */}
        <main key={tenant.id} className="mx-auto w-full max-w-[1600px] px-6 py-6">
          {children}
        </main>
      </div>
    </div>
  );
}
