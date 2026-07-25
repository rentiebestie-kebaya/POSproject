"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, Building2, CalendarDays, Check, Copy, PackagePlus } from "lucide-react";
import { Card } from "../components/Ui";
import { ShopProfileForm } from "../components/ShopProfileForm";
import { useTenant } from "../data/store";
import { PLAN_LABEL } from "../data/mock";
import { shopProfileIsValid, type ShopProfileFields } from "@/lib/shop-profile";

type SetupStep = "profile" | "inventory" | "booking";

const STEP_ORDER: SetupStep[] = ["profile", "inventory", "booking"];
const STEP_META: Record<SetupStep, { label: string; icon: typeof Building2 }> = {
  profile: { label: "Profile", icon: Building2 },
  inventory: { label: "Inventory", icon: PackagePlus },
  booking: { label: "Booking", icon: CalendarDays },
};

function stepFromParam(value: string | null): SetupStep {
  return value === "inventory" || value === "booking" ? value : "profile";
}

export default function Onboarding() {
  const { isAuthenticated, planRules, sessionReady, tenant, updateTenantProfile } = useTenant();
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialStep = stepFromParam(searchParams.get("step"));
  const [step, setStep] = useState<SetupStep>(initialStep);
  const [profileSaved, setProfileSaved] = useState(
    initialStep !== "profile" && shopProfileIsValid({
      name: tenant.name,
      location: tenant.location,
      whatsapp: tenant.whatsapp,
    }),
  );
  const [savingProfile, setSavingProfile] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!sessionReady) return;
    if (!isAuthenticated) router.replace("/login");
  }, [isAuthenticated, router, sessionReady]);

  const profile = useMemo<ShopProfileFields>(
    () => ({
      name: tenant.name,
      location: tenant.location,
      whatsapp: tenant.whatsapp,
    }),
    [tenant.location, tenant.name, tenant.whatsapp],
  );

  const stepIndex = STEP_ORDER.indexOf(step);
  const bookingLink = `https://${tenant.subdomain}`;

  const moveToStep = (next: SetupStep) => {
    if (next !== "profile" && !profileSaved) return;
    setError(null);
    setStep(next);
    router.replace(`/onboarding?step=${next}`);
  };

  const saveProfile = async (nextProfile: ShopProfileFields) => {
    setError(null);
    setSavingProfile(true);
    try {
      await updateTenantProfile(nextProfile);
      setProfileSaved(true);
      setStep("inventory");
      router.replace("/onboarding?step=inventory");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Shop profile could not be saved.");
    } finally {
      setSavingProfile(false);
    }
  };

  const finish = async () => {
    if (!profileSaved || finishing) return;
    setError(null);
    setFinishing(true);
    try {
      await updateTenantProfile({ onboardingStatus: "complete" });
      router.replace("/app");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Setup could not be completed.");
      setFinishing(false);
    }
  };

  const copyBookingLink = async () => {
    try {
      await navigator.clipboard.writeText(bookingLink);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  if (!sessionReady || !isAuthenticated) return null;

  return (
    <main className="min-h-screen bg-page px-6 py-10">
      <div className="mx-auto w-full max-w-5xl">
        <Link href="/" className="mb-6 inline-flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-900 text-sm font-bold text-gold-400">
            R
          </div>
          <span className="text-base font-semibold tracking-wide">RENTIE</span>
        </Link>

        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          <aside className="space-y-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Setup your store</h1>
              <p className="mt-2 text-sm leading-6 text-ink-2">Finish the required shop profile, then choose what to set up next.</p>
            </div>

            <Card className="p-3">
              <div className="space-y-1">
                {STEP_ORDER.map((candidate, index) => {
                  const Icon = STEP_META[candidate].icon;
                  const locked = candidate !== "profile" && !profileSaved;
                  const active = step === candidate;
                  return (
                    <button
                      key={candidate}
                      type="button"
                      disabled={locked}
                      onClick={() => moveToStep(candidate)}
                      className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm transition-colors disabled:opacity-45 ${
                        active ? "bg-brand-50 font-semibold text-brand-800" : "hover:bg-page"
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <Icon size={16} />
                        {STEP_META[candidate].label}
                      </span>
                      {candidate === "profile" && profileSaved ? <Check size={15} /> : <span className="text-xs text-ink-3">{index + 1}</span>}
                    </button>
                  );
                })}
              </div>
            </Card>
          </aside>

          <Card className="self-start p-5">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-hairline pb-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-ink-3">Step {stepIndex + 1} of 3</div>
                <h2 className="mt-1 text-xl font-semibold">{STEP_META[step].label}</h2>
              </div>
              <Link href="/app/settings" className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-2 hover:text-ink">
                <ArrowLeft size={15} /> Settings
              </Link>
            </div>

            {step === "profile" && (
              <div className="max-w-xl">
                <ShopProfileForm
                  idPrefix="onboarding-profile"
                  initialProfile={profile}
                  submitLabel="Save and continue"
                  submitting={savingProfile}
                  error={error}
                  onSubmit={saveProfile}
                />
              </div>
            )}

            {step === "inventory" && (
              <div className="space-y-5">
                <div>
                  <h3 className="text-base font-semibold">Add your first inventory when ready</h3>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-2">
                    Inventory is optional during setup. The full inventory modal already handles item details, photos, QR codes, and limits.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href="/app/inventory?setup=1"
                    className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700"
                  >
                    <PackagePlus size={15} /> Open inventory
                  </Link>
                  <button
                    type="button"
                    onClick={() => moveToStep("booking")}
                    className="inline-flex items-center gap-2 rounded-lg border border-hairline bg-surface px-3 py-2 text-sm font-semibold hover:bg-page"
                  >
                    Skip <ArrowRight size={15} />
                  </button>
                </div>
              </div>
            )}

            {step === "booking" && (
              <div className="space-y-5">
                <div>
                  <h3 className="text-base font-semibold">Booking workflow</h3>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-2">
                    Manual reservations are created by staff inside RENTIE. Public booking lets customers submit requests from the booking page.
                  </p>
                </div>

                <dl className="grid gap-3 text-sm sm:grid-cols-2">
                  <div className="rounded-lg border border-hairline p-3">
                    <dt className="text-ink-2">Manual booking</dt>
                    <dd className="mt-1 font-semibold">{planRules.manualBookingEnabled ? "Available" : `Locked on ${PLAN_LABEL[tenant.plan]}`}</dd>
                  </div>
                  <div className="rounded-lg border border-hairline p-3">
                    <dt className="text-ink-2">Public booking</dt>
                    <dd className="mt-1 font-semibold">{planRules.publicBookingEnabled ? "Available" : `Locked on ${PLAN_LABEL[tenant.plan]}`}</dd>
                  </div>
                </dl>

                <div className="rounded-lg border border-hairline bg-page/60 p-3">
                  <div className="text-xs font-medium text-ink-3">Booking link</div>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <code className="rounded bg-surface px-2 py-1 text-sm">{tenant.subdomain}</code>
                    <button
                      type="button"
                      onClick={copyBookingLink}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-hairline bg-surface px-2.5 py-1.5 text-xs font-semibold hover:bg-brand-50"
                    >
                      {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? "Copied" : "Copy"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {error && step !== "profile" && (
              <p className="mt-5 rounded-lg bg-critical/10 px-3 py-2 text-sm text-critical" role="alert">
                {error}
              </p>
            )}

            {step !== "profile" && (
              <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-hairline pt-4">
                <button
                  type="button"
                  onClick={() => moveToStep(STEP_ORDER[Math.max(0, stepIndex - 1)])}
                  className="inline-flex items-center gap-2 rounded-lg border border-hairline bg-surface px-3 py-2 text-sm font-semibold hover:bg-page"
                >
                  <ArrowLeft size={15} /> Back
                </button>
                <div className="flex flex-wrap gap-2">
                  {step === "inventory" && (
                    <button
                      type="button"
                      onClick={() => moveToStep("booking")}
                      className="inline-flex items-center gap-2 rounded-lg border border-hairline bg-surface px-3 py-2 text-sm font-semibold hover:bg-page"
                    >
                      Next <ArrowRight size={15} />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={finish}
                    disabled={!profileSaved || finishing}
                    className="inline-flex items-center gap-2 rounded-lg bg-ink px-3 py-2 text-sm font-semibold text-white hover:bg-brand-900 disabled:opacity-60"
                  >
                    <Check size={15} /> {finishing ? "Finishing..." : "Finish setup"}
                  </button>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
    </main>
  );
}
