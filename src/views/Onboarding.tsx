"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Building2, CalendarDays, Check, Shirt, Wallet } from "lucide-react";
import { Card } from "../components/Ui";
import { useTenant } from "../data/store";
import { BILLING_STATUS_LABEL, PLAN_LABEL } from "../data/mock";
import { limitText } from "../data/plans";

const STEPS = [
  {
    icon: Building2,
    title: "Confirm store profile",
    body: "Store name, location, WhatsApp, and setup details are already created from signup.",
  },
  {
    icon: Wallet,
    title: "Review plan",
    body: "Your selected plan controls inventory, staff, booking, finance, exports, and branding.",
  },
  {
    icon: Shirt,
    title: "Add first inventory",
    body: "Start with the pieces you rent most often so POS and availability are useful immediately.",
  },
  {
    icon: CalendarDays,
    title: "Set booking workflow",
    body: "Manual reservations and public booking depend on your plan.",
  },
];

export default function Onboarding() {
  const { isAuthenticated, platform, planRules, sessionReady, tenant } = useTenant();
  const router = useRouter();

  useEffect(() => {
    if (!sessionReady) return;
    if (!isAuthenticated) router.replace("/login");
  }, [isAuthenticated, router, sessionReady]);

  if (!sessionReady || !isAuthenticated) return null;

  const finish = () => {
    platform.updateTenantOnboardingStatus(tenant.id, "complete");
    router.replace("/app");
  };

  return (
    <main className="min-h-screen bg-page px-6 py-10">
      <div className="mx-auto w-full max-w-5xl">
        <Link href="/" className="mb-6 inline-flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-900 text-sm font-bold text-gold-400">
            R
          </div>
          <span className="text-base font-semibold tracking-wide">RENTIE</span>
        </Link>

        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Setup your store</h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-ink-2">
              Complete the basics before using the app. You can still edit store details later from Settings.
            </p>

            <div className="mt-6 grid gap-3">
              {STEPS.map((step) => {
                const Icon = step.icon;
                return (
                  <Card key={step.title} className="flex gap-4 p-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                      <Icon size={19} />
                    </div>
                    <div>
                      <h2 className="text-sm font-semibold">{step.title}</h2>
                      <p className="mt-1 text-sm leading-6 text-ink-2">{step.body}</p>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>

          <Card className="self-start p-5">
            <div className="text-xs font-semibold uppercase tracking-wide text-ink-3">New store</div>
            <h2 className="mt-2 text-xl font-semibold">{tenant.name}</h2>
            <div className="mt-1 text-sm text-ink-2">{tenant.location}</div>

            <dl className="mt-5 space-y-3 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-ink-2">Plan</dt>
                <dd className="font-medium">{PLAN_LABEL[tenant.plan]}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-2">Billing</dt>
                <dd className="font-medium">{BILLING_STATUS_LABEL[tenant.billingStatus]}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-2">Inventory limit</dt>
                <dd className="font-medium">{limitText(planRules.inventoryLimit)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-2">Staff limit</dt>
                <dd className="font-medium">{planRules.staffLimit} total</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-2">Booking page</dt>
                <dd className="font-medium">{planRules.publicBookingEnabled ? tenant.subdomain : "Locked"}</dd>
              </div>
            </dl>

            <button
              type="button"
              onClick={finish}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-ink px-4 py-3 text-sm font-semibold text-white hover:bg-brand-900"
            >
              Finish setup <ArrowRight size={16} />
            </button>
            <Link
              href="/app/inventory"
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-black/10 bg-white px-4 py-3 text-sm font-semibold hover:bg-brand-50"
            >
              <Check size={16} /> Add inventory first
            </Link>
          </Card>
        </div>
      </div>
    </main>
  );
}
