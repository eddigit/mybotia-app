"use client";

// Bloc 7D — VL Medical custom vertical : panel admin avec 3 sous-sections.
// Visible uniquement quand slug === 'vlmedical'.
// Bandeau "module custom facturable" obligatoire.

import { useEffect, useMemo, useState } from "react";
import {
  Loader2,
  Plus,
  AlertCircle,
  Save,
  X,
  Stethoscope,
  ShieldCheck,
  Package,
  Container,
} from "lucide-react";
import {
  type VlmStockExtra,
  type VlmRegulatory,
  type VlmContainerDeal,
  type VlmDeviceClass,
  type VlmRegulatoryStatus,
  type VlmDealStatus,
  VLM_DEVICE_CLASSES,
  VLM_REGULATORY_STATUSES,
  VLM_REGULATORY_STATUS_LABEL,
  VLM_DEAL_STATUSES,
  VLM_DEAL_STATUS_LABEL,
  computeVlmDealMargin,
} from "@/lib/vlm-types";
import type { StockItem } from "@/lib/stock-types";

interface Props {
  tenantSlug: string;
  enabled: boolean;
  currency?: string;
}

export function VlmPanel({ tenantSlug, enabled, currency = "EUR" }: Props) {
  if (tenantSlug !== "vlmedical") return null;

  return (
    <section className="card-sharp p-6 border-t-2 border-amber-400/30">
      <div className="flex items-center gap-2 mb-3">
        <Stethoscope className="w-5 h-5 text-amber-300" />
        <h2 className="text-base font-bold uppercase tracking-tight text-amber-300 font-headline">
          VL Medical · vertical import/export médical
        </h2>
      </div>

      <div className="flex items-start gap-2 p-3 border border-amber-400/30 bg-amber-400/10 text-[11px] text-amber-300 mb-6">
        <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
        <span>
          Module custom facturable VL Medical. Ces réglages ne font pas partie
          du standard MyBotIA et ne sont disponibles que pour le tenant <span className="font-mono">vlmedical</span>.
        </span>
      </div>

      {!enabled && (
        <div className="flex items-start gap-2 p-3 border border-blue-400/30 bg-blue-500/10 text-[11px] text-blue-300 mb-6">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>
            Vertical <span className="font-mono">medicalDistribution</span> non
            déclaré dans l&apos;architecture du tenant. Active le dans la
            section architecture pour utiliser ce module en condition
            opérationnelle.
          </span>
        </div>
      )}

      <div className="space-y-6">
        <StockExtraSection tenantSlug={tenantSlug} />
        <RegulatorySection tenantSlug={tenantSlug} />
        <ContainerDealsSection tenantSlug={tenantSlug} currency={currency} />
      </div>
    </section>
  );
}

// =====================================================================
// 1. Stock médical (extension VLM)
// =====================================================================

