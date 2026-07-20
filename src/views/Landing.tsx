"use client";

import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  LineChart,
  QrCode,
  ScanLine,
  ShieldCheck,
  Shirt,
  ShoppingBag,
  Sparkles,
  Users,
  Wallet,
} from "lucide-react";
import { useTenant } from "../data/store";

const FEATURES = [
  {
    icon: Shirt,
    title: "Inventory koleksi ber-QR",
    body: "Katalog kebaya & dress lengkap dengan ukuran detail (LD, pinggang, panjang), grade kondisi, foto, dan kode QR per potong.",
  },
  {
    icon: CalendarDays,
    title: "Booking anti bentrok",
    body: "Cek tanggal otomatis sebelum transaksi. Item bisa tersedia tapi sudah dipesan untuk tanggal tertentu — sistem yang jaga, bukan ingatan.",
  },
  {
    icon: ShoppingBag,
    title: "Kasir sewa–kembali",
    body: "Transaksi buka (sewa keluar) dan tutup (pengembalian) dalam satu alur kasir, lengkap dengan struk otomatis untuk pelanggan.",
  },
  {
    icon: Wallet,
    title: "Deposit & denda otomatis",
    body: "Deposit tercatat saat sewa, dipotong otomatis untuk telat atau kerusakan saat pengembalian. Sisa refund langsung terhitung.",
  },
  {
    icon: Users,
    title: "Database pelanggan",
    body: "Ukuran badan pelanggan tersimpan dan riwayat sewa lengkap — repeat order jadi lebih cepat, fitting jadi lebih akurat.",
  },
  {
    icon: LineChart,
    title: "Laporan keuangan",
    body: "Omzet bulanan, deposit yang dipegang, metode pembayaran (QRIS, e-wallet, tunai) — semua terekap tanpa buku catatan.",
  },
];

const STEPS = [
  {
    n: "1",
    title: "Daftarkan koleksi",
    body: "Input kebaya & dress beserta ukuran, harga sewa, dan foto. Tempel QR di setiap potong.",
  },
  {
    n: "2",
    title: "Terima booking & proses di kasir",
    body: "Pelanggan pilih tanggal, sistem cek bentrok, kasir proses sewa dan pengembalian.",
  },
  {
    n: "3",
    title: "Pantau bisnis dari dashboard",
    body: "Omzet, utilisasi koleksi, jadwal kembali, dan pelanggan setia — semua dalam satu layar.",
  },
];

const PLANS = [
  {
    name: "Starter",
    price: "Rp 99.000",
    tagline: "Untuk butik yang baru mulai",
    features: ["1 outlet", "Sampai 100 koleksi", "Kasir & booking", "Struk digital"],
    highlight: false,
  },
  {
    name: "Pro",
    price: "Rp 249.000",
    tagline: "Untuk butik yang berkembang",
    features: [
      "Multi staf & peran",
      "Koleksi tanpa batas",
      "Laporan keuangan lengkap",
      "Katalog online (segera)",
    ],
    highlight: true,
  },
];

const STATS = [
  { label: "Booking diproses", value: "1.240+", sub: "tanpa satu pun bentrok" },
  { label: "Bentrok dicegah", value: "87", sub: "tanggal ditolak otomatis" },
  { label: "Omzet terekap", value: "Rp 320 jt", sub: "QRIS, e-wallet, tunai" },
];

const COLLECTION = [
  { name: "Janggan Emerald", size: "M · LD 92", status: "Disewa s/d 24 Jul", tone: "warn" },
  { name: "Kutubaru Blush", size: "S · LD 86", status: "Tersedia", tone: "good" },
  { name: "Kartini Ivory", size: "L · LD 98", status: "Booking 26 Jul", tone: "brand" },
  { name: "Encim Sakura", size: "M · LD 90", status: "Tersedia", tone: "good" },
  { name: "Bali Songket Gold", size: "XL · LD 104", status: "Disewa s/d 21 Jul", tone: "warn" },
  { name: "Modern Sage", size: "S · LD 84", status: "Tersedia", tone: "good" },
  { name: "Janggan Maroon", size: "M · LD 92", status: "Booking 30 Jul", tone: "brand" },
  { name: "Kutubaru Navy", size: "L · LD 96", status: "Tersedia", tone: "good" },
];

const STATUS_TONE: Record<string, string> = {
  good: "bg-brand-50 text-good-text",
  warn: "bg-gold-400/15 text-gold-600",
  brand: "bg-brand-100 text-brand-700",
};

