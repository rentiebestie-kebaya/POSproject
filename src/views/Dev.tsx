"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Building2, LogOut, Plus, ShieldCheck, Trash2, Users as UsersIcon } from "lucide-react";
import { Card, Td, Th } from "../components/Ui";
import { useTenant } from "../data/store";
import { ROLE_LABEL, formatIDR, type Role } from "../data/mock";

const ROLES = Object.keys(ROLE_LABEL) as Role[];

/** Platform-owner console — manages tenants & users across ALL shops.
    Guarded by its own prototype dev session, separate from staff login. */
export default function Dev() {
  const { platform, isAuthenticated, user, sessionReady } = useTenant();
  const router = useRouter();

  // Wait for the persisted dev session before deciding to show the gate.
  if (!sessionReady) return null;
  if (!platform.devAuthed) return <DevGate onEnter={platform.devLogin} />;

  const { tenants, users, datasets } = platform;
  const signedInId = isAuthenticated ? user.id : null;
  const totalItems = tenants.reduce((sum, t) => sum + datasets[t.id].inventory.length, 0);
  const totalRevenue = tenants.reduce(
    (sum, t) => sum + (datasets[t.id].monthlyRevenue.at(-1)?.revenue ?? 0),
    0,
  );

  return (
    <div className="min-h-screen bg-page">
      <header className="sticky top-0 z-10 bg-brand-900 text-brand-100">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gold-500 text-sm font-bold text-brand-900">
              R
            </div>
            <span className="text-sm font-semibold tracking-wide text-white">RENTIE</span>
            <span className="rounded-full border border-brand-700 bg-brand-800 px-2 py-0.5 text-[11px] font-medium text-gold-400">
              Developer Console
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Link href="/" className="rounded-lg px-3 py-1.5 font-medium text-brand-200 hover:bg-brand-800 hover:text-white">
              Landing
            </Link>
            <Link href={isAuthenticated ? "/app" : "/login"} className="rounded-lg px-3 py-1.5 font-medium text-brand-200 hover:bg-brand-800 hover:text-white">
              Buka Aplikasi
            </Link>
            <button
              type="button"
              onClick={() => {
                platform.devLogout();
                router.push("/");
              }}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium text-brand-200 hover:bg-brand-800 hover:text-white"
            >
              <LogOut size={15} /> Keluar
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-6 py-8">
        {/* Platform stats */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Tenant aktif", String(tenants.length)],
            ["Total user", String(users.length)],
            ["Total koleksi", String(totalItems)],
            ["Omzet platform (Jul)", formatIDR(totalRevenue)],
          ].map(([k, v]) => (
            <Card key={k} className="p-4">
              <div className="text-xs text-ink-3">{k}</div>
              <div className="mt-1 text-2xl font-semibold">{v}</div>
            </Card>
          ))}
        </div>

        {/* Tenants */}
        <Card className="mt-6 overflow-hidden">
          <div className="flex items-center gap-2 border-b border-hairline px-5 py-4">
            <Building2 size={15} className="text-ink-3" />
            <h2 className="text-sm font-semibold">Tenant</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-hairline">
                <tr>
                  <Th>Butik</Th>
                  <Th>Subdomain</Th>
                  <Th>Outlet</Th>
                  <Th className="text-right">User</Th>
                  <Th className="text-right">Koleksi</Th>
                  <Th className="text-right">Sewa aktif</Th>
                  <Th className="text-right">Omzet (Jul)</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {tenants.map((t) => {
                  const ds = datasets[t.id];
                  return (
                    <tr key={t.id}>
                      <Td className="font-medium">{t.name}</Td>
                      <Td className="text-ink-2">{t.subdomain}</Td>
                      <Td className="text-ink-2">{t.outlet}</Td>
                      <Td className="text-right">{users.filter((u) => u.tenantId === t.id).length}</Td>
                      <Td className="text-right">{ds.inventory.length}</Td>
                      <Td className="text-right">{ds.bookings.filter((b) => b.status === "active").length}</Td>
                      <Td className="text-right font-medium">{formatIDR(ds.monthlyRevenue.at(-1)?.revenue ?? 0)}</Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        {/* User management */}
        <Card className="mt-6 overflow-hidden">
          <div className="flex items-center gap-2 border-b border-hairline px-5 py-4">
            <UsersIcon size={15} className="text-ink-3" />
            <h2 className="text-sm font-semibold">Manajemen user</h2>
            <span className="text-xs text-ink-3">— user baru langsung bisa dipakai login</span>
          </div>

          <AddUserForm />

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-hairline">
                <tr>
                  <Th>Nama</Th>
                  <Th>Butik</Th>
                  <Th>Peran</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Aksi</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {users.map((u) => {
                  const tenant = tenants.find((t) => t.id === u.tenantId)!;
                  const lastOwner =
                    u.role === "owner" &&
                    users.filter((x) => x.tenantId === u.tenantId && x.role === "owner").length <= 1;
                  return (
                    <tr key={u.id}>
                      <Td className="font-medium">{u.name}</Td>
                      <Td className="text-ink-2">{tenant.name}</Td>
                      <Td>
                        <select
                          value={u.role}
                          onChange={(e) => platform.setUserRole(u.id, e.target.value as Role)}
                          disabled={lastOwner}
                          className="rounded-lg border border-hairline bg-surface px-2 py-1 text-xs font-medium outline-none disabled:opacity-50"
                          aria-label={`Peran ${u.name}`}
                          title={lastOwner ? "Owner terakhir tidak bisa diubah" : undefined}
                        >
                          {ROLES.map((r) => (
                            <option key={r} value={r}>{ROLE_LABEL[r]}</option>
                          ))}
                        </select>
                      </Td>
                      <Td>
                        {u.id === signedInId ? (
                          <span className="rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success ring-1 ring-success/30">
                            Sedang login
                          </span>
                        ) : (
                          <span className="text-xs text-ink-3">—</span>
                        )}
                      </Td>
                      <Td className="text-right">
                        <button
                          type="button"
                          onClick={() => platform.removeUser(u.id)}
                          disabled={lastOwner}
                          className="rounded-lg p-1.5 text-critical hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-40"
                          aria-label={`Hapus ${u.name}`}
                          title={lastOwner ? "Owner terakhir tidak bisa dihapus" : `Hapus ${u.name}`}
                        >
                          <Trash2 size={15} />
                        </button>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </main>
    </div>
  );
}

function AddUserForm() {
  const { platform } = useTenant();
  const [name, setName] = useState("");
  const [tenantId, setTenantId] = useState(platform.tenants[0].id);
  const [role, setRole] = useState<Role>("cashier");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    platform.addUser({ tenantId, name, role });
    setName("");
  };

  return (
    <form onSubmit={submit} className="flex flex-wrap items-center gap-2 border-b border-hairline px-5 py-3">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Nama staf baru"
        className="min-w-48 flex-1 rounded-lg border border-hairline bg-surface px-3 py-2 text-sm outline-none focus:border-brand-400"
        aria-label="Nama staf baru"
      />
      <select
        value={tenantId}
        onChange={(e) => setTenantId(e.target.value)}
        className="rounded-lg border border-hairline bg-surface px-2 py-2 text-sm outline-none"
        aria-label="Butik"
      >
        {platform.tenants.map((t) => (
          <option key={t.id} value={t.id}>{t.name}</option>
        ))}
      </select>
      <select
        value={role}
        onChange={(e) => setRole(e.target.value as Role)}
        className="rounded-lg border border-hairline bg-surface px-2 py-2 text-sm outline-none"
        aria-label="Peran"
      >
        {ROLES.map((r) => (
          <option key={r} value={r}>{ROLE_LABEL[r]}</option>
        ))}
      </select>
      <button
        type="submit"
        disabled={!name.trim()}
        className="flex items-center gap-1.5 rounded-lg bg-brand-700 px-3.5 py-2 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-50"
      >
        <Plus size={15} /> Tambah
      </button>
    </form>
  );
}

function DevGate({ onEnter }: { onEnter: () => void }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-900 px-6">
      <div className="w-full max-w-sm rounded-2xl border border-brand-800 bg-brand-800/60 p-8 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-gold-500 text-brand-900">
          <ShieldCheck size={22} />
        </div>
        <h1 className="mt-5 text-lg font-semibold text-white">Developer Console</h1>
        <p className="mt-2 text-sm leading-relaxed text-brand-200">
          Area internal RENTIE untuk mengelola tenant dan user. Prototipe — tanpa kata sandi.
        </p>
        <button
          type="button"
          onClick={onEnter}
          className="mt-6 w-full rounded-lg bg-gold-500 px-4 py-2.5 text-sm font-semibold text-brand-900 hover:bg-gold-400"
        >
          Masuk sebagai Developer
        </button>
        <Link
          href="/"
          className="mt-4 inline-flex items-center gap-1.5 text-xs text-brand-300 hover:text-white"
        >
          <ArrowLeft size={13} /> Kembali ke beranda
        </Link>
      </div>
    </div>
  );
}
