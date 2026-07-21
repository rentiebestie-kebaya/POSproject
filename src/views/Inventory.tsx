"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  QrCode, Search, Plus, X, Ruler, Tag, Wallet, Sparkles,
  LayoutGrid, List as ListIcon, Camera, ImagePlus, Trash2, Check, Pencil,
} from "lucide-react";
import { Card, PageHeader, ItemStatusBadge, BookedBadge, GradeBadge, Th, Td } from "../components/Ui";
import { useTenant, type InventoryItemDraft } from "../data/store";
import {
  formatIDR,
  formatDate,
  photoUri,
  STATUS_LABEL,
  WEAR_STYLE_LABEL,
  RENT_CONDITION_LABEL,
  MODELS,
  OCCASIONS,
  SET_PARTS,
  MAX_PHOTOS,
  type ItemStatus,
  type KebayaItem,
  type WearStyle,
  type RentCondition,
  type ConditionGrade,
} from "../data/mock";

const STATUS_FILTERS: ("all" | ItemStatus)[] = ["all", "available", "rented", "maintenance"];

/* ---------- shared bits ---------- */

function Modal({ onClose, children, className = "" }: { onClose: () => void; children: React.ReactNode; className?: string }) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-ink/40 p-4 sm:p-8" onClick={onClose}>
      <div
        className={`flex max-h-full w-full flex-col rounded-2xl bg-surface shadow-xl ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

function Thumb({ photos, alt, className }: { photos: string[]; alt: string; className: string }) {
  if (photos[0]) {
    return <img src={photos[0]} alt={alt} className={`${className} object-cover`} />;
  }
  return (
    <div className={`${className} flex items-center justify-center bg-gradient-to-br from-brand-100 to-brand-200 text-3xl`}>
      👘
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-ink-3">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium">{value}</dd>
    </div>
  );
}

function Section({ icon: Icon, title, children }: { icon: typeof Tag; title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-hairline pt-4">
      <h4 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-ink-3">
        <Icon size={13} /> {title}
      </h4>
      {children}
    </div>
  );
}

/* ---------- detail modal ---------- */

function ItemModal({ item, onClose, onEdit }: { item: KebayaItem; onClose: () => void; onEdit: () => void }) {
  const { futureBookingFor } = useTenant();
  const booking = futureBookingFor(item.id);
  const [active, setActive] = useState(0);
  const photos = item.photos;

  return (
    <Modal onClose={onClose} className="max-w-4xl md:overflow-hidden">
      <div className="flex items-start justify-between gap-4 border-b border-hairline p-5">
        <div>
          <h3 className="text-lg font-semibold leading-tight">{item.name}</h3>
          <div className="mt-0.5 text-sm text-ink-2">{item.model} · {item.color}</div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <ItemStatusBadge status={item.status} />
            {booking && <BookedBadge date={formatDate(booking.startDate)} />}
            <GradeBadge grade={item.conditionGrade} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onEdit}
            className="flex items-center gap-1.5 rounded-full border border-black/10 px-3 py-1.5 text-sm font-medium hover:bg-brand-50"
          >
            <Pencil size={14} /> Edit
          </button>
          <button onClick={onClose} className="rounded-full p-1.5 text-ink-3 hover:bg-black/5" aria-label="Close">
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Two panes: gallery + QR tag left, scrollable details right. Stacks on mobile. */}
      <div className="flex min-h-0 flex-col overflow-y-auto md:flex-row md:overflow-hidden">
        <div className="shrink-0 space-y-3 border-hairline bg-page/70 p-5 md:w-[330px] md:overflow-y-auto md:border-r">
          <div className="relative aspect-[4/5] w-full overflow-hidden rounded-xl bg-page shadow-[0_1px_2px_rgba(11,11,11,0.06)]">
            {photos[active] ? (
              <img src={photos[active]} alt={`${item.name} foto ${active + 1}`} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center text-4xl">👘</div>
            )}
            {photos.length > 0 && (
              <span className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-ink/55 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur-sm">
                <Camera size={11} /> {active + 1} / {photos.length}
              </span>
            )}
          </div>
          {photos.length > 1 && (
            <div className="grid grid-cols-5 gap-2">
              {photos.map((p, i) => (
                <button
                  key={i}
                  onClick={() => setActive(i)}
                  className={`aspect-[4/5] overflow-hidden rounded-lg ring-2 transition-opacity ${
                    active === i ? "ring-brand-600" : "opacity-70 ring-transparent hover:opacity-100"
                  }`}
                  aria-label={`Foto ${i + 1}`}
                >
                  <img src={p} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}

          {/* QR tag lives with the photos — it identifies this physical piece. */}
          <div className="flex items-center gap-3 rounded-xl border border-hairline bg-surface p-3">
            <div
              className="h-14 w-14 shrink-0 rounded-lg border border-hairline"
              style={{ backgroundImage: "repeating-conic-gradient(#0b0b0b 0% 25%, #fcfcfb 0% 50%)", backgroundSize: "10px 10px" }}
              aria-hidden
            />
            <div className="min-w-0">
              <div className="truncate font-mono text-sm font-medium">{item.qrCode}</div>
              <div className="mt-0.5 text-[11px] leading-snug text-ink-3">Scan at checkout & return.</div>
              <button className="mt-1.5 flex items-center gap-1.5 rounded-lg border border-hairline bg-surface px-2 py-1 text-[11px] font-medium hover:bg-brand-50">
                <QrCode size={12} /> Reprint tag
              </button>
            </div>
          </div>
        </div>

        <div className="min-w-0 flex-1 space-y-5 p-5 md:overflow-y-auto [&>div:first-child]:border-t-0 [&>div:first-child]:pt-0">
        <Section icon={Tag} title="Product identity">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
            <Field label="Inventory code" value={<span className="font-mono">{item.inventoryCode}</span>} />
            <Field label="Size label" value={item.sizeLabel} />
            <Field label="Model" value={item.model} />
            <Field label="Color" value={item.color} />
            <Field label="Wear style" value={WEAR_STYLE_LABEL[item.wearStyle]} />
            <Field label="Rent condition" value={RENT_CONDITION_LABEL[item.rentCondition]} />
            <Field
              label="Include in rent"
              value={
                <span className="flex flex-wrap gap-1">
                  {item.includes.map((p) => (
                    <span key={p} className="rounded bg-brand-50 px-1.5 py-0.5 text-xs text-brand-700">{p}</span>
                  ))}
                </span>
              }
            />
            <Field
              label="Occasion category"
              value={
                <span className="flex flex-wrap gap-1">
                  {item.occasions.map((o) => (
                    <span key={o} className="rounded bg-gold-500/15 px-1.5 py-0.5 text-xs text-gold-600">{o}</span>
                  ))}
                </span>
              }
            />
          </dl>
        </Section>

        <Section icon={Ruler} title="Size detail">
          <div className="grid grid-cols-4 gap-3">
            {[
              ["Lingkar dada", item.size.bust],
              ["Lingkar pinggang", item.size.waist],
              ["Panjang baju", item.size.length],
              ["Panjang lengan", item.size.sleeve],
            ].map(([label, v]) => (
              <div key={label} className="rounded-lg bg-page px-3 py-2.5 text-center">
                <div className="text-lg font-semibold tabular-nums">{v}<span className="text-xs font-normal text-ink-3"> cm</span></div>
                <div className="mt-0.5 text-[11px] leading-tight text-ink-3">{label}</div>
              </div>
            ))}
          </div>
        </Section>

        <Section icon={Wallet} title="Pricing">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-hairline px-4 py-3">
              <div className="text-xs text-ink-3">Rental price (3-day base)</div>
              <div className="mt-0.5 text-lg font-semibold tabular-nums">{formatIDR(item.rentalPrice)}</div>
            </div>
            <div className="rounded-lg border border-hairline px-4 py-3">
              <div className="text-xs text-ink-3">Modal beli / bikin</div>
              <div className="mt-0.5 text-lg font-semibold tabular-nums text-ink-2">{formatIDR(item.cost)}</div>
            </div>
          </div>
        </Section>

        <Section icon={Sparkles} title="Description">
          <p className="text-sm leading-relaxed text-ink-2">{item.description || "—"}</p>
        </Section>
        </div>
      </div>
    </Modal>
  );
}

/* ---------- add-item modal ---------- */

const emptyForm = {
  name: "", inventoryCode: "", sizeLabel: "", model: MODELS[0], color: "",
  wearStyle: "hijab" as WearStyle, includes: ["Kebaya"] as string[], occasions: [] as string[],
  rentCondition: "both" as RentCondition,
  bust: "", waist: "", length: "", sleeve: "",
  rentalPrice: "", cost: "", description: "",
  conditionGrade: "A" as ConditionGrade, qrCode: "",
  photos: [] as string[],
};

function formFromItem(item?: KebayaItem): typeof emptyForm {
  if (!item) return emptyForm;
  return {
    name: item.name,
    inventoryCode: item.inventoryCode,
    sizeLabel: item.sizeLabel,
    model: item.model,
    color: item.color,
    wearStyle: item.wearStyle,
    includes: item.includes,
    occasions: item.occasions,
    rentCondition: item.rentCondition,
    bust: String(item.size.bust),
    waist: String(item.size.waist),
    length: String(item.size.length),
    sleeve: String(item.size.sleeve),
    rentalPrice: String(item.rentalPrice),
    cost: String(item.cost),
    description: item.description,
    conditionGrade: item.conditionGrade,
    qrCode: item.qrCode,
    photos: item.photos,
  };
}

const inputCls = "w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-brand-400";
const labelCls = "mb-1 block text-xs font-medium text-ink-2";

function toggle(list: string[], v: string): string[] {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
}

function InventoryItemFormModal({
  nextIndex,
  initialItem,
  onClose,
  onSave,
}: {
  nextIndex: number;
  initialItem?: KebayaItem;
  onClose: () => void;
  onSave: (item: InventoryItemDraft | KebayaItem) => Promise<void>;
}) {
  const editing = Boolean(initialItem);
  const [f, setF] = useState(() => formFromItem(initialItem));
  const [customOcc, setCustomOcc] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));

  const valid = f.name.trim() && f.sizeLabel.trim() && f.color.trim() && f.model.trim();
  const occasionChoices = Array.from(new Set([...OCCASIONS, ...f.occasions]));

  const onFiles = (files: FileList | null) => {
    if (!files) return;
    const urls = Array.from(files).map((file) => URL.createObjectURL(file));
    set("photos", [...f.photos, ...urls].slice(0, MAX_PHOTOS));
  };

  const submit = async () => {
    if (!valid || saving) return;
    const code = f.qrCode.trim() || `KBY-${String(nextIndex).padStart(4, "0")}`;
    // Preview photos when none uploaded, so the card & catalog aren't blank.
    const photos = f.photos.length ? f.photos : [photoUri(f.color, 1)];
    const draft: InventoryItemDraft = {
      name: f.name.trim(),
      inventoryCode: f.inventoryCode.trim() || code,
      sizeLabel: f.sizeLabel.trim(),
      model: f.model.trim(),
      color: f.color.trim(),
      wearStyle: f.wearStyle,
      includes: f.includes,
      occasions: f.occasions,
      rentCondition: f.rentCondition,
      size: { bust: +f.bust || 0, waist: +f.waist || 0, length: +f.length || 0, sleeve: +f.sleeve || 0 },
      rentalPrice: +f.rentalPrice || 0,
      cost: +f.cost || 0,
      description: f.description.trim(),
      status: initialItem?.status ?? "available",
      conditionGrade: f.conditionGrade,
      qrCode: code,
      photos,
      timesRented: initialItem?.timesRented ?? 0,
    };
    setSaving(true);
    setError("");
    try {
      await onSave(initialItem ? { ...initialItem, ...draft } : draft);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save inventory.");
      setSaving(false);
    }
  };

  return (
    <Modal onClose={saving ? () => {} : onClose} className="max-w-2xl">
      <div className="flex items-center justify-between border-b border-hairline p-5">
        <div>
          <h3 className="text-lg font-semibold">{editing ? "Edit kebaya" : "Add kebaya"}</h3>
          <p className="text-sm text-ink-2">{editing ? "Update this physical piece." : "Register a new physical piece into inventory."}</p>
        </div>
        <button
          onClick={onClose}
          disabled={saving}
          className="rounded-full p-1.5 text-ink-3 hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Close"
        >
          <X size={18} />
        </button>
      </div>

      <div className="space-y-5 overflow-y-auto p-5">
        {error && (
          <div className="flex items-start gap-2 rounded-xl border border-critical/20 bg-critical/5 px-3 py-2.5 text-sm text-critical">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Photos */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-ink-3">
              <Camera size={13} /> Photos
            </label>
            <span className="text-xs text-ink-3">{f.photos.length} / {MAX_PHOTOS}</span>
          </div>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
            {f.photos.map((p, i) => (
              <div key={i} className="group relative aspect-[4/5] overflow-hidden rounded-lg border border-hairline">
                <img src={p} alt="" className="h-full w-full object-cover" />
                <button
                  onClick={() => set("photos", f.photos.filter((_, j) => j !== i))}
                  className="absolute right-1 top-1 rounded-md bg-ink/60 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
                  aria-label="Remove photo"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
            {f.photos.length < MAX_PHOTOS && (
              <label className="flex aspect-[4/5] cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-hairline text-ink-3 hover:border-brand-400 hover:text-brand-600">
                <ImagePlus size={16} />
                <span className="text-[10px] font-medium">Add</span>
                <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => onFiles(e.target.files)} />
              </label>
            )}
          </div>
          <p className="mt-1.5 text-[11px] text-ink-3">Up to {MAX_PHOTOS} photos. Used later for the customer online catalog.</p>
        </div>

        {/* Identity */}
        <Section icon={Tag} title="Product identity">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <label className="col-span-2 sm:col-span-1"><span className={labelCls}>Name *</span>
              <input className={inputCls} value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Anggun Ivory" />
            </label>
            <label><span className={labelCls}>Inventory code</span>
              <input className={inputCls} value={f.inventoryCode} onChange={(e) => set("inventoryCode", e.target.value)} placeholder="KBY-017" />
            </label>
            <label><span className={labelCls}>Size label *</span>
              <input className={inputCls} value={f.sizeLabel} onChange={(e) => set("sizeLabel", e.target.value)} placeholder="S-M / M-L / All size" />
            </label>
            <label><span className={labelCls}>Model *</span>
              <input className={inputCls} value={f.model} onChange={(e) => set("model", e.target.value)} list="model-options" />
              <datalist id="model-options">{MODELS.map((m) => <option key={m} value={m} />)}</datalist>
            </label>
            <label><span className={labelCls}>Color *</span>
              <input className={inputCls} value={f.color} onChange={(e) => set("color", e.target.value)} placeholder="e.g. Maroon" />
            </label>
            <label><span className={labelCls}>Wear style</span>
              <select className={inputCls} value={f.wearStyle} onChange={(e) => set("wearStyle", e.target.value as WearStyle)}>
                <option value="hijab">Hijab friendly</option>
                <option value="non-hijab">Non-hijab</option>
              </select>
            </label>
            <label><span className={labelCls}>Rent condition</span>
              <select className={inputCls} value={f.rentCondition} onChange={(e) => set("rentCondition", e.target.value as RentCondition)}>
                <option value="in-town">Dalam kota</option>
                <option value="shipping">Kirim luar kota</option>
                <option value="both">Dalam kota & kirim</option>
              </select>
            </label>
          </div>

          <div className="mt-3">
            <span className={labelCls}>Include in rent</span>
            <div className="flex flex-wrap gap-1.5">
              {SET_PARTS.map((p) => (
                <button key={p} type="button" onClick={() => set("includes", toggle(f.includes, p))}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    f.includes.includes(p) ? "bg-brand-900 text-white" : "border border-hairline text-ink-2 hover:bg-brand-50"
                  }`}>
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-3">
            <span className={labelCls}>Occasion category</span>
            <div className="flex flex-wrap items-center gap-1.5">
              {occasionChoices.map((o) => (
                <button key={o} type="button" onClick={() => set("occasions", toggle(f.occasions, o))}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    f.occasions.includes(o) ? "bg-gold-500 text-brand-900" : "border border-hairline text-ink-2 hover:bg-brand-50"
                  }`}>
                  {o}
                </button>
              ))}
              <input
                value={customOcc}
                onChange={(e) => setCustomOcc(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && customOcc.trim()) {
                    e.preventDefault();
                    set("occasions", toggle(f.occasions, customOcc.trim()));
                    setCustomOcc("");
                  }
                }}
                placeholder="+ custom"
                className="w-24 rounded-full border border-dashed border-hairline px-3 py-1 text-xs outline-none focus:border-brand-400"
              />
            </div>
          </div>
        </Section>

        {/* Size detail */}
        <Section icon={Ruler} title="Size detail (cm)">
          <div className="grid grid-cols-4 gap-3">
            {([["Lingkar dada", "bust"], ["Lingkar pinggang", "waist"], ["Panjang baju", "length"], ["Panjang lengan", "sleeve"]] as const).map(
              ([label, key]) => (
                <label key={key}><span className={labelCls}>{label}</span>
                  <input type="number" min={0} className={`${inputCls} tabular-nums`} value={f[key]} onChange={(e) => set(key, e.target.value)} />
                </label>
              ),
            )}
          </div>
        </Section>

        {/* Pricing */}
        <Section icon={Wallet} title="Pricing (Rp)">
          <div className="grid grid-cols-2 gap-3">
            <label><span className={labelCls}>Rental price (3-day base)</span>
              <input type="number" min={0} step={25000} className={`${inputCls} tabular-nums`} value={f.rentalPrice} onChange={(e) => set("rentalPrice", e.target.value)} />
            </label>
            <label><span className={labelCls}>Modal beli / bikin</span>
              <input type="number" min={0} step={100000} className={`${inputCls} tabular-nums`} value={f.cost} onChange={(e) => set("cost", e.target.value)} />
            </label>
          </div>
        </Section>

        {/* Description + condition */}
        <Section icon={Sparkles} title="Description & condition">
          <label className="block"><span className={labelCls}>Costume description</span>
            <textarea rows={3} className={inputCls} value={f.description} onChange={(e) => set("description", e.target.value)}
              placeholder="Material, detail, catatan…" />
          </label>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <label><span className={labelCls}>Condition grade</span>
              <select className={inputCls} value={f.conditionGrade} onChange={(e) => set("conditionGrade", e.target.value as ConditionGrade)}>
                <option value="A">A — pristine</option>
                <option value="B">B — good, minor wear</option>
                <option value="C">C — worn / needs care</option>
              </select>
            </label>
            <label><span className={labelCls}>QR code</span>
              <input className={`${inputCls} font-mono`} value={f.qrCode} onChange={(e) => set("qrCode", e.target.value)}
                placeholder={`auto: KBY-${String(nextIndex).padStart(4, "0")}`} />
            </label>
          </div>
        </Section>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-hairline p-4">
        <span className="text-xs text-ink-3">* required</span>
        <div className="flex gap-2">
          <button
            onClick={onClose}
            disabled={saving}
            className="rounded-full border border-black/10 px-4 py-2 text-sm font-medium hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </button>
          <button onClick={submit} disabled={!valid || saving}
            className="flex items-center gap-1.5 rounded-full bg-brand-900 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:bg-brand-200">
            <Check size={15} /> {saving ? "Saving..." : "Save kebaya"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* ---------- views ---------- */

function ItemCard({ item, onOpen }: { item: KebayaItem; onOpen: () => void }) {
  const { futureBookingFor } = useTenant();
  const booking = futureBookingFor(item.id);
  return (
    <Card className="overflow-hidden text-left transition-shadow hover:shadow-md">
      <button onClick={onOpen} className="block w-full text-left">
        <div className="relative">
          <Thumb photos={item.photos} alt={item.name} className="aspect-[4/5] w-full" />
          {item.photos.length > 1 && (
            <span className="absolute bottom-2 right-2 flex items-center gap-1 rounded-md bg-ink/55 px-1.5 py-0.5 text-[11px] font-medium text-white">
              <Camera size={11} /> {item.photos.length}
            </span>
          )}
        </div>
        <div className="p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">{item.name}</div>
              <div className="mt-0.5 truncate text-xs text-ink-2">{item.model} · {item.color}</div>
            </div>
            <GradeBadge grade={item.conditionGrade} />
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-ink-3">
            <span className="rounded bg-page px-1.5 py-0.5 font-medium">Size {item.sizeLabel}</span>
            <span className="rounded bg-page px-1.5 py-0.5">{WEAR_STYLE_LABEL[item.wearStyle]}</span>
          </div>

          <div className="mt-3 flex items-center justify-between">
            <span className="text-sm font-semibold tabular-nums">{formatIDR(item.rentalPrice)}<span className="text-xs font-normal text-ink-3">/3d</span></span>
            <span className="font-mono text-[11px] text-ink-3">{item.qrCode}</span>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <ItemStatusBadge status={item.status} />
            {booking && <BookedBadge date={formatDate(booking.startDate)} />}
          </div>
        </div>
      </button>
    </Card>
  );
}

function ItemTable({ rows, onOpen }: { rows: KebayaItem[]; onOpen: (id: string) => void }) {
  const { futureBookingFor } = useTenant();
  return (
    <Card className="overflow-x-auto">
      <table className="w-full min-w-[760px]">
        <thead className="border-b border-hairline bg-page">
          <tr>
            <Th>Kebaya</Th>
            <Th>Model / color</Th>
            <Th>Size</Th>
            <Th>Wear</Th>
            <Th>Occasions</Th>
            <Th className="text-right">Rental</Th>
            <Th>Cond.</Th>
            <Th>Status</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-hairline">
          {rows.map((i) => {
            const booking = futureBookingFor(i.id);
            return (
              <tr key={i.id} className="cursor-pointer hover:bg-brand-50/40" onClick={() => onOpen(i.id)}>
                <Td>
                  <div className="flex items-center gap-3">
                    <Thumb photos={i.photos} alt={i.name} className="h-10 w-8 shrink-0 rounded-md" />
                    <div className="min-w-0">
                      <div className="truncate font-medium">{i.name}</div>
                      <div className="font-mono text-xs text-ink-3">{i.qrCode}</div>
                    </div>
                  </div>
                </Td>
                <Td className="whitespace-nowrap text-ink-2">{i.model} · {i.color}</Td>
                <Td>{i.sizeLabel}</Td>
                <Td className="whitespace-nowrap text-ink-2">{WEAR_STYLE_LABEL[i.wearStyle]}</Td>
                <Td className="max-w-40"><span className="line-clamp-1 text-xs text-ink-2">{i.occasions.join(", ") || "—"}</span></Td>
                <Td className="whitespace-nowrap text-right tabular-nums">{formatIDR(i.rentalPrice)}</Td>
                <Td><GradeBadge grade={i.conditionGrade} /></Td>
                <Td>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <ItemStatusBadge status={i.status} />
                    {booking && <BookedBadge />}
                  </div>
                </Td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}

/* ---------- page ---------- */

export default function Inventory() {
  const { tenant, inventory: items, planRules, addItem, editItem } = useTenant();
  const [view, setView] = useState<"grid" | "list">("grid");
  const [status, setStatus] = useState<(typeof STATUS_FILTERS)[number]>("all");
  const [dateSort, setDateSort] = useState<"newest" | "oldest">("newest");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const inventoryLocked = planRules.inventoryLimit !== null && items.length >= planRules.inventoryLimit;

  const rows = useMemo(() => {
    return items.filter((i) => {
      if (status !== "all" && i.status !== status) return false;
      if (!query) return true;
      const q = query.toLowerCase();
      return (
        i.qrCode.toLowerCase().includes(q) ||
        i.inventoryCode.toLowerCase().includes(q) ||
        i.name.toLowerCase().includes(q) ||
        i.model.toLowerCase().includes(q) ||
        i.color.toLowerCase().includes(q) ||
        i.occasions.some((o) => o.toLowerCase().includes(q))
      );
    }).sort((a, b) => (
      dateSort === "newest"
        ? b.dateAdded.localeCompare(a.dateAdded)
        : a.dateAdded.localeCompare(b.dateAdded)
    ));
  }, [items, status, query, dateSort]);

  const openItem = openId ? items.find((i) => i.id === openId) ?? null : null;
  const editingItem = editingId ? items.find((i) => i.id === editingId) ?? null : null;

  return (
    <>
      <PageHeader
        title="Inventory"
        subtitle="Every kebaya tracked as a unique physical piece — with its own sizing, set contents, photos, and QR tag."
        actions={
          <>
            <button className="flex items-center gap-1.5 rounded-full border border-black/10 bg-white px-3.5 py-2 text-sm font-medium hover:bg-brand-50">
              <QrCode size={15} /> Print QR tags
            </button>
            <button
              onClick={() => {
                setError("");
                if (inventoryLocked) {
                  setError(`Inventory limit reached. ${tenant.name} can store ${planRules.inventoryLimit} items on ${tenant.plan}.`);
                  return;
                }
                setAdding(true);
              }}
              className={`flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-medium text-white ${
                inventoryLocked ? "bg-brand-300" : "bg-brand-900 hover:bg-brand-800"
              }`}
              title={inventoryLocked ? "Upgrade plan or set a /dev override to add more inventory." : undefined}
            >
              <Plus size={15} /> Add kebaya
            </button>
          </>
        }
      />

      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-critical/20 bg-critical/5 px-3 py-2.5 text-sm text-critical">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, code, color, occasion…"
            className="w-60 rounded-full border border-black/10 bg-white py-2 pl-9 pr-3 text-sm outline-none placeholder:text-ink-3 focus:border-brand-400"
          />
        </div>

        <select value={dateSort} onChange={(e) => setDateSort(e.target.value as "newest" | "oldest")} className="rounded-full border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-brand-400">
          <option value="newest">Newest added</option>
          <option value="oldest">Oldest added</option>
        </select>

        <div className="flex flex-wrap gap-1.5">
          {STATUS_FILTERS.map((ff) => (
            <button key={ff} onClick={() => setStatus(ff)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                status === ff ? "bg-brand-900 text-white" : "border border-hairline bg-surface text-ink-2 hover:bg-brand-50"
              }`}>
              {ff === "all" ? "All" : STATUS_LABEL[ff]}
              <span className="ml-1.5 opacity-70">{ff === "all" ? items.length : items.filter((i) => i.status === ff).length}</span>
            </button>
          ))}
        </div>

        <div className="ml-auto flex overflow-hidden rounded-full border border-black/10">
          <button onClick={() => setView("grid")} aria-label="Grid view"
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium ${view === "grid" ? "bg-brand-900 text-white" : "text-ink-2 hover:bg-brand-50"}`}>
            <LayoutGrid size={15} />
          </button>
          <button onClick={() => setView("list")} aria-label="List view"
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium ${view === "list" ? "bg-brand-900 text-white" : "text-ink-2 hover:bg-brand-50"}`}>
            <ListIcon size={15} />
          </button>
        </div>
      </div>

      {rows.length === 0 ? (
        <Card className="p-12 text-center text-sm text-ink-3">No kebaya match these filters.</Card>
      ) : view === "grid" ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {rows.map((i) => (
            <ItemCard key={i.id} item={i} onOpen={() => setOpenId(i.id)} />
          ))}
        </div>
      ) : (
        <ItemTable rows={rows} onOpen={setOpenId} />
      )}

      {openItem && (
        <ItemModal
          item={openItem}
          onClose={() => setOpenId(null)}
          onEdit={() => {
            setOpenId(null);
            setEditingId(openItem.id);
          }}
        />
      )}
      {adding && (
        <InventoryItemFormModal
          nextIndex={items.length + 1}
          onClose={() => setAdding(false)}
          onSave={async (item) => {
            const saved = await addItem(item as InventoryItemDraft);
            setAdding(false);
            setOpenId(saved.id);
          }}
        />
      )}
      {editingItem && (
        <InventoryItemFormModal
          nextIndex={items.length + 1}
          initialItem={editingItem}
          onClose={() => setEditingId(null)}
          onSave={async (item) => {
            const saved = await editItem(item as KebayaItem);
            setEditingId(null);
            setOpenId(saved.id);
          }}
        />
      )}
    </>
  );
}
