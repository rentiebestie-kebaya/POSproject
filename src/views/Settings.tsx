"use client";

import { useState, type FormEvent } from "react";
import { Store, UserPlus, Users } from "lucide-react";
import { Card, PageHeader } from "../components/Ui";
import { useTenant, type StaffProvisionInput } from "../data/store";
import { BILLING_STATUS_LABEL, ONBOARDING_STATUS_LABEL, PLAN_LABEL, ROLE_LABEL, STORE_STATUS_LABEL } from "../data/mock";
import { limitText } from "../data/plans";

export default function Settings() {
  const { tenant, team, planRules, user, provisionStaff, setStaffAccess, resetStaffPassword } = useTenant();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<StaffProvisionInput["role"]>("cashier");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const canProvisionStaff = user.role === "owner";
  const staffLimitReached = team.length >= planRules.staffLimit;

  // The owner can administer staff, but never an owner account and never
  // themselves — that would lock the shop out of its own login.
  const canManage = (staff: { id: string; role: string }) =>
    user.role === "owner" && staff.role !== "owner" && staff.id !== user.id;

  const onToggleAccess = async (staff: { id: string; name: string; active?: boolean }) => {
    if (busyId) return;
    setError(null);
    setMessage(null);
    setBusyId(staff.id);
    const nextActive = staff.active === false;
    try {
      await setStaffAccess({ userId: staff.id, active: nextActive });
      setMessage(nextActive ? `${staff.name} can sign in again.` : `${staff.name}'s access has been revoked.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Staff access could not be updated.");
    } finally {
      setBusyId(null);
    }
  };

  const onResetPassword = async (staff: { id: string; name: string }) => {
    if (busyId) return;
    setError(null);
    setMessage(null);
    setBusyId(staff.id);
    try {
      await resetStaffPassword({ userId: staff.id, password: newPassword });
      setResettingId(null);
      setNewPassword("");
      setMessage(`${staff.name}'s password has been reset.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Password could not be reset.");
    } finally {
      setBusyId(null);
    }
  };

  const onProvisionStaff = async (event: FormEvent) => {
    event.preventDefault();
    if (!canProvisionStaff || submitting) return;
    setError(null);
    setMessage(null);
    setSubmitting(true);
    try {
      const staff = await provisionStaff({
        name,
        email,
        password,
        role,
      });
      setName("");
      setEmail("");
      setPassword("");
      setRole("cashier");
      setMessage(`${staff.name} can now sign in.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Staff account could not be created.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <PageHeader title="Settings" subtitle="Shop profile and team access." />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold">
            <Store size={15} className="text-ink-3" /> Shop profile
          </h2>
          <dl className="space-y-3 text-sm">
            {[
              ["Shop name", tenant.name],
              ["Booking page", tenant.subdomain],
              ["Store location", tenant.location],
              ["WhatsApp Business", tenant.whatsapp],
              ["Plan", PLAN_LABEL[tenant.plan]],
              ["Billing", BILLING_STATUS_LABEL[tenant.billingStatus]],
              ["Store status", STORE_STATUS_LABEL[tenant.status]],
              ["Onboarding", ONBOARDING_STATUS_LABEL[tenant.onboardingStatus]],
              ["Inventory limit", limitText(planRules.inventoryLimit)],
              ["Staff limit", `${planRules.staffLimit} total users`],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 border-b border-hairline pb-3 last:border-0 last:pb-0">
                <dt className="text-ink-2">{k}</dt>
                <dd className="font-medium">{v}</dd>
              </div>
            ))}
          </dl>
        </Card>

        <Card className="p-5">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold">
            <Users size={15} className="text-ink-3" /> Team & roles
          </h2>
          {canProvisionStaff && (
            <form onSubmit={onProvisionStaff} className="mb-5 space-y-3 border-b border-hairline pb-5">
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label htmlFor="staff-name" className="mb-1 block text-xs font-medium text-ink-2">
                    Staff name
                  </label>
                  <input
                    id="staff-name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    required
                    className="w-full rounded-lg border border-hairline bg-surface px-3 py-2 text-sm outline-none transition-colors focus:border-brand-400 focus:ring-1 focus:ring-brand-200"
                    placeholder="Cashier name"
                  />
                </div>
                <div>
                  <label htmlFor="staff-role" className="mb-1 block text-xs font-medium text-ink-2">
                    Role
                  </label>
                  <select
                    id="staff-role"
                    value={role}
                    onChange={(event) => setRole(event.target.value as StaffProvisionInput["role"])}
                    className="w-full rounded-lg border border-hairline bg-surface px-3 py-2 text-sm outline-none transition-colors focus:border-brand-400 focus:ring-1 focus:ring-brand-200"
                  >
                    <option value="cashier">{ROLE_LABEL.cashier}</option>
                    <option value="fitting">{ROLE_LABEL.fitting}</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="staff-email" className="mb-1 block text-xs font-medium text-ink-2">
                    Email
                  </label>
                  <input
                    id="staff-email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                    className="w-full rounded-lg border border-hairline bg-surface px-3 py-2 text-sm outline-none transition-colors focus:border-brand-400 focus:ring-1 focus:ring-brand-200"
                    placeholder="staff@shop.com"
                  />
                </div>
                <div>
                  <label htmlFor="staff-password" className="mb-1 block text-xs font-medium text-ink-2">
                    Initial password
                  </label>
                  <input
                    id="staff-password"
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                    className="w-full rounded-lg border border-hairline bg-surface px-3 py-2 text-sm outline-none transition-colors focus:border-brand-400 focus:ring-1 focus:ring-brand-200"
                    placeholder="At least 8 characters"
                  />
                </div>
              </div>
              {error && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
                  {error}
                </p>
              )}
              {message && (
                <p className="rounded-lg bg-success/10 px-3 py-2 text-sm text-success">
                  {message}
                </p>
              )}
              <button
                type="submit"
                disabled={submitting || staffLimitReached}
                className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-60"
              >
                <UserPlus size={15} /> {submitting ? "Creating..." : "Create staff account"}
              </button>
              {staffLimitReached && (
                <p className="text-xs text-ink-3">
                  Staff limit reached for {PLAN_LABEL[tenant.plan]}.
                </p>
              )}
            </form>
          )}
          {!canProvisionStaff && (
            <p className="mb-5 border-b border-hairline pb-5 text-sm text-ink-2">
              Only owners can create staff accounts.
            </p>
          )}
          <ul className="space-y-3">
            {team.map((s) => (
              <li key={s.id} className="border-b border-hairline pb-3 text-sm last:border-0 last:pb-0">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className={`font-medium ${s.active === false ? "text-ink-3 line-through" : ""}`}>
                      {s.name}
                    </span>
                    {s.active === false && (
                      <span className="rounded-full bg-critical/10 px-2 py-0.5 text-[11px] font-medium text-critical">
                        Deactivated
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700">
                      {ROLE_LABEL[s.role]}
                    </span>
                    {canManage(s) && (
                      <>
                        <button
                          type="button"
                          disabled={busyId === s.id}
                          onClick={() => {
                            setResettingId(resettingId === s.id ? null : s.id);
                            setNewPassword("");
                          }}
                          className="rounded-full border border-hairline px-2.5 py-1 text-xs font-medium text-ink-2 hover:bg-page disabled:opacity-50"
                        >
                          Reset password
                        </button>
                        <button
                          type="button"
                          disabled={busyId === s.id}
                          onClick={() => onToggleAccess(s)}
                          className={`rounded-full px-2.5 py-1 text-xs font-medium disabled:opacity-50 ${
                            s.active === false
                              ? "bg-brand-900 text-white hover:bg-brand-800"
                              : "border border-critical/30 text-critical hover:bg-critical/5"
                          }`}
                        >
                          {busyId === s.id ? "…" : s.active === false ? "Reactivate" : "Deactivate"}
                        </button>
                      </>
                    )}
                  </div>
                </div>
                {resettingId === s.id && (
                  <div className="mt-2.5 flex flex-wrap items-center gap-2">
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="New password (min 8 characters)"
                      className="min-w-56 flex-1 rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none placeholder:text-ink-3 focus:border-brand-400"
                    />
                    <button
                      type="button"
                      disabled={newPassword.length < 8 || busyId === s.id}
                      onClick={() => onResetPassword(s)}
                      className="rounded-full bg-brand-900 px-3.5 py-2 text-sm font-medium text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:bg-brand-200"
                    >
                      {busyId === s.id ? "Saving…" : "Set password"}
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </Card>
      </div>

    </>
  );
}