function StockExtraSection({ tenantSlug }: { tenantSlug: string }) {
  const [items, setItems] = useState<VlmStockExtra[]>([]);
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  function load() {
    setLoading(true);
    setError(null);
    Promise.all([
      fetch(`/api/admin/vlm/stock-extra?tenant=${encodeURIComponent(tenantSlug)}`).then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
        return j.items as VlmStockExtra[];
      }),
      fetch(`/api/admin/stock?tenant=${encodeURIComponent(tenantSlug)}`)
        .then(async (r) => {
          const j = await r.json().catch(() => ({}));
          if (!r.ok) return [] as StockItem[];
          return (j.items || []) as StockItem[];
        })
        .catch(() => [] as StockItem[]),
    ])
      .then(([extras, stocks]) => {
        setItems(extras || []);
        setStockItems(stocks || []);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(load, [tenantSlug]);

  const stockLabel = (id: string) => stockItems.find((s) => s.id === id)?.label || id.slice(0, 8) + "…";

  const availableStocks = useMemo(() => {
    const taken = new Set(items.map((i) => i.stockItemId));
    return stockItems.filter((s) => !taken.has(s.id));
  }, [items, stockItems]);

  return (
    <section className="border border-border-subtle p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Package className="w-4 h-4 text-amber-300" />
          <h3 className="text-sm font-bold uppercase tracking-tight text-text-primary">
            Stock médical
          </h3>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          disabled={availableStocks.length === 0}
          className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-bold uppercase tracking-tight border border-amber-400/30 bg-amber-400/10 text-amber-300 hover:bg-amber-400/20 disabled:opacity-40 disabled:cursor-not-allowed"
          title={availableStocks.length === 0 ? "Aucun stock_item sans extension" : ""}
        >
          <Plus className="w-3 h-3" />
          Étendre un stock item
        </button>
      </div>

      {error && (
        <div className="text-[11px] text-status-danger flex items-start gap-1 mb-3">
          <AlertCircle className="w-3 h-3 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {showCreate && (
        <StockExtraCreateForm
          tenantSlug={tenantSlug}
          availableStocks={availableStocks}
          onCancel={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            load();
          }}
        />
      )}

      {loading ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="w-4 h-4 animate-spin text-text-muted" />
        </div>
      ) : items.length === 0 ? (
        <p className="text-xs text-text-muted italic text-center py-3">
          Aucune extension VLM sur les stock items.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="border-b border-border-subtle text-text-muted text-[10px] uppercase tracking-wider">
              <tr>
                <th className="text-left py-2 px-2">Stock item</th>
                <th className="text-left py-2 px-2">Lot</th>
                <th className="text-left py-2 px-2">Péremption</th>
                <th className="text-left py-2 px-2">Catégorie</th>
                <th className="text-left py-2 px-2">CE</th>
                <th className="text-left py-2 px-2">Fournisseur / origine</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {items.map((it) => (
                <tr key={it.id} className="hover:bg-surface-2/40">
                  <td className="py-2 px-2 text-text-primary">{stockLabel(it.stockItemId)}</td>
                  <td className="py-2 px-2 font-mono text-text-secondary">{it.lotNumber || "—"}</td>
                  <td className="py-2 px-2 font-mono text-text-secondary">{it.expiryDate || "—"}</td>
                  <td className="py-2 px-2 text-text-secondary">{it.medicalCategory || "—"}</td>
                  <td className="py-2 px-2 font-mono text-text-muted">{it.ceMarking || "—"}</td>
                  <td className="py-2 px-2 text-text-muted">
                    {it.supplierName || "—"}{it.originCountry ? ` (${it.originCountry})` : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function StockExtraCreateForm({
  tenantSlug,
  availableStocks,
  onCancel,
  onCreated,
}: {
  tenantSlug: string;
  availableStocks: StockItem[];
  onCancel: () => void;
  onCreated: () => void;
}) {
  const [stockItemId, setStockItemId] = useState(availableStocks[0]?.id || "");
  const [lotNumber, setLotNumber] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [medicalCategory, setMedicalCategory] = useState("");
  const [ceMarking, setCeMarking] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [originCountry, setOriginCountry] = useState("");
  const [conditioning, setConditioning] = useState("");
  const [sterile, setSterile] = useState<"" | "true" | "false">("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleCreate() {
    setSaving(true);
    setErr(null);
    try {
      const r = await fetch(`/api/admin/vlm/stock-extra`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantSlug,
          stockItemId,
          lotNumber: lotNumber.trim() || null,
          expiryDate: expiryDate.trim() || null,
          medicalCategory: medicalCategory.trim() || null,
          ceMarking: ceMarking.trim() || null,
          supplierName: supplierName.trim() || null,
          originCountry: originCountry.trim() || null,
          conditioning: conditioning.trim() || null,
          sterile: sterile === "" ? null : sterile === "true",
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
    <div className="border border-amber-400/30 bg-amber-400/5 p-3 mb-3 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-[11px] font-bold uppercase text-amber-300">Extension VLM stock</h4>
        <button onClick={onCancel} className="text-text-muted hover:text-text-primary">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <Field label="Stock item *">
          <select value={stockItemId} onChange={(e) => setStockItemId(e.target.value)} className="w-full bg-surface-2 border border-border-subtle px-2 py-1">
            {availableStocks.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
        </Field>
        <Field label="N° lot">
          <input value={lotNumber} onChange={(e) => setLotNumber(e.target.value)} className="w-full bg-surface-2 border border-border-subtle px-2 py-1 font-mono" />
        </Field>
        <Field label="Péremption">
          <input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} className="w-full bg-surface-2 border border-border-subtle px-2 py-1 font-mono" />
        </Field>
        <Field label="Catégorie médicale">
          <input value={medicalCategory} onChange={(e) => setMedicalCategory(e.target.value)} placeholder="DM, réactif, stérile…" className="w-full bg-surface-2 border border-border-subtle px-2 py-1" />
        </Field>
        <Field label="Conditionnement">
          <input value={conditioning} onChange={(e) => setConditioning(e.target.value)} className="w-full bg-surface-2 border border-border-subtle px-2 py-1" />
        </Field>
        <Field label="Stérile">
          <select value={sterile} onChange={(e) => setSterile(e.target.value as "" | "true" | "false")} className="w-full bg-surface-2 border border-border-subtle px-2 py-1">
            <option value="">—</option>
            <option value="true">oui</option>
            <option value="false">non</option>
          </select>
        </Field>
        <Field label="N° marquage CE">
          <input value={ceMarking} onChange={(e) => setCeMarking(e.target.value)} className="w-full bg-surface-2 border border-border-subtle px-2 py-1 font-mono" />
        </Field>
        <Field label="Fournisseur">
          <input value={supplierName} onChange={(e) => setSupplierName(e.target.value)} className="w-full bg-surface-2 border border-border-subtle px-2 py-1" />
        </Field>
        <Field label="Pays origine">
          <input value={originCountry} onChange={(e) => setOriginCountry(e.target.value)} className="w-full bg-surface-2 border border-border-subtle px-2 py-1" />
        </Field>
      </div>
      {err && (
        <div className="text-[11px] text-status-danger flex items-start gap-1">
          <AlertCircle className="w-3 h-3 mt-0.5" />
          <span>{err}</span>
        </div>
      )}
      <div className="flex justify-end gap-2">
        <button onClick={onCancel} className="px-3 py-1 text-[10px] uppercase border border-border-subtle text-text-muted">
          Annuler
        </button>
        <button onClick={handleCreate} disabled={saving || !stockItemId} className="inline-flex items-center gap-1 px-3 py-1 text-[10px] uppercase font-bold border border-amber-400/30 bg-amber-400/20 text-amber-300 disabled:opacity-40">
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
          Étendre
        </button>
      </div>
    </div>
  );
}

// =====================================================================
// 2. Réglementation
// =====================================================================

function RegulatorySection({ tenantSlug }: { tenantSlug: string }) {
  const [items, setItems] = useState<VlmRegulatory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  function load() {
    setLoading(true);
    setError(null);
    fetch(`/api/admin/vlm/regulatory?tenant=${encodeURIComponent(tenantSlug)}`)
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

  return (
    <section className="border border-border-subtle p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-amber-300" />
          <h3 className="text-sm font-bold uppercase tracking-tight text-text-primary">
            Réglementation médicale
          </h3>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-bold uppercase tracking-tight border border-amber-400/30 bg-amber-400/10 text-amber-300 hover:bg-amber-400/20"
        >
          <Plus className="w-3 h-3" />
          Nouveau dossier
        </button>
      </div>

      {error && (
        <div className="text-[11px] text-status-danger flex items-start gap-1 mb-3">
          <AlertCircle className="w-3 h-3 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {showCreate && (
        <RegulatoryCreateForm
          tenantSlug={tenantSlug}
          onCancel={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            load();
          }}
        />
      )}

      {loading ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="w-4 h-4 animate-spin text-text-muted" />
        </div>
      ) : items.length === 0 ? (
        <p className="text-xs text-text-muted italic text-center py-3">
          Aucun dossier réglementaire.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="border-b border-border-subtle text-text-muted text-[10px] uppercase tracking-wider">
              <tr>
                <th className="text-left py-2 px-2">N° ANSM</th>
                <th className="text-left py-2 px-2">N° certificat CE</th>
                <th className="text-left py-2 px-2">Classe DM</th>
                <th className="text-center py-2 px-2">Statut</th>
                <th className="text-left py-2 px-2">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {items.map((it) => (
                <tr key={it.id} className="hover:bg-surface-2/40">
                  <td className="py-2 px-2 font-mono text-text-secondary">{it.ansmFileNumber || "—"}</td>
                  <td className="py-2 px-2 font-mono text-text-secondary">{it.ceCertificateNumber || "—"}</td>
                  <td className="py-2 px-2 text-text-primary">{it.deviceClass || "—"}</td>
                  <td className="py-2 px-2 text-center">
                    <RegulatoryBadge status={it.regulatoryStatus} />
                  </td>
                  <td className="py-2 px-2 text-text-muted text-[10px] max-w-xs truncate">
                    {it.complianceNotes || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function RegulatoryCreateForm({
  tenantSlug,
  onCancel,
  onCreated,
}: {
  tenantSlug: string;
  onCancel: () => void;
  onCreated: () => void;
}) {
  const [ansmFileNumber, setAnsmFileNumber] = useState("");
  const [ceCertificateNumber, setCeCertificateNumber] = useState("");
  const [deviceClass, setDeviceClass] = useState<VlmDeviceClass | "">("");
  const [regulatoryStatus, setRegulatoryStatus] = useState<VlmRegulatoryStatus>("to_configure");
  const [complianceNotes, setComplianceNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleCreate() {
    setSaving(true);
    setErr(null);
    try {
      const r = await fetch(`/api/admin/vlm/regulatory`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantSlug,
          ansmFileNumber: ansmFileNumber.trim() || null,
          ceCertificateNumber: ceCertificateNumber.trim() || null,
          deviceClass: deviceClass || null,
          regulatoryStatus,
          complianceNotes: complianceNotes.trim() || null,
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
    <div className="border border-amber-400/30 bg-amber-400/5 p-3 mb-3 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-[11px] font-bold uppercase text-amber-300">Nouveau dossier réglementaire</h4>
        <button onClick={onCancel} className="text-text-muted hover:text-text-primary">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <Field label="N° dossier ANSM">
          <input value={ansmFileNumber} onChange={(e) => setAnsmFileNumber(e.target.value)} className="w-full bg-surface-2 border border-border-subtle px-2 py-1 font-mono" />
        </Field>
        <Field label="N° certificat CE">
          <input value={ceCertificateNumber} onChange={(e) => setCeCertificateNumber(e.target.value)} className="w-full bg-surface-2 border border-border-subtle px-2 py-1 font-mono" />
        </Field>
        <Field label="Classe DM">
          <select value={deviceClass} onChange={(e) => setDeviceClass(e.target.value as VlmDeviceClass | "")} className="w-full bg-surface-2 border border-border-subtle px-2 py-1">
            <option value="">—</option>
            {VLM_DEVICE_CLASSES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </Field>
        <Field label="Statut">
          <select value={regulatoryStatus} onChange={(e) => setRegulatoryStatus(e.target.value as VlmRegulatoryStatus)} className="w-full bg-surface-2 border border-border-subtle px-2 py-1">
            {VLM_REGULATORY_STATUSES.map((s) => (
              <option key={s} value={s}>{VLM_REGULATORY_STATUS_LABEL[s]}</option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Notes conformité">
        <textarea value={complianceNotes} onChange={(e) => setComplianceNotes(e.target.value)} rows={2} className="w-full bg-surface-2 border border-border-subtle px-2 py-1 text-xs" />
      </Field>
      {err && (
        <div className="text-[11px] text-status-danger flex items-start gap-1">
          <AlertCircle className="w-3 h-3 mt-0.5" />
          <span>{err}</span>
        </div>
      )}
      <div className="flex justify-end gap-2">
        <button onClick={onCancel} className="px-3 py-1 text-[10px] uppercase border border-border-subtle text-text-muted">
          Annuler
        </button>
        <button onClick={handleCreate} disabled={saving} className="inline-flex items-center gap-1 px-3 py-1 text-[10px] uppercase font-bold border border-amber-400/30 bg-amber-400/20 text-amber-300 disabled:opacity-40">
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
          Créer
        </button>
      </div>
    </div>
  );
}

function RegulatoryBadge({ status }: { status: VlmRegulatoryStatus }) {
  const cls =
    status === "compliant" ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
    : status === "pending" ? "bg-blue-500/15 text-blue-300 border-blue-500/30"
    : status === "expired" ? "bg-status-danger/15 text-status-danger border-status-danger/30"
    : status === "not_applicable" ? "bg-text-muted/15 text-text-muted border-border-subtle"
    : "bg-amber-500/15 text-amber-300 border-amber-500/30";
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 text-[9px] font-bold uppercase border ${cls}`}>
      {VLM_REGULATORY_STATUS_LABEL[status]}
    </span>
  );
}

// =====================================================================
// 3. Container deals & marges
// =====================================================================

function ContainerDealsSection({ tenantSlug, currency }: { tenantSlug: string; currency: string }) {
  const [items, setItems] = useState<VlmContainerDeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  function load() {
    setLoading(true);
    setError(null);
    fetch(`/api/admin/vlm/container-deals?tenant=${encodeURIComponent(tenantSlug)}`)
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
    let totalCost = 0;
    let totalSale = 0;
    for (const d of items) {
      const m = computeVlmDealMargin(d);
      totalCost += m.totalCost;
      if (d.saleAmount !== null) totalSale += d.saleAmount;
    }
    const grossMargin = totalSale - totalCost;
    return { count: items.length, totalCost, totalSale, grossMargin };
  }, [items]);

  return (
    <section className="border border-border-subtle p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Container className="w-4 h-4 text-amber-300" />
          <h3 className="text-sm font-bold uppercase tracking-tight text-text-primary">
            Deals containers · marges
          </h3>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-bold uppercase tracking-tight border border-amber-400/30 bg-amber-400/10 text-amber-300 hover:bg-amber-400/20"
        >
          <Plus className="w-3 h-3" />
          Nouveau deal
        </button>
      </div>

      {error && (
        <div className="text-[11px] text-status-danger flex items-start gap-1 mb-3">
          <AlertCircle className="w-3 h-3 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {totals.count > 0 && (
        <div className="grid grid-cols-4 gap-2 mb-3 text-[10px]">
          <Stat label="Deals" value={String(totals.count)} />
          <Stat label="Coûts cumulés" value={fmtMoney(totals.totalCost, currency)} />
          <Stat label="Ventes cumulées" value={fmtMoney(totals.totalSale, currency)} />
          <Stat
            label="Marge brute"
            value={fmtMoney(totals.grossMargin, currency)}
            tone={totals.grossMargin >= 0 ? "good" : "warn"}
          />
        </div>
      )}

      {showCreate && (
        <DealCreateForm
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
        <div className="flex items-center justify-center py-4">
          <Loader2 className="w-4 h-4 animate-spin text-text-muted" />
        </div>
      ) : items.length === 0 ? (
        <p className="text-xs text-text-muted italic text-center py-3">
          Aucun deal container.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="border-b border-border-subtle text-text-muted text-[10px] uppercase tracking-wider">
              <tr>
                <th className="text-left py-2 px-2">Deal</th>
                <th className="text-left py-2 px-2">Origine → Dest</th>
                <th className="text-right py-2 px-2">Achat</th>
                <th className="text-right py-2 px-2">Coûts</th>
                <th className="text-right py-2 px-2">Total coût</th>
                <th className="text-right py-2 px-2">Vente</th>
                <th className="text-right py-2 px-2">Marge brute</th>
                <th className="text-right py-2 px-2">Taux</th>
                <th className="text-center py-2 px-2">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {items.map((d) => {
                const m = computeVlmDealMargin(d);
                const otherCosts =
                  (d.transportCost ?? 0) +
                  (d.customsCost ?? 0) +
                  (d.insuranceCost ?? 0) +
                  (d.conditioningCost ?? 0) +
                  (d.otherCost ?? 0);
                return (
                  <tr key={d.id} className="hover:bg-surface-2/40">
                    <td className="py-2 px-2">
                      <div className="text-text-primary">{d.title}</div>
                      {d.ref && <div className="text-text-muted font-mono text-[10px]">{d.ref}</div>}
                    </td>
                    <td className="py-2 px-2 text-text-secondary text-[10px]">
                      {(d.originCountry || "—") + " → " + (d.destinationCountry || "—")}
                      {d.containerType && <div className="text-text-muted">{d.containerType}</div>}
                    </td>
                    <td className="py-2 px-2 text-right font-mono text-text-secondary">
                      {fmtMoney(d.purchaseAmount, d.currency)}
                    </td>
                    <td className="py-2 px-2 text-right font-mono text-text-muted">
                      {otherCosts > 0 ? fmtMoney(otherCosts, d.currency) : "—"}
                    </td>
                    <td className="py-2 px-2 text-right font-mono text-text-primary">
                      {fmtMoney(m.totalCost, d.currency)}
                    </td>
                    <td className="py-2 px-2 text-right font-mono text-text-secondary">
                      {fmtMoney(d.saleAmount, d.currency)}
                    </td>
                    <td
                      className={`py-2 px-2 text-right font-mono ${
                        m.grossMargin === null
                          ? "text-text-muted"
                          : m.grossMargin >= 0
                          ? "text-emerald-300"
                          : "text-status-danger"
                      }`}
                    >
                      {m.grossMargin !== null ? fmtMoney(m.grossMargin, d.currency) : "—"}
                    </td>
                    <td className="py-2 px-2 text-right font-mono text-text-muted">
                      {m.marginRate !== null ? `${(m.marginRate * 100).toFixed(1)}%` : "—"}
                    </td>
                    <td className="py-2 px-2 text-center">
                      <DealBadge status={d.status} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function DealCreateForm({
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
  const [supplierName, setSupplierName] = useState("");
  const [originCountry, setOriginCountry] = useState("");
  const [destinationCountry, setDestinationCountry] = useState("");
  const [containerType, setContainerType] = useState("");
  const [purchaseAmount, setPurchaseAmount] = useState("");
  const [transportCost, setTransportCost] = useState("");
  const [customsCost, setCustomsCost] = useState("");
  const [insuranceCost, setInsuranceCost] = useState("");
  const [conditioningCost, setConditioningCost] = useState("");
  const [otherCost, setOtherCost] = useState("");
  const [saleAmount, setSaleAmount] = useState("");
  const [status, setStatus] = useState<VlmDealStatus>("draft");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const preview = useMemo(() => {
    const partial = {
      purchaseAmount: purchaseAmount === "" ? null : Number(purchaseAmount),
      transportCost: transportCost === "" ? null : Number(transportCost),
      customsCost: customsCost === "" ? null : Number(customsCost),
      insuranceCost: insuranceCost === "" ? null : Number(insuranceCost),
      conditioningCost: conditioningCost === "" ? null : Number(conditioningCost),
      otherCost: otherCost === "" ? null : Number(otherCost),
      saleAmount: saleAmount === "" ? null : Number(saleAmount),
    } as Partial<VlmContainerDeal>;
    return computeVlmDealMargin({
      // minimal stub to satisfy the helper
      id: "preview",
      tenantId: "",
      deliveryId: null,
      ref: null,
      title: "preview",
      supplierName: null,
      originCountry: null,
      destinationCountry: null,
      containerType: null,
      currency,
      status: "draft",
      notes: null,
      createdAt: "",
      updatedAt: "",
      purchaseAmount: partial.purchaseAmount ?? null,
      transportCost: partial.transportCost ?? null,
      customsCost: partial.customsCost ?? null,
      insuranceCost: partial.insuranceCost ?? null,
      conditioningCost: partial.conditioningCost ?? null,
      otherCost: partial.otherCost ?? null,
      saleAmount: partial.saleAmount ?? null,
    });
  }, [purchaseAmount, transportCost, customsCost, insuranceCost, conditioningCost, otherCost, saleAmount, currency]);

  async function handleCreate() {
    setSaving(true);
    setErr(null);
    try {
      const r = await fetch(`/api/admin/vlm/container-deals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantSlug,
          title: title.trim(),
          ref: ref.trim() || null,
          supplierName: supplierName.trim() || null,
          originCountry: originCountry.trim() || null,
          destinationCountry: destinationCountry.trim() || null,
          containerType: containerType.trim() || null,
          purchaseAmount: purchaseAmount === "" ? null : Number(purchaseAmount),
          transportCost: transportCost === "" ? null : Number(transportCost),
          customsCost: customsCost === "" ? null : Number(customsCost),
          insuranceCost: insuranceCost === "" ? null : Number(insuranceCost),
          conditioningCost: conditioningCost === "" ? null : Number(conditioningCost),
          otherCost: otherCost === "" ? null : Number(otherCost),
          saleAmount: saleAmount === "" ? null : Number(saleAmount),
          currency,
          status,
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
    <div className="border border-amber-400/30 bg-amber-400/5 p-3 mb-3 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-[11px] font-bold uppercase text-amber-300">Nouveau deal container</h4>
        <button onClick={onCancel} className="text-text-muted hover:text-text-primary">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="grid grid-cols-3 gap-2 text-xs">
        <Field label="Titre *">
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full bg-surface-2 border border-border-subtle px-2 py-1" />
        </Field>
        <Field label="Référence">
          <input value={ref} onChange={(e) => setRef(e.target.value)} className="w-full bg-surface-2 border border-border-subtle px-2 py-1 font-mono" />
        </Field>
        <Field label="Statut">
          <select value={status} onChange={(e) => setStatus(e.target.value as VlmDealStatus)} className="w-full bg-surface-2 border border-border-subtle px-2 py-1">
            {VLM_DEAL_STATUSES.map((s) => (
              <option key={s} value={s}>{VLM_DEAL_STATUS_LABEL[s]}</option>
            ))}
          </select>
        </Field>
        <Field label="Fournisseur">
          <input value={supplierName} onChange={(e) => setSupplierName(e.target.value)} className="w-full bg-surface-2 border border-border-subtle px-2 py-1" />
        </Field>
        <Field label="Origine">
          <input value={originCountry} onChange={(e) => setOriginCountry(e.target.value)} className="w-full bg-surface-2 border border-border-subtle px-2 py-1" />
        </Field>
        <Field label="Destination">
          <input value={destinationCountry} onChange={(e) => setDestinationCountry(e.target.value)} className="w-full bg-surface-2 border border-border-subtle px-2 py-1" />
        </Field>
        <Field label="Type container">
          <input value={containerType} onChange={(e) => setContainerType(e.target.value)} placeholder="20'DV, 40'HC…" className="w-full bg-surface-2 border border-border-subtle px-2 py-1" />
        </Field>
        <Field label={`Achat (${currency})`}>
          <input type="number" step="0.01" min="0" value={purchaseAmount} onChange={(e) => setPurchaseAmount(e.target.value)} className="w-full bg-surface-2 border border-border-subtle px-2 py-1 font-mono" />
        </Field>
        <Field label={`Transport (${currency})`}>
          <input type="number" step="0.01" min="0" value={transportCost} onChange={(e) => setTransportCost(e.target.value)} className="w-full bg-surface-2 border border-border-subtle px-2 py-1 font-mono" />
        </Field>
        <Field label={`Douane (${currency})`}>
          <input type="number" step="0.01" min="0" value={customsCost} onChange={(e) => setCustomsCost(e.target.value)} className="w-full bg-surface-2 border border-border-subtle px-2 py-1 font-mono" />
        </Field>
        <Field label={`Assurance (${currency})`}>
          <input type="number" step="0.01" min="0" value={insuranceCost} onChange={(e) => setInsuranceCost(e.target.value)} className="w-full bg-surface-2 border border-border-subtle px-2 py-1 font-mono" />
        </Field>
        <Field label={`Conditionnement (${currency})`}>
          <input type="number" step="0.01" min="0" value={conditioningCost} onChange={(e) => setConditioningCost(e.target.value)} className="w-full bg-surface-2 border border-border-subtle px-2 py-1 font-mono" />
        </Field>
        <Field label={`Autres (${currency})`}>
          <input type="number" step="0.01" min="0" value={otherCost} onChange={(e) => setOtherCost(e.target.value)} className="w-full bg-surface-2 border border-border-subtle px-2 py-1 font-mono" />
        </Field>
        <Field label={`Vente (${currency})`}>
          <input type="number" step="0.01" min="0" value={saleAmount} onChange={(e) => setSaleAmount(e.target.value)} className="w-full bg-surface-2 border border-border-subtle px-2 py-1 font-mono" />
        </Field>
      </div>
      <div className="grid grid-cols-3 gap-2 p-2 bg-surface-2/50 border border-border-subtle">
        <Stat label="Total coût (preview)" value={fmtMoney(preview.totalCost, currency)} />
        <Stat
          label="Marge brute (preview)"
          value={preview.grossMargin !== null ? fmtMoney(preview.grossMargin, currency) : "—"}
          tone={preview.grossMargin === null ? "neutral" : preview.grossMargin >= 0 ? "good" : "warn"}
        />
        <Stat
          label="Taux marge (preview)"
          value={preview.marginRate !== null ? `${(preview.marginRate * 100).toFixed(1)}%` : "—"}
        />
      </div>
      {err && (
        <div className="text-[11px] text-status-danger flex items-start gap-1">
          <AlertCircle className="w-3 h-3 mt-0.5" />
          <span>{err}</span>
        </div>
      )}
      <div className="flex justify-end gap-2">
        <button onClick={onCancel} className="px-3 py-1 text-[10px] uppercase border border-border-subtle text-text-muted">
          Annuler
        </button>
        <button onClick={handleCreate} disabled={saving || !title.trim()} className="inline-flex items-center gap-1 px-3 py-1 text-[10px] uppercase font-bold border border-amber-400/30 bg-amber-400/20 text-amber-300 disabled:opacity-40">
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
          Créer
        </button>
      </div>
    </div>
  );
}

function DealBadge({ status }: { status: VlmDealStatus }) {
  const cls =
    status === "delivered" || status === "billed" ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
    : status === "in_transit" ? "bg-blue-500/15 text-blue-300 border-blue-500/30"
    : status === "ordered" ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
    : status === "cancelled" ? "bg-text-muted/15 text-text-muted border-border-subtle"
    : "bg-surface-3/50 text-text-secondary border-border-subtle";
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 text-[9px] font-bold uppercase border ${cls}`}>
      {VLM_DEAL_STATUS_LABEL[status]}
    </span>
  );
}

// =====================================================================
// helpers
// =====================================================================

function fmtMoney(n: number | null, currency: string): string {
  if (n === null) return "—";
  return `${n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "neutral" | "good" | "warn" }) {
  const colorClass =
    tone === "good" ? "text-emerald-300"
    : tone === "warn" ? "text-status-danger"
    : "text-text-primary";
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
