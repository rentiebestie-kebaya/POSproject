"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTenant } from "@/data/store";
import Layout from "@/components/Layout";
import { canAccessRoute } from "@/lib/access";

// Gates the tenant app behind the prototype session; unauthenticated users go to /login.
export default function AppLayout({ children }: { children: ReactNode }) {
  const { isAuthenticated, sessionReady, user } = useTenant();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (sessionReady && !isAuthenticated) router.replace("/login");
  }, [sessionReady, isAuthenticated, router]);

  // Role guard: a staff member who types a URL their role can't reach (e.g. a
  // cashier opening /app/finance) is bounced to the dashboard, which every role
  // can see. Mirrors the sidebar filtering so the two never disagree.
  useEffect(() => {
    if (sessionReady && isAuthenticated && !canAccessRoute(user.role, pathname)) {
      router.replace("/app");
    }
  }, [sessionReady, isAuthenticated, user.role, pathname, router]);

  // The session lives in localStorage, so it is unknown until after hydration.
  if (!sessionReady || !isAuthenticated) return null;

  // Hold the render for a disallowed route until the redirect above lands, so
  // the forbidden page never flashes.
  if (!canAccessRoute(user.role, pathname)) return null;

  return <Layout>{children}</Layout>;
}
