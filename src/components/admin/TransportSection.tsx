"use client";

// Bloc 7C — section Transport (étapes) dans /admin/tenants/[slug].
// Visible si architectureConfig.standardModules.transport=true.

import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus, AlertCircle, Route, Save, X } from "lucide-react";
import {
  type TransportLeg,
  type TransportMode,
  type TransportStatus,
  TRANSPORT_MODES,
  TRANSPORT_STATUSES,
  TRANSPORT_MODE_LABEL,
  TRANSPORT_STATUS_LABEL,
} from "@/lib/transport-types";
import type { Delivery } from "@/lib/delivery-types";

interface Props {
  tenantSlug: string;
  enabled: boolean;
  currency?: string;
}

export function TransportSection({ tenantSlug, enabled, currency = "EUR" }: Props) {
  const [items, setItems] = useState<TransportLeg[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  function load() {
    setLoading(true);
    setError(null);
    Promise.all([
      fetch(`/api/admin/transport?tenant=${encodeURIComponent(tenantSlug)}`).then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
        return j.items as TransportLeg[];
      }),
      fetch(`/api/admin/deliveries?tenant=${encodeURIComponent(tenantSlug)}`)
        .then(async (r) => {
          const j = await r.json().catch(() => ({}));
          if (!r.ok) return [] as Delivery[];
          return (j.items || []) as Delivery[];
        })
        .catch(() => [] as Delivery[]),
    ])
      .then(([legs, dlvs]) => {
        setItems(legs || []);
        setDeliveries(dlvs || []);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(load, [tenantSlug]);

  const totals = useMemo(() => {
    const open = items.filter((i) => i.status === "planned" || i.status === "in_progress");
    return { total: items.length, open: open.length };
  }, [items]);

  const deliveryLabel = (id: string | null) => {
    if (!id) return "indépendant";
    const d = deliveries.find((x) => x.id === id);
    return d ? d.title + (d.ref ? ` (${d.ref})` : "") : "—";
  };

  return (
    <section className="card-sharp p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Route className="w-4 h-4 text-accent-glow" />
          <h2 className="text-sm font-bold uppercase tracking-tight text-text-primary font-headline">
            Transport · étapes
          </h2>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          disabled={!enabled}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-[10px] font-bold uppercase tracking-tight border border-accent-primary/30 bg-accent-primary/10 text-accent-glow hover:bg-accent-primary/20 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Plus className="w-3 h-3" />
          Nouvelle étape
        </button>
      </div>

      {!enabled && (
        <div className="flex items-start gap-1.5 text-[11px] text-amber-300 bg-amber-400/10 border border-amber-400/30 px-3 py-2 mb-4">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>
            Module <span className="font-mono">transport</span> non déclaré dans
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
          <Stat label="Total étapes" value={String(totals.total)} />
          <Stat label="En cours" value={String(totals.open)} />
        </div>
      )}

      {showCreate && (
        <CreateForm
          tenantSlug={tenantSlug}
          currency={currency}
          deliveries={deliveries}
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
          Aucune étape de transport.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="border-b border-border-subtle text-text-muted text-[10px] uppercase tracking-wider">
              <tr>
                <th className="text-left py-2 px-2">Étape</th>
                <th className="text-left py-2 px-2">Origine → Destination</th>
                <th className="text-left py-2 px-2">Mode</th>
                <th className="text-left py-2 px-2">ETA</th>
                <th className="text-right py-2 px-2">Coût</th>
                <th className="text-left py-2 px-2">Livraison liée</th>
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
                    deliveryLabel={deliveryLabel(it.deliveryId)}
                    onCancel={() => setEditingId(null)}
                    onSaved={(updated) => {
                      setItems((arr) => arr.map((x) => (x.id === updated.id ? updated : x)));
                      setEditingId(null);
                    }}
                    onError={setError}
                  />
                ) : (
                  <ItemRow
                    key={it.id}
                    item={it}
                    deliveryLabel={deliveryLabel(it.deliveryId)}
                    onEdit={() => setEditingId(it.id)}
                  />
                )
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function ItemRow({
  item,
  deliveryLabel,
  onEdit,
}: {
  item: TransportLeg;
  deliveryLabel: string;
  onEdit: () => void;
}) {
  return (
    <tr className="hover:bg-surface-2/40">
      <td className="py-2 px-2 text-text-primary">{item.title}</td>
      <td className="py-2 px-2 text-text-secondary">
        {(item.origin || "—") + " → " + (item.destination || "—")}
        {item.carrier && (
          <div className="text-[10px] text-text-muted">via {item.carrier}</div>
        )}
      </td>
      <td className="py-2 px-2 text-text-muted">{TRANSPORT_MODE_LABEL[item.mode]}</td>
      <td className="py-2 px-2 font-mono text-text-secondary">{item.eta || "—"}</td>
      <td className="py-2 px-2 text-right font-mono">
        {item.cost !== null
          ? `${item.cost.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${item.currency}`
          : "—"}
      </td>
      <td className={`py-2 px-2 text-[10px] ${item.deliveryId ? "text-text-secondary" : "text-text-muted italic"}`}>
        {deliveryLabel}
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
  deliveryLabel,
  onCancel,
  onSaved,
  onError,
}: {
  item: TransportLeg;
  deliveryLabel: string;
  onCancel: () => void;
  onSaved: (it: TransportLeg) => void;
  onError: (e: string) => void;
}) {
  const [mode, setMode] = useState<TransportMode>(item.mode);
  const [status, setStatus] = useState<TransportStatus>(item.status);
  const [eta, setEta] = useState(item.eta || "");
  const [cost, setCost] = useState(item.cost !== null ? String(item.cost) : "");
  const [carrier, setCarrier] = useState(item.carrier || "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      const r = await fetch(`/api/admin/transport/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          status,
          eta: eta.trim() || null,
          cost: cost.trim() === "" ? null : Number(cost),
          carrier: carrier.trim() || null,
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
      <td className="py-2 px-2">
        <div className="text-[11px] text-text-secondary">
          {(item.origin || "—") + " → " + (item.destination || "—")}
        </div>
        <input
          value={carrier}
          onChange={(e) => setCarrier(e.target.value)}
          placeholder="transporteur"
          className="w-full mt-1 bg-surface-2 border border-border-subtle px-2 py-1 text-[10px]"
        />
      </td>
      <td className="py-2 px-2">
        <select
          value={mode}
          onChange={(e) => setMode(e.target.value as TransportMode)}
          className="bg-surface-2 border border-border-subtle px-2 py-1 text-xs"
        >
          {TRANSPORT_MODES.map((m) => (
            <option key={m} value={m}>{TRANSPORT_MODE_LABEL[m]}</option>
          ))}
        </select>
      </td>
      <td className="py-2 px-2">
        <input
          type="date"
          value={eta}
          onChange={(e) => setEta(e.target.value)}
          className="w-full bg-surface-2 border border-border-subtle px-2 py-1 text-xs font-mono"
        />
      </td>
      <td className="py-2 px-2">
        <input
          type="number"
          step="0.01"
          min="0"
          value={cost}
          onChange={(e) => setCost(e.target.value)}
          placeholder="—"
          className="w-24 bg-surface-2 border border-border-subtle px-2 py-1 text-xs text-right font-mono"
        />
      </td>
      <td className="py-2 px-2 text-[10px] text-text-muted italic">{deliveryLabel}</td>
      <td className="py-2 px-2 text-center">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as TransportStatus)}
          className="bg-surface-2 border border-border-subtle px-2 py-1 text-xs"
        >
          {TRANSPORT_STATUSES.map((s) => (
            <option key={s} value={s}>{TRANSPORT_STATUS_LABEL[s]}</option>
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
  deliveries,
  onCancel,
  onCreated,
}: {
  tenantSlug: string;
  currency: string;
  deliveries: Delivery[];
  onCancel: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [carrier, setCarrier] = useState("");
  const [mode, setMode] = useState<TransportMode>("road");
  const [deliveryId, setDeliveryId] = useState("");
  const [eta, setEta] = useState("");
  const [cost, setCost] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleCreate() {
    setSaving(true);
    setErr(null);
    try {
      const r = await fetch(`/api/admin/transport`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantSlug,
          title: title.trim(),
          origin: origin.trim() || null,
          destination: destination.trim() || null,
          carrier: carrier.trim() || null,
          mode,
          deliveryId: deliveryId || null,
          eta: eta.trim() || null,
          cost: cost.trim() === "" ? null : Number(cost),
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
        <h3 className="text-[11px] font-bold uppercase text-accent-glow">Nouvelle étape de transport</h3>
        <button onClick={onCancel} className="text-text-muted hover:text-text-primary">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <Field label="Titre *">
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full bg-surface-2 border border-border-subtle px-2 py-1" />
        </Field>
        <Field label="Mode">
          <select value={mode} onChange={(e) => setMode(e.target.value as TransportMode)} className="w-full bg-surface-2 border border-border-subtle px-2 py-1">
            {TRANSPORT_MODES.map((m) => (
              <option key={m} value={m}>{TRANSPORT_MODE_LABEL[m]}</option>
            ))}
          </select>
        </Field>
        <Field label="Origine">
          <input value={origin} onChange={(e) => setOrigin(e.target.value)} className="w-full bg-surface-2 border border-border-subtle px-2 py-1" />
        </Field>
        <Field label="Destination">
          <input value={destination} onChange={(e) => setDestination(e.target.value)} className="w-full bg-surface-2 border border-border-subtle px-2 py-1" />
        </Field>
        <Field label="Transporteur">
          <input value={carrier} onChange={(e) => setCarrier(e.target.value)} className="w-full bg-surface-2 border border-border-subtle px-2 py-1" />
        </Field>
        <Field label="Livraison liée (optionnel)">
          <select value={deliveryId} onChange={(e) => setDeliveryId(e.target.value)} className="w-full bg-surface-2 border border-border-subtle px-2 py-1">
            <option value="">indépendant</option>
            {deliveries.map((d) => (
              <option key={d.id} value={d.id}>
                {d.title}{d.ref ? ` (${d.ref})` : ""}
              </option>
            ))}
          </select>
        </Field>
        <Field label="ETA">
          <input type="date" value={eta} onChange={(e) => setEta(e.target.value)} className="w-full bg-surface-2 border border-border-subtle px-2 py-1 font-mono" />
        </Field>
        <Field label={`Coût (${currency})`}>
          <input type="number" step="0.01" min="0" value={cost} onChange={(e) => setCost(e.target.value)} className="w-full bg-surface-2 border border-border-subtle px-2 py-1 font-mono" />
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

function StatusBadge({ status }: { status: TransportStatus }) {
  const cls =
    status === "completed" ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
    : status === "in_progress" ? "bg-blue-500/15 text-blue-300 border-blue-500/30"
    : status === "cancelled" ? "bg-text-muted/15 text-text-muted border-border-subtle"
    : "bg-surface-3/50 text-text-secondary border-border-subtle";
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 text-[9px] font-bold uppercase border ${cls}`}>
      {TRANSPORT_STATUS_LABEL[status]}
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
