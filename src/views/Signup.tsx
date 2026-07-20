"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, ArrowRight, Building2, MapPin, Phone, UserRound } from "lucide-react";
import { useTenant } from "../data/store";
import { PLAN_LABEL, type Plan } from "../data/mock";
import { PLAN_RULES, limitText } from "../data/plans";

const inputCls =
  "w-full rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-400";
const labelCls = "mb-1.5 block text-xs font-semibold text-ink-2";

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/\.rentie\.id$/i, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
}

export default function Signup() {
  const { createStore, isAuthenticated, platform, sessionReady } = useTenant();
  const router = useRouter();
  const [storeName, setStoreName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [location, setLocation] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [plan, setPlan] = useState<Plan>("free");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (sessionReady && isAuthenticated && !creating) router.replace("/app");
  }, [sessionReady, isAuthenticated, creating, router]);

  const generatedSlug = useMemo(() => {
    const base = slugify(storeName);
    if (!base) return "";
    const slugExists = (value: string) =>
      platform.tenants.some((tenant) => {
        const existingSlug = tenant.subdomain.split(".")[0].toLowerCase();
        return tenant.id === value || existingSlug === value;
      });
    if (!slugExists(base)) return base;
    for (let i = 2; i < 100; i += 1) {
      const next = `${base}-${i}`;
      if (!slugExists(next)) return next;
    }
    return `${base}-${Date.now().toString(36).slice(-4)}`;
  }, [platform.tenants, storeName]);
  const canSubmit =
    storeName.trim().length > 1 &&
    ownerName.trim().length > 1 &&
    location.trim().length > 1 &&
    whatsapp.trim().length > 5 &&
    generatedSlug.length > 1;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setCreating(true);
    try {
      createStore({
        storeName,
        ownerName,
        location,
        whatsapp,
        bookingSlug: generatedSlug,
        plan,
      });
      router.replace("/onboarding");
    } catch (err) {
      setCreating(false);
      setError(err instanceof Error ? err.message : "Could not create store.");
    }
  };

  if (!sessionReady || isAuthenticated) return null;

  return (
    <div className="flex min-h-screen bg-page">
      <div className="relative hidden w-1/2 flex-col justify-between bg-brand-900 p-12 text-brand-100 lg:flex">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gold-500 text-lg font-bold text-brand-900">
            R
          </div>
          <div>
            <div className="text-lg font-semibold tracking-wide text-white">RENTIE</div>
            <div className="text-xs text-brand-300">Kebaya Rental OS</div>
          </div>
        </Link>

        <div className="max-w-sm">
          <h1 className="text-3xl font-semibold leading-tight text-white">
            Mulai dari workspace kosong milik butikmu.
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-brand-200">
            Store baru dibuat dengan akun owner, booking page, dan data awal kosong.
          </p>
        </div>

        <p className="text-xs text-brand-400">© 2026 RENTIE · Prototype</p>
      </div>

      <div className="flex w-full items-center justify-center px-6 py-12 lg:w-1/2">
        <div className="w-full max-w-md">
          <Link
            href="/"
            className="mb-5 inline-flex items-center gap-1.5 text-xs text-ink-3 hover:text-ink"
          >
            <ArrowLeft size={13} /> Kembali ke beranda
          </Link>

          <h2 className="flex items-center gap-2 text-xl font-semibold">
            <Building2 size={20} className="text-brand-600" /> Buat store RENTIE
          </h2>
          <p className="mt-1 text-sm text-ink-2">
            Akun pertama akan menjadi owner store.
          </p>

          <form onSubmit={submit} className="mt-6 space-y-4">
            <div>
              <label className={labelCls} htmlFor="storeName">
                Nama store
              </label>
              <div className="relative">
                <Building2 size={16} className="absolute left-3 top-3 text-ink-3" />
                <input
                  id="storeName"
                  value={storeName}
                  onChange={(event) => setStoreName(event.target.value)}
                  className={`${inputCls} pl-9`}
                  placeholder="Griya Kebaya Melati"
                  autoComplete="organization"
                />
              </div>
            </div>

            <div>
              <label className={labelCls} htmlFor="ownerName">
                Nama owner
              </label>
              <div className="relative">
                <UserRound size={16} className="absolute left-3 top-3 text-ink-3" />
                <input
                  id="ownerName"
                  value={ownerName}
                  onChange={(event) => setOwnerName(event.target.value)}
                  className={`${inputCls} pl-9`}
                  placeholder="Ayu Lestari"
                  autoComplete="name"
                />
              </div>
            </div>

            <div>
              <label className={labelCls} htmlFor="location">
                Store location
              </label>
              <div className="relative">
                <MapPin size={16} className="absolute left-3 top-3 text-ink-3" />
                <input
                  id="location"
                  value={location}
                  onChange={(event) => setLocation(event.target.value)}
                  className={`${inputCls} pl-9`}
                  placeholder="Kemang, Jakarta Selatan"
                  autoComplete="street-address"
                />
              </div>
            </div>

            <div>
              <label className={labelCls} htmlFor="whatsapp">
                WhatsApp Business
              </label>
              <div className="relative">
                <Phone size={16} className="absolute left-3 top-3 text-ink-3" />
                <input
                  id="whatsapp"
                  value={whatsapp}
                  onChange={(event) => setWhatsapp(event.target.value)}
                  className={`${inputCls} pl-9`}
                  placeholder="+62 812-0000-1234"
                  autoComplete="tel"
                />
              </div>
            </div>

            <div>
              <div className={labelCls}>Plan</div>
              <div className="grid gap-2">
                {(Object.keys(PLAN_LABEL) as Plan[]).map((planId) => {
                  const rules = PLAN_RULES[planId];
                  const selected = plan === planId;
                  return (
                    <button
                      key={planId}
                      type="button"
                      onClick={() => setPlan(planId)}
                      className={`rounded-xl border px-3 py-3 text-left transition-colors ${
                        selected
                          ? "border-brand-500 bg-brand-50 ring-1 ring-brand-200"
                          : "border-black/10 bg-white hover:border-brand-300"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-semibold">{PLAN_LABEL[planId]}</span>
                        {planId !== "free" && (
                          <span className="rounded-full bg-warning/20 px-2 py-0.5 text-[11px] font-medium text-gold-600">
                            Billing pending
                          </span>
                        )}
                      </div>
                      <div className="mt-1 text-xs leading-5 text-ink-2">
                        {limitText(rules.inventoryLimit)} inventory · {rules.staffLimit} total user
                        {rules.staffLimit > 1 ? "s" : ""} · {rules.publicBookingEnabled ? "Public booking" : "No public booking"}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-xl border border-critical/20 bg-critical/5 px-3 py-2.5 text-sm text-critical">
                <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={!canSubmit}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-ink px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-900 disabled:cursor-not-allowed disabled:opacity-45"
            >
              Buat store <ArrowRight size={16} />
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-ink-2">
            Sudah punya akun?{" "}
            <Link href="/login" className="font-semibold text-brand-700 hover:text-brand-900">
              Masuk
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
