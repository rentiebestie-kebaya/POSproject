"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Building2, LogIn } from "lucide-react";
import { useTenant } from "../data/store";
import { ROLE_LABEL } from "../data/mock";

function initialsOf(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

export default function Login() {
  const { isAuthenticated, sessionReady, login, platform } = useTenant();
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(null);

  // Already signed in — no reason to show the login screen.
  useEffect(() => {
    if (sessionReady && isAuthenticated) router.replace("/app");
  }, [sessionReady, isAuthenticated, router]);

  if (!sessionReady || isAuthenticated) return null;

  const signIn = (userId: string) => {
    login(userId);
    router.replace("/app");
  };

  return (
    <div className="flex min-h-screen">
      {/* Brand panel — hidden on small screens */}
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
            Kelola sewa kebaya, dari satu tempat.
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-brand-200">
            Inventory, booking, POS, dan keuangan untuk butik kebaya modern.
            Masuk dengan akun stafmu untuk mulai.
          </p>
        </div>

        <p className="text-xs text-brand-400">© 2026 RENTIE · Prototype</p>
      </div>

      {/* Sign-in panel */}
      <div className="flex w-full items-center justify-center bg-page px-6 py-12 lg:w-1/2">
        <div className="w-full max-w-md">
          <Link href="/" className="mb-8 flex items-center gap-2 lg:hidden">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gold-500 font-bold text-brand-900">
              R
            </div>
            <span className="text-base font-semibold tracking-wide">RENTIE</span>
          </Link>
          <Link
            href="/"
            className="mb-4 hidden items-center gap-1.5 text-xs text-ink-3 hover:text-ink lg:inline-flex"
          >
            <ArrowLeft size={13} /> Kembali ke beranda
          </Link>

          <h2 className="flex items-center gap-2 text-xl font-semibold">
            <LogIn size={20} className="text-brand-600" /> Masuk ke akunmu
          </h2>
          <p className="mt-1 text-sm text-ink-2">
            Pilih akun staf untuk masuk. Prototipe — tidak perlu kata sandi.
          </p>

          <div className="mt-6 space-y-6">
            {platform.tenants.map((t) => {
              const team = platform.users.filter((u) => u.tenantId === t.id);
              return (
                <div key={t.id}>
                  <div className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-ink-3">
                    <Building2 size={13} /> {t.name}
                    <span className="text-hairline">·</span>
                    <span className="normal-case tracking-normal text-ink-3">{t.outlet}</span>
                  </div>
                  <div className="space-y-2">
                    {team.map((u) => {
                      const active = selected === u.id;
                      return (
                        <button
                          key={u.id}
                          type="button"
                          onMouseEnter={() => setSelected(u.id)}
                          onFocus={() => setSelected(u.id)}
                          onClick={() => signIn(u.id)}
                          className={`group flex w-full items-center gap-3 rounded-xl border bg-surface px-3 py-2.5 text-left transition-colors ${
                            active
                              ? "border-brand-400 ring-1 ring-brand-200"
                              : "border-hairline hover:border-brand-300"
                          }`}
                        >
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-semibold text-white">
                            {initialsOf(u.name)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-medium">{u.name}</div>
                            <div className="text-xs text-ink-3">{ROLE_LABEL[u.role]}</div>
                          </div>
                          <ArrowRight
                            size={16}
                            className="shrink-0 text-ink-3 opacity-0 transition-opacity group-hover:opacity-100"
                          />
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
