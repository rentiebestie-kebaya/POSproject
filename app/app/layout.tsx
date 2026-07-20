"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useTenant } from "@/data/store";
import Layout from "@/components/Layout";

// Gates the tenant app behind the prototype session; unauthenticated users go to /login.
export default function AppLayout({ children }: { children: ReactNode }) {
  const { isAuthenticated, sessionReady } = useTenant();
  const router = useRouter();

  useEffect(() => {
    if (sessionReady && !isAuthenticated) router.replace("/login");
  }, [sessionReady, isAuthenticated, router]);

  // The session lives in localStorage, so it is unknown until after hydration.
  if (!sessionReady || !isAuthenticated) return null;

  return <Layout>{children}</Layout>;
}
