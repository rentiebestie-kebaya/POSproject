"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Building2, Check, MapPin, Phone, X } from "lucide-react";
import { shopProfileIsValid, type ShopProfileFields } from "@/lib/shop-profile";

interface ShopProfileFormProps {
  initialProfile: ShopProfileFields;
  submitLabel: string;
  submitting?: boolean;
  error?: string | null;
  message?: string | null;
  onSubmit: (profile: ShopProfileFields) => Promise<void> | void;
  onCancel?: () => void;
  idPrefix?: string;
}

const inputCls =
  "w-full rounded-lg border border-hairline bg-surface px-3 py-2 text-sm outline-none transition-colors focus:border-brand-400 focus:ring-1 focus:ring-brand-200";
const labelCls = "mb-1 block text-xs font-medium text-ink-2";

export function ShopProfileForm({
  initialProfile,
  submitLabel,
  submitting = false,
  error,
  message,
  onSubmit,
  onCancel,
  idPrefix = "shop-profile",
}: ShopProfileFormProps) {
  const [profile, setProfile] = useState<ShopProfileFields>(initialProfile);

  useEffect(() => {
    setProfile(initialProfile);
  }, [initialProfile.name, initialProfile.location, initialProfile.whatsapp]);

  const trimmedProfile = useMemo(
    () => ({
      name: profile.name.trim(),
      location: profile.location.trim(),
      whatsapp: profile.whatsapp.trim(),
    }),
    [profile],
  );
  const canSubmit = shopProfileIsValid(trimmedProfile);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmit || submitting) return;
    await onSubmit(trimmedProfile);
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <label className={labelCls} htmlFor={`${idPrefix}-name`}>
          Shop name
        </label>
        <div className="relative">
          <Building2 size={15} className="absolute left-3 top-2.5 text-ink-3" />
          <input
            id={`${idPrefix}-name`}
            value={profile.name}
            onChange={(event) => setProfile((current) => ({ ...current, name: event.target.value }))}
            className={`${inputCls} pl-9`}
            placeholder="Griya Kebaya Melati"
            autoComplete="organization"
          />
        </div>
      </div>

      <div>
        <label className={labelCls} htmlFor={`${idPrefix}-location`}>
          Store location
        </label>
        <div className="relative">
          <MapPin size={15} className="absolute left-3 top-2.5 text-ink-3" />
          <input
            id={`${idPrefix}-location`}
            value={profile.location}
            onChange={(event) => setProfile((current) => ({ ...current, location: event.target.value }))}
            className={`${inputCls} pl-9`}
            placeholder="Kemang, Jakarta Selatan"
            autoComplete="street-address"
          />
        </div>
      </div>

      <div>
        <label className={labelCls} htmlFor={`${idPrefix}-whatsapp`}>
          WhatsApp Business
        </label>
        <div className="relative">
          <Phone size={15} className="absolute left-3 top-2.5 text-ink-3" />
          <input
            id={`${idPrefix}-whatsapp`}
            value={profile.whatsapp}
            onChange={(event) => setProfile((current) => ({ ...current, whatsapp: event.target.value }))}
            className={`${inputCls} pl-9`}
            placeholder="+62 812-0000-1234"
            autoComplete="tel"
          />
        </div>
      </div>

      {error && (
        <p className="rounded-lg bg-critical/10 px-3 py-2 text-sm text-critical" role="alert">
          {error}
        </p>
      )}
      {message && <p className="rounded-lg bg-success/10 px-3 py-2 text-sm text-success">{message}</p>}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="submit"
          disabled={!canSubmit || submitting}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-60"
        >
          <Check size={15} /> {submitting ? "Saving..." : submitLabel}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="inline-flex items-center gap-2 rounded-lg border border-hairline bg-surface px-3 py-2 text-sm font-semibold text-ink-2 hover:bg-page disabled:opacity-60"
          >
            <X size={15} /> Cancel
          </button>
        )}
      </div>
    </form>
  );
}