export default function Landing() {
  const { isAuthenticated } = useTenant();

  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <header className="sticky top-0 z-20 border-b border-black/5 bg-white/80 backdrop-blur-lg">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6">
          <a href="#" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-900 text-sm font-bold text-gold-400">
              R
            </div>
            <span className="text-lg font-semibold tracking-tight">rentie</span>
          </a>
          <nav className="hidden items-center gap-8 text-sm font-medium text-ink-2 md:flex">
            <a href="#fitur" className="transition hover:text-ink">Fitur</a>
            <a href="#koleksi" className="transition hover:text-ink">Koleksi</a>
            <a href="#cara-kerja" className="transition hover:text-ink">Cara kerja</a>
            <a href="#harga" className="transition hover:text-ink">Harga</a>
          </nav>
          <Link
            href={isAuthenticated ? "/app" : "/login"}
            className="rounded-full border border-ink/15 px-5 py-2 text-sm font-medium transition hover:border-ink/40"
          >
            {isAuthenticated ? "Buka Dashboard" : "Coba Demo"}
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        {/* soft gradient backdrop */}
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute -top-32 left-1/2 h-[34rem] w-[64rem] -translate-x-1/2 rounded-full bg-brand-100 blur-3xl" />
          <div className="absolute top-24 -left-32 h-80 w-80 rounded-full bg-gold-400/20 blur-3xl" />
          <div className="absolute top-40 -right-24 h-96 w-96 rounded-full bg-brand-200/60 blur-3xl" />
        </div>

        <div className="relative mx-auto w-full max-w-4xl px-6 pt-24 pb-16 text-center lg:pt-32">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-white/70 px-4 py-1.5 text-xs font-medium text-brand-700 backdrop-blur">
            
            Aplikasi Kasir Khusus Rental Kebaya & Dress
          </span>
          <h1 className="mt-8 text-5xl font-semibold leading-[1.08] tracking-tight text-ink sm:text-6xl lg:text-7xl">
            Dirancang khusus untuk usaha penyewaan kebaya & dress kamu.
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-ink-2">
            Fitur kasir, cetak struk, stok kebaya, ketersediaan, booking, keuagan, dan masih banyak lagi. Semua dalam satu aplikasi.
          </p>
           <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-ink-2">
            RENTIE - Rental Bestie
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-full bg-ink px-7 py-3.5 text-sm font-semibold text-white transition hover:scale-[1.03] hover:bg-brand-900"
            >
              Coba Demo Gratis
            </Link>
            <a
              href="#fitur"
              className="inline-flex items-center gap-1.5 rounded-full px-5 py-3.5 text-sm font-medium text-ink-2 transition hover:text-ink"
            >
              Lihat fitur <ArrowRight size={15} />
            </a>
          </div>
        </div>

        {/* Hero widget — availability checker mock */}
        <div className="relative mx-auto w-full max-w-3xl px-6 pb-20">
          <div className="rounded-3xl border border-black/5 bg-white p-4 shadow-[0_24px_80px_-24px_rgba(53,20,31,0.25)] sm:p-6">
            <div className="flex flex-wrap gap-2">
              {["Cek Ketersediaan", "Kasir", "Booking", "Inventory"].map((tab, i) => (
                <span
                  key={tab}
                  className={`rounded-full px-4 py-2 text-xs font-medium ${
                    i === 0
                      ? "bg-brand-900 text-white"
                      : "border border-black/10 text-ink-2"
                  }`}
                >
                  {tab}
                </span>
              ))}
            </div>
            <div className="mt-4 flex items-center gap-3 rounded-2xl border border-black/10 bg-page px-4 py-3.5 text-left">
              <ScanLine size={18} className="shrink-0 text-ink-3" />
              <span className="flex-1 truncate text-sm text-ink-2">
                Janggan Emerald · 21–24 Jul
              </span>
              <span className="rounded-full bg-brand-700 px-4 py-2 text-xs font-semibold text-white">
                Cek
              </span>
            </div>
            <div className="mt-3 flex items-center gap-2.5 rounded-2xl bg-brand-50 px-4 py-3.5 text-left text-sm">
              <ShieldCheck size={17} className="shrink-0 text-good-text" />
              <span className="text-ink-2">
                <span className="font-semibold text-ink">Aman disewa</span> 21–24 Jul — tidak
                ada bentrok dengan booking lain.
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Stat band */}
      <section className="border-y border-black/5 bg-page">
        <div className="mx-auto w-full max-w-6xl px-6 py-16">
          <div className="grid gap-10 lg:grid-cols-[1fr_auto] lg:items-center lg:gap-16">
            <div>
              <div className="text-xs font-semibold uppercase tracking-widest text-ink-3">
                Dipercaya butik sewa
              </div>
              <p className="mt-3 max-w-md text-lg leading-relaxed text-ink">
                Dari catatan WhatsApp dan buku tulis, naik kelas ke sistem.{" "}
                <span className="text-ink-3">
                  Setiap potong terpantau, setiap tanggal terjaga.
                </span>
              </p>
            </div>
            <div className="grid grid-cols-1 gap-8 sm:grid-cols-3 sm:gap-12">
              {STATS.map((s) => (
                <div key={s.label}>
                  <div className="text-xs font-semibold uppercase tracking-widest text-ink-3">
                    {s.label}
                  </div>
                  <div className="mt-2 text-4xl font-semibold tracking-tight">{s.value}</div>
                  <div className="mt-1 text-xs text-ink-3">{s.sub}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Testimonial */}
      <section className="mx-auto w-full max-w-3xl px-6 py-24 text-center">
        <p className="text-2xl font-medium leading-snug tracking-tight text-ink sm:text-3xl">
          “Dulu tiap weekend deg-degan takut ada dua pelanggan pesan kebaya yang sama.
          Sekarang sistem yang jaga — saya tinggal fokus ke fitting dan pelanggan.”
        </p>
        <div className="mt-6 text-sm text-ink-3">
          Melati Hapsari · Pemilik, Griya Kebaya Melati
        </div>
      </section>

      {/* Features */}
      <section id="fitur" className="mx-auto w-full max-w-6xl px-6 py-20">
        <div className="max-w-2xl">
          <h2 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            semua yang butik sewa butuhkan.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-ink-2">
            Dirancang khusus untuk alur bisnis rental kebaya & dress — bukan aplikasi kasir
            umum yang dipaksakan.
          </p>
        </div>
        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <div
              key={title}
              className="rounded-3xl border border-black/5 bg-page p-7 transition hover:-translate-y-1 hover:shadow-[0_20px_50px_-24px_rgba(53,20,31,0.3)]"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-brand-600 shadow-sm">
                <Icon size={19} strokeWidth={1.8} />
              </div>
              <h3 className="mt-5 text-base font-semibold">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-2">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Collection marquee */}
      <section id="koleksi" className="overflow-hidden border-y border-black/5 bg-page py-20">
        <div className="mx-auto w-full max-w-6xl px-6">
          <h2 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            koleksi yang selalu terpantau.
          </h2>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-ink-2">
            Setiap potong punya QR, status, dan jadwalnya sendiri. Scan di kasir — riwayatnya
            langsung muncul.
          </p>
        </div>
        <div className="mt-12 flex w-max animate-marquee gap-5 pl-6">
          {[...COLLECTION, ...COLLECTION].map((item, i) => (
            <div
              key={`${item.name}-${i}`}
              className="w-64 shrink-0 rounded-3xl border border-black/5 bg-white p-5 shadow-sm"
            >
              <div className="flex h-28 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-100 to-brand-200/60 text-brand-400">
                <Shirt size={36} strokeWidth={1.4} />
              </div>
              <div className="mt-4 flex items-start justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold">{item.name}</div>
                  <div className="mt-0.5 text-xs text-ink-3">{item.size}</div>
                </div>
                <QrCode size={16} className="mt-0.5 shrink-0 text-ink-3" />
              </div>
              <span
                className={`mt-3 inline-block rounded-full px-3 py-1 text-[11px] font-medium ${STATUS_TONE[item.tone]}`}
              >
                {item.status}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="cara-kerja" className="mx-auto w-full max-w-6xl px-6 py-24">
        <h2 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          mulai dalam tiga langkah.
        </h2>
        <div className="mt-14 grid gap-5 md:grid-cols-3">
          {STEPS.map(({ n, title, body }) => (
            <div key={n} className="rounded-3xl border border-black/5 bg-page p-7">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-900 text-sm font-semibold text-gold-400">
                {n}
              </div>
              <h3 className="mt-5 text-base font-semibold">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-2">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="harga" className="mx-auto w-full max-w-6xl px-6 pb-24">
        <div className="max-w-2xl">
          <h2 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            harga peluncuran.
          </h2>
          <p className="mt-4 text-base text-ink-2">Berlangganan bulanan, berhenti kapan saja.</p>
        </div>
        <div className="mt-14 grid max-w-4xl gap-5 md:grid-cols-2">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className={`rounded-3xl p-8 ${
                plan.highlight
                  ? "bg-brand-900 text-brand-100"
                  : "border border-black/5 bg-page"
              }`}
            >
              <div className="flex items-center justify-between">
                <h3
                  className={`text-sm font-semibold ${plan.highlight ? "text-white" : ""}`}
                >
                  {plan.name}
                </h3>
                {plan.highlight && (
                  <span className="rounded-full bg-gold-400/15 px-3 py-1 text-[11px] font-medium text-gold-400">
                    Paling laris
                  </span>
                )}
              </div>
              <div
                className={`mt-4 text-4xl font-semibold tracking-tight ${
                  plan.highlight ? "text-white" : ""
                }`}
              >
                {plan.price}
                <span
                  className={`text-sm font-normal ${
                    plan.highlight ? "text-brand-300" : "text-ink-3"
                  }`}
                >
                  /bulan
                </span>
              </div>
              <p
                className={`mt-1.5 text-sm ${
                  plan.highlight ? "text-brand-200" : "text-ink-2"
                }`}
              >
                {plan.tagline}
              </p>
              <ul className="mt-6 space-y-3">
                {plan.features.map((f) => (
                  <li
                    key={f}
                    className={`flex items-center gap-2.5 text-sm ${
                      plan.highlight ? "text-brand-100" : "text-ink-2"
                    }`}
                  >
                    <Check
                      size={15}
                      className={`shrink-0 ${
                        plan.highlight ? "text-gold-400" : "text-good-text"
                      }`}
                    />
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href="/login"
                className={`mt-8 block rounded-full px-5 py-3 text-center text-sm font-semibold transition ${
                  plan.highlight
                    ? "bg-gold-500 text-brand-900 hover:bg-gold-400"
                    : "border border-ink/15 hover:border-ink/40"
                }`}
              >
                Coba Demo
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* CTA band */}
      <section className="mx-auto w-full max-w-6xl px-6 pb-24">
        <div className="relative overflow-hidden rounded-3xl bg-brand-900 px-6 py-20 text-center sm:px-12">
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <div className="absolute -top-24 left-1/4 h-64 w-64 rounded-full bg-brand-700/50 blur-3xl" />
            <div className="absolute -bottom-24 right-1/4 h-64 w-64 rounded-full bg-gold-500/15 blur-3xl" />
          </div>
          <h2 className="relative mx-auto max-w-2xl text-3xl font-semibold leading-tight tracking-tight text-white sm:text-5xl">
            kami membuat rentie untuk butik yang menolak kehilangan satu tanggal pun.
          </h2>
          <Link
            href="/login"
            className="relative mt-10 inline-flex items-center gap-2 rounded-full bg-gold-500 px-7 py-3.5 text-sm font-semibold text-brand-900 transition hover:scale-[1.03] hover:bg-gold-400"
          >
            Masuk ke Demo <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-black/5 bg-page">
        <div className="mx-auto w-full max-w-6xl px-6 py-14">
          <div className="grid gap-10 sm:grid-cols-[1fr_auto_auto] sm:gap-20">
            <div>
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-900 text-sm font-bold text-gold-400">
                  R
                </div>
                <span className="text-lg font-semibold tracking-tight">rentie</span>
              </div>
              <p className="mt-3 max-w-xs text-sm leading-relaxed text-ink-3">
                Aplikasi Kasir Khusus Rental Kebaya & Dress. Satu sistem untuk inventory, booking,
                kasir, dan keuangan butik kamu.
              </p>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-widest text-ink-3">
                Produk
              </div>
              <ul className="mt-4 space-y-2.5 text-sm text-ink-2">
                <li><a href="#fitur" className="hover:text-ink">Fitur</a></li>
                <li><a href="#koleksi" className="hover:text-ink">Koleksi</a></li>
                <li><a href="#harga" className="hover:text-ink">Harga</a></li>
              </ul>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-widest text-ink-3">
                Akses
              </div>
              <ul className="mt-4 space-y-2.5 text-sm text-ink-2">
                <li><Link href="/login" className="hover:text-ink">Masuk</Link></li>
                <li>
                  <Link href="/dev" className="inline-flex items-center gap-1 hover:text-ink">
                    Developer Console <ArrowUpRight size={13} />
                  </Link>
                </li>
              </ul>
            </div>
          </div>
          <div className="mt-12 border-t border-black/5 pt-6 text-xs text-ink-3">
            © 2026 RENTIE · Aplikasi Kasir Khusus Rental Kebaya & Dress. · Prototype
          </div>
        </div>
      </footer>
    </div>
  );
}
