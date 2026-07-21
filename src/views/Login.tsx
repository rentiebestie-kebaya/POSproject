"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, LogIn } from "lucide-react";
import { useTenant } from "../data/store";
import { authClient } from "@/lib/auth-client";

export default function Login() {
  const { isAuthenticated, sessionReady, refreshSession } = useTenant();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Already signed in — no reason to show the login screen.
  useEffect(() => {
    if (sessionReady && isAuthenticated) router.replace("/app");
  }, [sessionReady, isAuthenticated, router]);

  if (!sessionReady || isAuthenticated) return null;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    const { error: signInError } = await authClient.signIn.email({
      email: email.trim(),
      password,
    });
    if (signInError) {
      setError(signInError.message ?? "Email atau kata sandi salah.");
      setSubmitting(false);
      return;
    }
    // Cookie is set — re-read the server-validated session, then enter the app.
    await refreshSession();
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
            Masuk dengan email dan kata sandi akunmu.
          </p>
          <p className="mt-3 text-sm text-ink-2">
            Belum punya store?{" "}
            <Link href="/signup" className="font-semibold text-brand-700 hover:text-brand-900">
              Buat store baru
            </Link>
          </p>

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div>
              <label htmlFor="email" className="mb-1 block text-xs font-medium text-ink-2">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-hairline bg-surface px-3 py-2.5 text-sm outline-none transition-colors focus:border-brand-400 focus:ring-1 focus:ring-brand-200"
                placeholder="owner@butik.com"
              />
            </div>
            <div>
              <label htmlFor="password" className="mb-1 block text-xs font-medium text-ink-2">
                Kata sandi
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-hairline bg-surface px-3 py-2.5 text-sm outline-none transition-colors focus:border-brand-400 focus:ring-1 focus:ring-brand-200"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-3 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-60"
            >
              <LogIn size={16} /> {submitting ? "Memproses…" : "Masuk"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
