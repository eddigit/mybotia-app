"use client";

// Bloc 7C — section Livraisons dans /admin/tenants/[slug].
// Visible si architectureConfig.standardModules.delivery=true.

import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus, AlertCircle, Truck, Save, X } from "lucide-react";
import {
  type Delivery,
  type DeliveryStatus,
  DELIVERY_STATUSES,
  DELIVERY_STATUS_LABEL,
} from "@/lib/delivery-types";

interface Props {
  tenantSlug: string;
  enabled: boolean;
  currency?: string;
}

export function DeliveriesSection({ tenantSlug, enabled, currency = "EUR" }: Props) {
  const [items, setItems] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  function load() {
    setLoading(true);
    setError(null);
    fetch(`/api/admin/deliveries?tenant=${encodeURIComponent(tenantSlug)}`)
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
    const open = items.filter((i) => i.status !== "delivered" && i.status !== "cancelled");
    return { total: items.length, open: open.length };
  }, [items]);

  return (
    <section className="card-sharp p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Truck className="w-4 h-4 text-accent-glow" />
          <h2 className="text-sm font-bold uppercase tracking-tight text-text-primary font-headline">
            Livraisons
          </h2>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          disabled={!enabled}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-[10px] font-bold uppercase tracking-tight border border-accent-primary/30 bg-accent-primary/10 text-accent-glow hover:bg-accent-primary/20 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Plus className="w-3 h-3" />
          Nouvelle livraison
        </button>
      </div>

      {!enabled && (
        <div className="flex items-start gap-1.5 text-[11px] text-amber-300 bg-amber-400/10 border border-amber-400/30 px-3 py-2 mb-4">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>
            Module <span className="font-mono">delivery</span> non déclaré dans
            l&apos;architecture du tenant.
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
        <div className="grid grid-cols-2 gap-2 mb-4 text-[10px]">
          <Stat label="Total" value={String(totals.total)} />
          <Stat label="En cours" value={String(totals.open)} />
        </div>
      )}

      {showCreate && (
        <CreateForm
          tenantSlug={tenantSlug}
          currency={currency}
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
          Aucune livraison.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="border-b border-border-subtle text-text-muted text-[10px] uppercase tracking-wider">
              <tr>
                <th className="text-left py-2 px-2">Réf / Titre</th>
                <th className="text-left py-2 px-2">Client</th>
                <th className="text-left py-2 px-2">Transporteur</th>
                <th className="text-left py-2 px-2">Date prévue</th>
                <th className="text-right py-2 px-2">Coût transport</th>
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

function ItemRow({ item, onEdit }: { item: Delivery; onEdit: () => void }) {
  return (
    <tr className="hover:bg-surface-2/40">
      <td className="py-2 px-2">
        <div className="text-text-primary">{item.title}</div>
        {item.ref && <div className="text-text-muted font-mono text-[10px]">{item.ref}</div>}
      </td>
      <td className="py-2 px-2 text-text-secondary">{item.clientName || "—"}</td>
      <td className="py-2 px-2 text-text-muted">
        {item.carrier || "—"}
        {item.trackingNumber && (
          <div className="text-[10px] font-mono text-text-muted">{item.trackingNumber}</div>
        )}
      </td>
      <td className="py-2 px-2 font-mono text-text-secondary">{item.expectedDate || "—"}</td>
      <td className="py-2 px-2 text-right font-mono">
        {item.transportCost !== null
          ? `${item.transportCost.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${item.currency}`
          : "—"}
      </td>
      <td className="py-2 px-2 text-center">
        <StatusBadge status={item.status} />
      </td>
      <td className="py-2 px-2 text-right">
        <button onClick={onEdit} className="text-accent-glow text-[10px] hover:underline">
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
  item: Delivery;
  onCancel: () => void;
  onSaved: (it: Delivery) => void;
  onError: (e: string) => void;
}) {
  const [carrier, setCarrier] = useState(item.carrier || "");
  const [expectedDate, setExpectedDate] = useState(item.expectedDate || "");
  const [transportCost, setTransportCost] = useState(item.transportCost !== null ? String(item.transportCost) : "");
  const [trackingNumber, setTrackingNumber] = useState(item.trackingNumber || "");
  const [status, setStatus] = useState<DeliveryStatus>(item.status);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      const r = await fetch(`/api/admin/deliveries/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          carrier: carrier.trim() || null,
          expectedDate: expectedDate.trim() || null,
          transportCost: transportCost.trim() === "" ? null : Number(transportCost),
          trackingNumber: trackingNumber.trim() || null,
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
      <td className="py-2 px-2 text-text-primary">{item.title}</td>
      <td className="py-2 px-2 text-text-muted">{item.clientName || "—"}</td>
      <td className="py-2 px-2 space-y-1">
        <input
          value={carrier}
          onChange={(e) => setCarrier(e.target.value)}
          placeholder="transporteur"
          className="w-full bg-surface-2 border border-border-subtle px-2 py-1 text-xs"
        />
        <input
          value={trackingNumber}
          onChange={(e) => setTrackingNumber(e.target.value)}
          placeholder="n° tracking"
          className="w-full bg-surface-2 border border-border-subtle px-2 py-1 text-[10px] font-mono"
        />
      </td>
      <td className="py-2 px-2">
        <input
          type="date"
          value={expectedDate}
          onChange={(e) => setExpectedDate(e.target.value)}
          className="w-full bg-surface-2 border border-border-subtle px-2 py-1 text-xs font-mono"
        />
      </td>
      <td className="py-2 px-2">
        <input
          type="number"
          step="0.01"
          min="0"
          value={transportCost}
          onChange={(e) => setTransportCost(e.target.value)}
          placeholder="—"
          className="w-24 bg-surface-2 border border-border-subtle px-2 py-1 text-xs text-right font-mono"
        />
      </td>
      <td className="py-2 px-2 text-center">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as DeliveryStatus)}
          className="bg-surface-2 border border-border-subtle px-2 py-1 text-xs"
        >
          {DELIVERY_STATUSES.map((s) => (
            <option key={s} value={s}>{DELIVERY_STATUS_LABEL[s]}</option>
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
  currency,
  onCancel,
  onCreated,
}: {
  tenantSlug: string;
  currency: string;
  onCancel: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [ref, setRef] = useState("");
  const [clientName, setClientName] = useState("");
  const [shipFrom, setShipFrom] = useState("");
  const [shipTo, setShipTo] = useState("");
  const [carrier, setCarrier] = useState("");
  const [expectedDate, setExpectedDate] = useState("");
  const [transportCost, setTransportCost] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleCreate() {
    setSaving(true);
    setErr(null);
    try {
      const r = await fetch(`/api/admin/deliveries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantSlug,
          title: title.trim(),
          ref: ref.trim() || null,
          clientName: clientName.trim() || null,
          shipFrom: shipFrom.trim() || null,
          shipTo: shipTo.trim() || null,
          carrier: carrier.trim() || null,
          expectedDate: expectedDate.trim() || null,
          transportCost: transportCost.trim() === "" ? null : Number(transportCost),
          currency,
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
        <h3 className="text-[11px] font-bold uppercase text-accent-glow">Nouvelle livraison</h3>
        <button onClick={onCancel} className="text-text-muted hover:text-text-primary">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <Field label="Titre *">
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full bg-surface-2 border border-border-subtle px-2 py-1" />
        </Field>
        <Field label="Référence">
          <input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="unique par tenant" className="w-full bg-surface-2 border border-border-subtle px-2 py-1 font-mono" />
        </Field>
        <Field label="Client">
          <input value={clientName} onChange={(e) => setClientName(e.target.value)} className="w-full bg-surface-2 border border-border-subtle px-2 py-1" />
        </Field>
        <Field label="Transporteur">
          <input value={carrier} onChange={(e) => setCarrier(e.target.value)} className="w-full bg-surface-2 border border-border-subtle px-2 py-1" />
        </Field>
        <Field label="Origine">
          <input value={shipFrom} onChange={(e) => setShipFrom(e.target.value)} className="w-full bg-surface-2 border border-border-subtle px-2 py-1" />
        </Field>
        <Field label="Destination">
          <input value={shipTo} onChange={(e) => setShipTo(e.target.value)} className="w-full bg-surface-2 border border-border-subtle px-2 py-1" />
        </Field>
        <Field label="Date prévue">
          <input type="date" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} className="w-full bg-surface-2 border border-border-subtle px-2 py-1 font-mono" />
        </Field>
        <Field label={`Coût transport (${currency})`}>
          <input type="number" step="0.01" min="0" value={transportCost} onChange={(e) => setTransportCost(e.target.value)} className="w-full bg-surface-2 border border-border-subtle px-2 py-1 font-mono" />
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
        <button onClick={handleCreate} disabled={saving || !title.trim()} className="inline-flex items-center gap-1 px-3 py-1.5 text-[10px] uppercase font-bold border border-accent-primary/30 bg-accent-primary/20 text-accent-glow disabled:opacity-40">
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
          Créer
        </button>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: DeliveryStatus }) {
  const cls =
    status === "delivered" ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
    : status === "in_transit" ? "bg-blue-500/15 text-blue-300 border-blue-500/30"
    : status === "preparing" ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
    : status === "cancelled" ? "bg-text-muted/15 text-text-muted border-border-subtle"
    : "bg-surface-3/50 text-text-secondary border-border-subtle";
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 text-[9px] font-bold uppercase border ${cls}`}>
      {DELIVERY_STATUS_LABEL[status]}
    </span>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-2 border border-border-subtle bg-surface-2/50">
      <p className="text-[9px] uppercase text-text-muted">{label}</p>
      <p className="text-sm font-bold font-mono mt-0.5 text-text-primary">{value}</p>
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
