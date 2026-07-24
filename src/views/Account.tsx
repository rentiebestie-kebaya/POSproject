"use client";

import { useState, type FormEvent } from "react";
import { KeyRound, UserCircle } from "lucide-react";
import { Card, PageHeader } from "../components/Ui";
import { useTenant } from "../data/store";
import { ROLE_LABEL } from "../data/mock";

const inputCls =
  "w-full rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm outline-none placeholder:text-ink-3 focus:border-brand-400";
const labelCls = "mb-1.5 block text-xs font-semibold text-ink-2";

export default function Account() {
  const { user, tenant, changeOwnPassword } = useTenant();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const mismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;
  const canSubmit =
    currentPassword.length > 0 && newPassword.length >= 8 && newPassword === confirmPassword && !saving;

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    setError(null);
    setMessage(null);
    setSaving(true);
    try {
      await changeOwnPassword({ currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setMessage("Password changed. Any other devices have been signed out.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Password could not be changed.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader title="My account" subtitle="Your profile and password." />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold">
            <UserCircle size={15} className="text-ink-3" /> Profile
          </h2>
          <dl className="space-y-3 text-sm">
            {[
              ["Name", user.name],
              ["Role", ROLE_LABEL[user.role]],
              ["Shop", tenant.name],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between gap-3 border-b border-hairline pb-3 last:border-0 last:pb-0">
                <dt className="text-ink-2">{label}</dt>
                <dd className="font-medium">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-xs leading-5 text-ink-3">
            Your name and role are set by the shop owner. Ask them if either needs changing.
          </p>
        </Card>

        <Card className="p-5">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold">
            <KeyRound size={15} className="text-ink-3" /> Change password
          </h2>
          <form onSubmit={onSubmit} className="space-y-3">
            <div>
              <label className={labelCls} htmlFor="current-password">Current password</label>
              <input
                id="current-password"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className={inputCls}
                autoComplete="current-password"
              />
            </div>
            <div>
              <label className={labelCls} htmlFor="new-password">New password</label>
              <input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 8 characters"
                className={inputCls}
                autoComplete="new-password"
              />
            </div>
            <div>
              <label className={labelCls} htmlFor="confirm-password">Confirm new password</label>
              <input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={inputCls}
                autoComplete="new-password"
              />
              {mismatch && <p className="mt-1.5 text-xs font-medium text-critical">Passwords do not match.</p>}
            </div>

            {error && (
              <div className="rounded-xl border border-critical/20 bg-critical/5 px-3 py-2.5 text-sm text-critical">
                {error}
              </div>
            )}
            {message && (
              <div className="rounded-xl bg-success/10 px-3 py-2.5 text-sm text-good-text">{message}</div>
            )}

            <button
              type="submit"
              disabled={!canSubmit}
              className="w-full rounded-full bg-brand-900 py-2.5 text-sm font-semibold text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:bg-brand-200"
            >
              {saving ? "Saving…" : "Change password"}
            </button>
          </form>
        </Card>
      </div>
    </>
  );
}
