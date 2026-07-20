"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, Building2, LogOut, Plus, ShieldCheck, SlidersHorizontal, Trash2, Users as UsersIcon } from "lucide-react";
import { Card, Td, Th } from "../components/Ui";
import { useTenant } from "../data/store";
import {
  BILLING_STATUS_LABEL,
  ONBOARDING_STATUS_LABEL,
  PLAN_LABEL,
  ROLE_LABEL,
  STORE_STATUS_LABEL,
  formatIDR,
  type BillingStatus,
  type OnboardingStatus,
  type Plan,
  type Role,
  type StoreStatus,
} from "../data/mock";
import { limitText, rulesForTenant } from "../data/plans";

const ROLES = Object.keys(ROLE_LABEL) as Role[];
const PLANS = Object.keys(PLAN_LABEL) as Plan[];
const BILLING_STATUSES = Object.keys(BILLING_STATUS_LABEL) as BillingStatus[];
const STORE_STATUSES = Object.keys(STORE_STATUS_LABEL) as StoreStatus[];
const ONBOARDING_STATUSES = Object.keys(ONBOARDING_STATUS_LABEL) as OnboardingStatus[];

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

        <CreateStoreForm />

        {/* Tenants */}
        <Card className="mt-6 overflow-hidden">
          <div className="flex items-center gap-2 border-b border-hairline px-5 py-4">
            <Building2 size={15} className="text-ink-3" />
            <h2 className="text-sm font-semibold">Tenant control</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-hairline">
                <tr>
                  <Th>Butik</Th>
                  <Th>Subdomain</Th>
                  <Th>Plan</Th>
                  <Th>Billing</Th>
                  <Th>Status</Th>
                  <Th>Onboarding</Th>
                  <Th>Outlet</Th>
                  <Th className="text-right">User</Th>
                  <Th className="text-right">Koleksi</Th>
                  <Th className="text-right">Limits</Th>
                  <Th className="text-right">Sewa aktif</Th>
                  <Th className="text-right">Omzet (Jul)</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {tenants.map((t) => {
                  const ds = datasets[t.id];
                  const rules = rulesForTenant(t);
                  return (
                    <tr key={t.id}>
                      <Td className="font-medium">{t.name}</Td>
                      <Td className="text-ink-2">{t.subdomain}</Td>
                      <Td>
                        <select
                          value={t.plan}
                          onChange={(e) => platform.updateTenantPlan(t.id, e.target.value as Plan)}
                          className="rounded-lg border border-hairline bg-surface px-2 py-1 text-xs font-medium outline-none"
                          aria-label={`Plan ${t.name}`}
                        >
                          {PLANS.map((plan) => (
                            <option key={plan} value={plan}>{PLAN_LABEL[plan]}</option>
                          ))}
                        </select>
                      </Td>
                      <Td>
                        <select
                          value={t.billingStatus}
                          onChange={(e) => platform.updateTenantBillingStatus(t.id, e.target.value as BillingStatus)}
                          className="rounded-lg border border-hairline bg-surface px-2 py-1 text-xs font-medium outline-none"
                          aria-label={`Billing ${t.name}`}
                        >
                          {BILLING_STATUSES.map((status) => (
                            <option key={status} value={status}>{BILLING_STATUS_LABEL[status]}</option>
                          ))}
                        </select>
                      </Td>
                      <Td>
                        <select
                          value={t.status}
                          onChange={(e) => platform.updateTenantStatus(t.id, e.target.value as StoreStatus)}
                          className="rounded-lg border border-hairline bg-surface px-2 py-1 text-xs font-medium outline-none"
                          aria-label={`Status ${t.name}`}
                        >
                          {STORE_STATUSES.map((status) => (
                            <option key={status} value={status}>{STORE_STATUS_LABEL[status]}</option>
                          ))}
                        </select>
                      </Td>
                      <Td>
                        <select
                          value={t.onboardingStatus}
                          onChange={(e) => platform.updateTenantOnboardingStatus(t.id, e.target.value as OnboardingStatus)}
                          className="rounded-lg border border-hairline bg-surface px-2 py-1 text-xs font-medium outline-none"
                          aria-label={`Onboarding ${t.name}`}
                        >
                          {ONBOARDING_STATUSES.map((status) => (
                            <option key={status} value={status}>{ONBOARDING_STATUS_LABEL[status]}</option>
                          ))}
                        </select>
                      </Td>
                      <Td className="text-ink-2">{t.outlet}</Td>
                      <Td className="text-right">{users.filter((u) => u.tenantId === t.id).length}</Td>
                      <Td className="text-right">{ds.inventory.length}</Td>
                      <Td className="text-right text-xs text-ink-2">
                        {ds.inventory.length}/{limitText(rules.inventoryLimit)} items · {users.filter((u) => u.tenantId === t.id).length}/{rules.staffLimit} users
                      </Td>
                      <Td className="text-right">{ds.bookings.filter((b) => b.status === "active").length}</Td>
                      <Td className="text-right font-medium">{formatIDR(ds.monthlyRevenue.at(-1)?.revenue ?? 0)}</Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        <TenantOverrides />

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

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/\.rentie\.id$/i, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
}

function CreateStoreForm() {
  const { platform } = useTenant();
  const [storeName, setStoreName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [outlet, setOutlet] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [bookingSlug, setBookingSlug] = useState("");
  const [plan, setPlan] = useState<Plan>("free");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const effectiveSlug = slugify(bookingSlug || storeName);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setMessage("");
    setError("");
    try {
      const result = platform.createStore({
        storeName,
        ownerName,
        outlet,
        whatsapp,
        bookingSlug: effectiveSlug,
        plan,
      });
      setStoreName("");
      setOwnerName("");
      setOutlet("");
      setWhatsapp("");
      setBookingSlug("");
      setPlan("free");
      setMessage(`${result.tenant.name} created with ${PLAN_LABEL[result.tenant.plan]} plan.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create store.");
    }
  };

  return (
    <Card className="mt-6 overflow-hidden">
      <div className="flex items-center gap-2 border-b border-hairline px-5 py-4">
        <Plus size={15} className="text-ink-3" />
        <h2 className="text-sm font-semibold">Create store manually</h2>
        <span className="text-xs text-ink-3">/dev creates records only; it does not login as tenant user</span>
      </div>
      <form onSubmit={submit} className="grid gap-2 border-b border-hairline px-5 py-3 lg:grid-cols-6">
        <input
          value={storeName}
          onChange={(event) => setStoreName(event.target.value)}
          placeholder="Store name"
          className="rounded-lg border border-hairline bg-surface px-3 py-2 text-sm outline-none focus:border-brand-400"
        />
        <input
          value={ownerName}
          onChange={(event) => setOwnerName(event.target.value)}
          placeholder="Owner name"
          className="rounded-lg border border-hairline bg-surface px-3 py-2 text-sm outline-none focus:border-brand-400"
        />
        <input
          value={outlet}
          onChange={(event) => setOutlet(event.target.value)}
          placeholder="Outlet"
          className="rounded-lg border border-hairline bg-surface px-3 py-2 text-sm outline-none focus:border-brand-400"
        />
        <input
          value={whatsapp}
          onChange={(event) => setWhatsapp(event.target.value)}
          placeholder="WhatsApp"
          className="rounded-lg border border-hairline bg-surface px-3 py-2 text-sm outline-none focus:border-brand-400"
        />
        <div className="flex overflow-hidden rounded-lg border border-hairline bg-surface">
          <input
            value={bookingSlug || effectiveSlug}
            onChange={(event) => setBookingSlug(slugify(event.target.value))}
            placeholder="booking-url"
            className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm outline-none"
          />
          <span className="border-l border-hairline px-2 py-2 text-xs text-ink-3">.rentie.id</span>
        </div>
        <div className="flex gap-2">
          <select
            value={plan}
            onChange={(event) => setPlan(event.target.value as Plan)}
            className="min-w-0 flex-1 rounded-lg border border-hairline bg-surface px-2 py-2 text-sm outline-none"
          >
            {PLANS.map((planId) => (
              <option key={planId} value={planId}>{PLAN_LABEL[planId]}</option>
            ))}
          </select>
          <button
            type="submit"
            disabled={!storeName.trim() || !ownerName.trim() || !outlet.trim() || !whatsapp.trim() || !effectiveSlug}
            className="rounded-lg bg-brand-700 px-3 py-2 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-50"
          >
            Create
          </button>
        </div>
      </form>
      {(message || error) && (
        <div className={`flex items-center gap-2 px-5 py-3 text-sm ${error ? "text-critical" : "text-good-text"}`}>
          {error ? <AlertTriangle size={15} /> : <ShieldCheck size={15} />}
          {error || message}
        </div>
      )}
    </Card>
  );
}

function TenantOverrides() {
  const { platform } = useTenant();
  const [tenantId, setTenantId] = useState(platform.tenants[0]?.id ?? "");
  const tenant = platform.tenants.find((row) => row.id === tenantId) ?? platform.tenants[0];
  const rules = tenant ? rulesForTenant(tenant) : null;

  if (!tenant || !rules) return null;

  const updateNumber = (key: "inventoryLimit" | "staffLimit", value: string) => {
    platform.updateTenantOverrides(tenant.id, { [key]: value === "" ? undefined : Number(value) });
  };

  const updateBool = (key: "publicBookingEnabled" | "manualBookingEnabled" | "exportEnabled", value: string) => {
    platform.updateTenantOverrides(tenant.id, { [key]: value === "default" ? null : value === "true" });
  };

  return (
    <Card className="mt-6 p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <SlidersHorizontal size={15} className="text-ink-3" /> Store overrides
        </h2>
        <select
          value={tenant.id}
          onChange={(event) => setTenantId(event.target.value)}
          className="rounded-lg border border-hairline bg-surface px-2 py-2 text-sm outline-none"
          aria-label="Override tenant"
        >
          {platform.tenants.map((row) => (
            <option key={row.id} value={row.id}>{row.name}</option>
          ))}
        </select>
      </div>

      <div className="grid gap-3 md:grid-cols-5">
        <label>
          <span className="mb-1 block text-xs font-medium text-ink-2">Inventory limit</span>
          <input
            type="number"
            min={0}
            value={tenant.limitOverrides?.inventoryLimit ?? ""}
            onChange={(event) => updateNumber("inventoryLimit", event.target.value)}
            placeholder={limitText(PLAN_LABEL[tenant.plan] ? rulesForTenant({ ...tenant, limitOverrides: {} }).inventoryLimit : rules.inventoryLimit)}
            className="w-full rounded-lg border border-hairline bg-surface px-2 py-2 text-sm outline-none"
          />
        </label>
        <label>
          <span className="mb-1 block text-xs font-medium text-ink-2">Staff limit</span>
          <input
            type="number"
            min={1}
            value={tenant.limitOverrides?.staffLimit ?? ""}
            onChange={(event) => updateNumber("staffLimit", event.target.value)}
            placeholder={String(rulesForTenant({ ...tenant, limitOverrides: {} }).staffLimit)}
            className="w-full rounded-lg border border-hairline bg-surface px-2 py-2 text-sm outline-none"
          />
        </label>
        <label>
          <span className="mb-1 block text-xs font-medium text-ink-2">Public booking</span>
          <select
            value={tenant.limitOverrides?.publicBookingEnabled == null ? "default" : String(tenant.limitOverrides.publicBookingEnabled)}
            onChange={(event) => updateBool("publicBookingEnabled", event.target.value)}
            className="w-full rounded-lg border border-hairline bg-surface px-2 py-2 text-sm outline-none"
          >
            <option value="default">Default</option>
            <option value="true">Force enabled</option>
            <option value="false">Force disabled</option>
          </select>
        </label>
        <label>
          <span className="mb-1 block text-xs font-medium text-ink-2">Manual booking</span>
          <select
            value={tenant.limitOverrides?.manualBookingEnabled == null ? "default" : String(tenant.limitOverrides.manualBookingEnabled)}
            onChange={(event) => updateBool("manualBookingEnabled", event.target.value)}
            className="w-full rounded-lg border border-hairline bg-surface px-2 py-2 text-sm outline-none"
          >
            <option value="default">Default</option>
            <option value="true">Force enabled</option>
            <option value="false">Force disabled</option>
          </select>
        </label>
        <label>
          <span className="mb-1 block text-xs font-medium text-ink-2">Export</span>
          <select
            value={tenant.limitOverrides?.exportEnabled == null ? "default" : String(tenant.limitOverrides.exportEnabled)}
            onChange={(event) => updateBool("exportEnabled", event.target.value)}
            className="w-full rounded-lg border border-hairline bg-surface px-2 py-2 text-sm outline-none"
          >
            <option value="default">Default</option>
            <option value="true">Force enabled</option>
            <option value="false">Force disabled</option>
          </select>
        </label>
      </div>

      <div className="mt-3 text-xs text-ink-3">
        Effective: {limitText(rules.inventoryLimit)} inventory · {rules.staffLimit} users · public booking {rules.publicBookingEnabled ? "on" : "off"} · manual booking {rules.manualBookingEnabled ? "on" : "off"} · export {rules.exportEnabled ? "on" : "off"}
      </div>
    </Card>
  );
}

function AddUserForm() {
  const { platform } = useTenant();
  const [name, setName] = useState("");
  const [tenantId, setTenantId] = useState(platform.tenants[0].id);
  const [role, setRole] = useState<Role>("cashier");
  const [error, setError] = useState("");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (!name.trim()) return;
    try {
      platform.addUser({ tenantId, name, role });
      setName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add user.");
    }
  };

  return (
    <>
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
      {error && (
        <div className="flex items-center gap-2 border-b border-hairline px-5 py-2 text-sm text-critical">
          <AlertTriangle size={15} /> {error}
        </div>
      )}
    </>
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
