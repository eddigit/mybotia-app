"use client";

// Bloc 7C — section Stock dans /admin/tenants/[slug].
// Visible si architectureConfig.standardModules.stock=true.

import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus, AlertCircle, Boxes, AlertTriangle, Save, X } from "lucide-react";
import {
  type StockItem,
  type StockStatus,
  STOCK_STATUSES,
  STOCK_STATUS_LABEL,
} from "@/lib/stock-types";

interface Props {
  tenantSlug: string;
  enabled: boolean;
}

export function StockSection({ tenantSlug, enabled }: Props) {
  const [items, setItems] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  function load() {
    setLoading(true);
    setError(null);
    fetch(`/api/admin/stock?tenant=${encodeURIComponent(tenantSlug)}`)
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
        return j;
      })
      .then((j) => setItems(j.items || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(load, [tenantSlug]);

  const totals = useMemo(() => {
    const active = items.filter((i) => i.status === "active");
    const lowStock = active.filter((i) => i.quantity <= i.minQuantity && i.minQuantity > 0);
    return { total: items.length, active: active.length, lowStock: lowStock.length };
  }, [items]);

  return (
    <section className="card-sharp p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Boxes className="w-4 h-4 text-accent-glow" />
          <h2 className="text-sm font-bold uppercase tracking-tight text-text-primary font-headline">
            Stock / inventaire
          </h2>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          disabled={!enabled}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-[10px] font-bold uppercase tracking-tight border border-accent-primary/30 bg-accent-primary/10 text-accent-glow hover:bg-accent-primary/20 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Plus className="w-3 h-3" />
          Nouvel item
        </button>
      </div>

      {!enabled && (
        <div className="flex items-start gap-1.5 text-[11px] text-amber-300 bg-amber-400/10 border border-amber-400/30 px-3 py-2 mb-4">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>
            Module <span className="font-mono">stock</span> non déclaré dans
            l&apos;architecture du tenant. Active le dans la section
            architecture pour l&apos;utiliser.
          </span>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-1.5 text-[11px] text-status-danger bg-status-danger/10 border border-status-danger/30 px-3 py-2 mb-4">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {totals.total > 0 && (
        <div className="grid grid-cols-3 gap-2 mb-4 text-[10px]">
          <Stat label="Total items" value={String(totals.total)} />
          <Stat label="Actifs" value={String(totals.active)} />
          <Stat label="Sous seuil" value={String(totals.lowStock)} tone={totals.lowStock > 0 ? "warn" : "neutral"} />
        </div>
      )}

      {showCreate && (
        <CreateForm
          tenantSlug={tenantSlug}
          onCancel={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            load();
          }}
        />
      )}

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-4 h-4 animate-spin text-text-muted" />
        </div>
      ) : items.length === 0 ? (
        <p className="text-xs text-text-muted italic text-center py-4">
          Aucun item de stock.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="border-b border-border-subtle text-text-muted text-[10px] uppercase tracking-wider">
              <tr>
                <th className="text-left py-2 px-2">Label</th>
                <th className="text-left py-2 px-2">Entrepôt</th>
                <th className="text-left py-2 px-2">Emplacement</th>
                <th className="text-right py-2 px-2">Qté</th>
                <th className="text-right py-2 px-2">Min</th>
                <th className="text-left py-2 px-2">Unité</th>
                <th className="text-center py-2 px-2">Statut</th>
                <th className="text-right py-2 px-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {items.map((it) =>
                editingId === it.id ? (
                  <EditRow
                    key={it.id}
                    item={it}
                    onCancel={() => setEditingId(null)}
                    onSaved={(updated) => {
                      setItems((arr) => arr.map((x) => (x.id === updated.id ? updated : x)));
                      setEditingId(null);
                    }}
                    onError={setError}
                  />
                ) : (
                  <ItemRow key={it.id} item={it} onEdit={() => setEditingId(it.id)} />
                )
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function ItemRow({ item, onEdit }: { item: StockItem; onEdit: () => void }) {
  const low = item.quantity <= item.minQuantity && item.minQuantity > 0 && item.status === "active";
  return (
    <tr className="hover:bg-surface-2/40">
      <td className="py-2 px-2">
        <div className="text-text-primary">{item.label}</div>
        {item.sku && <div className="text-text-muted font-mono text-[10px]">{item.sku}</div>}
      </td>
      <td className="py-2 px-2 text-text-secondary">{item.warehouse || "—"}</td>
      <td className="py-2 px-2 text-text-muted">{item.location || "—"}</td>
      <td className={`py-2 px-2 text-right font-mono ${low ? "text-amber-300 font-bold" : "text-text-primary"}`}>
        {low && <AlertTriangle className="inline w-3 h-3 mr-1 -mt-0.5" />}
        {item.quantity}
      </td>
      <td className="py-2 px-2 text-right font-mono text-text-muted">{item.minQuantity}</td>
      <td className="py-2 px-2 text-text-muted">{item.unit || "—"}</td>
      <td className="py-2 px-2 text-center">
        <StatusBadge status={item.status} />
      </td>
      <td className="py-2 px-2 text-right">
        <button
          onClick={onEdit}
          className="text-accent-glow text-[10px] hover:underline"
        >
          modifier
        </button>
      </td>
    </tr>
  );
}

function EditRow({
  item,
  onCancel,
  onSaved,
  onError,
}: {
  item: StockItem;
  onCancel: () => void;
  onSaved: (it: StockItem) => void;
  onError: (e: string) => void;
}) {
  const [warehouse, setWarehouse] = useState(item.warehouse || "");
  const [location, setLocation] = useState(item.location || "");
  const [quantity, setQuantity] = useState(String(item.quantity));
  const [minQuantity, setMinQuantity] = useState(String(item.minQuantity));
  const [status, setStatus] = useState<StockStatus>(item.status);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      const r = await fetch(`/api/admin/stock/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          warehouse: warehouse.trim() || null,
          location: location.trim() || null,
          quantity: Number(quantity),
          minQuantity: Number(minQuantity),
          status,
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      onSaved(j.item);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setSaving(false);
    }
  }

  return (
    <tr className="bg-accent-primary/5">
      <td className="py-2 px-2 text-text-primary">{item.label}</td>
      <td className="py-2 px-2">
        <input
          value={warehouse}
          onChange={(e) => setWarehouse(e.target.value)}
          className="w-full bg-surface-2 border border-border-subtle px-2 py-1 text-xs"
        />
      </td>
      <td className="py-2 px-2">
        <input
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          className="w-full bg-surface-2 border border-border-subtle px-2 py-1 text-xs"
        />
      </td>
      <td className="py-2 px-2">
        <input
          type="number"
          step="0.01"
          min="0"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          className="w-20 bg-surface-2 border border-border-subtle px-2 py-1 text-xs text-right font-mono"
        />
      </td>
      <td className="py-2 px-2">
        <input
          type="number"
          step="0.01"
          min="0"
          value={minQuantity}
          onChange={(e) => setMinQuantity(e.target.value)}
          className="w-20 bg-surface-2 border border-border-subtle px-2 py-1 text-xs text-right font-mono"
        />
      </td>
      <td className="py-2 px-2 text-text-muted">{item.unit || "—"}</td>
      <td className="py-2 px-2 text-center">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as StockStatus)}
          className="bg-surface-2 border border-border-subtle px-2 py-1 text-xs"
        >
          {STOCK_STATUSES.map((s) => (
            <option key={s} value={s}>{STOCK_STATUS_LABEL[s]}</option>
          ))}
        </select>
      </td>
      <td className="py-2 px-2 text-right space-x-2">
        <button onClick={handleSave} disabled={saving} className="text-accent-glow text-[10px] hover:underline">
          {saving ? "…" : "save"}
        </button>
        <button onClick={onCancel} className="text-text-muted text-[10px] hover:underline">
          annuler
        </button>
      </td>
    </tr>
  );
}

function CreateForm({
  tenantSlug,
  onCancel,
  onCreated,
}: {
  tenantSlug: string;
  onCancel: () => void;
  onCreated: () => void;
}) {
  const [label, setLabel] = useState("");
  const [sku, setSku] = useState("");
  const [warehouse, setWarehouse] = useState("");
  const [location, setLocation] = useState("");
  const [quantity, setQuantity] = useState("0");
  const [minQuantity, setMinQuantity] = useState("0");
  const [unit, setUnit] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleCreate() {
    setSaving(true);
    setErr(null);
    try {
      const r = await fetch(`/api/admin/stock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantSlug,
          label: label.trim(),
          sku: sku.trim() || null,
          warehouse: warehouse.trim() || null,
          location: location.trim() || null,
          quantity: Number(quantity),
          minQuantity: Number(minQuantity),
          unit: unit.trim() || null,
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      onCreated();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erreur");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="border border-accent-primary/30 bg-accent-primary/5 p-4 mb-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-[11px] font-bold uppercase text-accent-glow">Nouvel item de stock</h3>
        <button onClick={onCancel} className="text-text-muted hover:text-text-primary">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <Field label="Label *">
          <input value={label} onChange={(e) => setLabel(e.target.value)} className="w-full bg-surface-2 border border-border-subtle px-2 py-1" />
        </Field>
        <Field label="SKU">
          <input value={sku} onChange={(e) => setSku(e.target.value)} className="w-full bg-surface-2 border border-border-subtle px-2 py-1" />
        </Field>
        <Field label="Entrepôt">
          <input value={warehouse} onChange={(e) => setWarehouse(e.target.value)} className="w-full bg-surface-2 border border-border-subtle px-2 py-1" />
        </Field>
        <Field label="Emplacement">
          <input value={location} onChange={(e) => setLocation(e.target.value)} className="w-full bg-surface-2 border border-border-subtle px-2 py-1" />
        </Field>
        <Field label="Quantité">
          <input type="number" step="0.01" min="0" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="w-full bg-surface-2 border border-border-subtle px-2 py-1 font-mono" />
        </Field>
        <Field label="Quantité mini">
          <input type="number" step="0.01" min="0" value={minQuantity} onChange={(e) => setMinQuantity(e.target.value)} className="w-full bg-surface-2 border border-border-subtle px-2 py-1 font-mono" />
        </Field>
        <Field label="Unité">
          <input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="unit, kg, box…" className="w-full bg-surface-2 border border-border-subtle px-2 py-1" />
        </Field>
      </div>
      {err && (
        <div className="text-[11px] text-status-danger flex items-start gap-1">
          <AlertCircle className="w-3 h-3 mt-0.5" />
          <span>{err}</span>
        </div>
      )}
      <div className="flex justify-end gap-2">
        <button onClick={onCancel} className="px-3 py-1.5 text-[10px] uppercase border border-border-subtle text-text-muted hover:text-text-primary">
          Annuler
        </button>
        <button onClick={handleCreate} disabled={saving || !label.trim()} className="inline-flex items-center gap-1 px-3 py-1.5 text-[10px] uppercase font-bold border border-accent-primary/30 bg-accent-primary/20 text-accent-glow disabled:opacity-40">
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
          Créer
        </button>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: StockStatus }) {
  const cls =
    status === "active" ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
    : status === "inactive" ? "bg-blue-500/15 text-blue-300 border-blue-500/30"
    : "bg-text-muted/15 text-text-muted border-border-subtle";
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 text-[9px] font-bold uppercase border ${cls}`}>
      {STOCK_STATUS_LABEL[status]}
    </span>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "neutral" | "warn" }) {
  const colorClass = tone === "warn" && value !== "0" ? "text-amber-300" : "text-text-primary";
  return (
    <div className="p-2 border border-border-subtle bg-surface-2/50">
      <p className="text-[9px] uppercase text-text-muted">{label}</p>
      <p className={`text-sm font-bold font-mono mt-0.5 ${colorClass}`}>{value}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[10px] uppercase text-text-muted">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
