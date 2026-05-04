"use client";

// Bloc 7E — Page métier VL Medical (cockpit Max).
// Bloc 7H — onglet Devis ajouté.

import { useEffect, useMemo, useState } from "react";
import {
  Stethoscope,
  Loader2,
  AlertCircle,
  AlertTriangle,
  Container,
  Package,
  Truck,
  ShieldCheck,
  LayoutDashboard,
  RefreshCw,
  FileDown,
  FileText,
} from "lucide-react";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { QuotesTab } from "@/components/vlm/QuotesTab";

interface Summary {
  generatedAt: string;
  tenant: string;
  deals: {
    count: number;
    activeCount: number;
    totalCost: number;
    totalSale: number;
    grossMargin: number;
    marginRate: number | null;
    currency: string;
  };
  stock: {
    itemCount: number;
    lowStockCount: number;
    extraCount: number;
  };
  deliveries: {
    count: number;
    inTransit: number;
    delivered: number;
  };
  regulatory: {
    count: number;
    toConfigure: number;
    expired: number;
    compliant: number;
  };
  quotes: {
    total: number;
    draft: number;
    sent: number;
    accepted: number;
    refused: number;
    cancelled: number;
    acceptedTotalHt: number;
    acceptedTotalTtc: number;
    pendingTotalHt: number;
    pendingTotalTtc: number;
    conversionRate: number | null;
    latestQuote: {
      ref: string;
      clientName: string;
      totalTtc: number;
      status: string;
      createdAt: string;
    } | null;
  };
  expiryAlerts: Array<{
    stockItemId: string;
    label: string;
    lotNumber: string | null;
    expiryDate: string;
    daysLeft: number;
  }>;
}

type TabKey = "overview" | "containers" | "stock" | "deliveries" | "regulatory" | "quotes";

const TABS: Array<{ key: TabKey; label: string; icon: typeof LayoutDashboard }> = [
  { key: "overview", label: "Résumé", icon: LayoutDashboard },
  { key: "containers", label: "Containers & marges", icon: Container },
  { key: "stock", label: "Stock médical", icon: Package },
  { key: "deliveries", label: "Livraisons", icon: Truck },
  { key: "regulatory", label: "Réglementation", icon: ShieldCheck },
  { key: "quotes", label: "Devis", icon: FileText },
];

function fmtMoney(n: number | null, currency: string): string {
  if (n === null || n === undefined) return "—";
  return `${n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}
function fmtNum(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return n.toLocaleString("fr-FR");
}

export default function VlmPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>("overview");
  // Bloc 7I — basculer vers l'onglet Devis et ouvrir le devis créé en détail
  const [pendingOpenQuoteId, setPendingOpenQuoteId] = useState<string | null>(null);

  function loadSummary() {
    setLoading(true);
    setError(null);
    fetch("/api/vlm/summary")
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
        return j as Summary;
      })
      .then(setSummary)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(loadSummary, []);

  if (loading) {
    return (
      <div className="p-8 min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-amber-300" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <ModuleHeader icon={Stethoscope} title="VL Medical" subtitle="Cockpit import/export médical" />
        <div className="mt-6 flex items-start gap-2 p-4 border border-status-danger/30 bg-status-danger/10 text-status-danger text-sm">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      </div>
    );
  }

  if (!summary) return null;

  return (
    <div className="p-8 min-h-screen space-y-6">
      <ModuleHeader
        icon={Stethoscope}
        title="VL Medical"
        subtitle="Cockpit import/export médical · containers, stock, livraisons, réglementation"
        actions={
          <button
            onClick={loadSummary}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-tight border border-border-subtle text-text-muted hover:text-text-primary hover:border-amber-400/30"
          >
            <RefreshCw className="w-3 h-3" />
            Actualiser
          </button>
        }
      />

      {/* KPI strip toujours visible */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Containers actifs" value={fmtNum(summary.deals.activeCount)} sub={`/ ${summary.deals.count} total`} />
        <Kpi
          label="Marge brute cumulée"
          value={fmtMoney(summary.deals.grossMargin, summary.deals.currency)}
          sub={summary.deals.marginRate !== null ? `${(summary.deals.marginRate * 100).toFixed(1)} %` : null}
          tone={summary.deals.grossMargin >= 0 ? "good" : "warn"}
        />
        <Kpi
          label="Stock sous seuil"
          value={fmtNum(summary.stock.lowStockCount)}
          sub={`/ ${summary.stock.itemCount} items`}
          tone={summary.stock.lowStockCount > 0 ? "warn" : "neutral"}
        />
        <Kpi
          label="Réglementaire à traiter"
          value={fmtNum(summary.regulatory.toConfigure + summary.regulatory.expired)}
          sub={`/ ${summary.regulatory.count} dossiers`}
          tone={summary.regulatory.expired > 0 ? "warn" : "neutral"}
        />
      </div>

      {/* Alertes péremption < 90 jours */}
      {summary.expiryAlerts.length > 0 && (
        <div className="card-sharp p-5 border-l-4 border-amber-400">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-amber-300" />
            <h2 className="text-sm font-bold uppercase tracking-tight text-amber-300 font-headline">
              Alertes péremption · prochains 90 jours
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="border-b border-border-subtle text-text-muted text-[10px] uppercase tracking-wider">
                <tr>
                  <th className="text-left py-2 px-2">Stock item</th>
                  <th className="text-left py-2 px-2">Lot</th>
                  <th className="text-left py-2 px-2">Péremption</th>
                  <th className="text-right py-2 px-2">Jours restants</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {summary.expiryAlerts.map((a) => (
                  <tr key={a.stockItemId + a.expiryDate} className={a.daysLeft < 0 ? "text-status-danger" : a.daysLeft < 30 ? "text-amber-300" : "text-text-secondary"}>
                    <td className="py-2 px-2">{a.label}</td>
                    <td className="py-2 px-2 font-mono">{a.lotNumber || "—"}</td>
                    <td className="py-2 px-2 font-mono">{a.expiryDate}</td>
                    <td className="py-2 px-2 text-right font-mono">{a.daysLeft >= 0 ? `${a.daysLeft} j` : `expiré ${-a.daysLeft} j`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 border-b border-border-subtle">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-tight transition-colors border-b-2 ${
              tab === key
                ? "text-amber-300 border-amber-400"
                : "text-text-muted border-transparent hover:text-text-secondary"
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {tab === "overview" && <OverviewSection summary={summary} />}
      {tab === "containers" && (
        <ContainersTab
          onQuoteCreated={(quoteId) => {
            setPendingOpenQuoteId(quoteId);
            setTab("quotes");
          }}
        />
      )}
      {tab === "stock" && <StockTab />}
      {tab === "deliveries" && <DeliveriesTab />}
      {tab === "regulatory" && <RegulatoryTab />}
      {tab === "quotes" && (
        <QuotesTab
          openQuoteId={pendingOpenQuoteId}
          onConsumed={() => setPendingOpenQuoteId(null)}
        />
      )}
    </div>
  );
}

function OverviewSection({ summary }: { summary: Summary }) {
  const c = summary.deals.currency;
  const q = summary.quotes;
  const fmtPct = (v: number | null) => (v === null ? "—" : `${(v * 100).toFixed(0)} %`);
  const fmtDateShort = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit" });
  };
  return (
    <section className="card-sharp p-6 space-y-6">
      <h2 className="text-sm font-bold uppercase tracking-tight text-text-primary font-headline">
        Résumé global
      </h2>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Detail label="Containers (total / actifs)" value={`${summary.deals.count} / ${summary.deals.activeCount}`} />
        <Detail label="Coûts cumulés" value={fmtMoney(summary.deals.totalCost, c)} />
        <Detail label="Ventes cumulées" value={fmtMoney(summary.deals.totalSale, c)} />
        <Detail
          label="Marge brute"
          value={fmtMoney(summary.deals.grossMargin, c)}
          tone={summary.deals.grossMargin >= 0 ? "good" : "warn"}
        />
        <Detail
          label="Taux de marge moyen"
          value={summary.deals.marginRate !== null ? `${(summary.deals.marginRate * 100).toFixed(2)} %` : "—"}
        />
        <Detail label="Stock items" value={fmtNum(summary.stock.itemCount)} sub={`extensions VLM : ${summary.stock.extraCount}`} />
        <Detail label="Stock sous seuil" value={fmtNum(summary.stock.lowStockCount)} tone={summary.stock.lowStockCount > 0 ? "warn" : "neutral"} />
        <Detail label="Livraisons en transit" value={fmtNum(summary.deliveries.inTransit)} sub={`livrées : ${summary.deliveries.delivered}`} />
        <Detail
          label="Dossiers réglementaires"
          value={fmtNum(summary.regulatory.count)}
          sub={`conformes : ${summary.regulatory.compliant} · à configurer : ${summary.regulatory.toConfigure} · expirés : ${summary.regulatory.expired}`}
        />
      </div>

      {/* Bloc 7N — Section Devis commerciaux */}
      <div className="border-t border-border-subtle pt-6">
        <h2 className="text-sm font-bold uppercase tracking-tight text-text-primary font-headline mb-3">
          Devis commerciaux
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
          <Detail label="Total devis" value={fmtNum(q.total)} />
          <Detail
            label="Brouillons"
            value={fmtNum(q.draft)}
            tone={q.draft > 0 ? "neutral" : "neutral"}
          />
          <Detail
            label="Envoyés / en attente"
            value={fmtNum(q.sent)}
            tone={q.sent > 0 ? "good" : "neutral"}
          />
          <Detail
            label="Acceptés"
            value={fmtNum(q.accepted)}
            tone={q.accepted > 0 ? "good" : "neutral"}
          />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
          <Detail
            label="Montant accepté TTC"
            value={fmtMoney(q.acceptedTotalTtc, c)}
            sub={`HT ${fmtMoney(q.acceptedTotalHt, c)}`}
            tone={q.acceptedTotalTtc > 0 ? "good" : "neutral"}
          />
          <Detail
            label="Montant en attente TTC"
            value={fmtMoney(q.pendingTotalTtc, c)}
            sub={`HT ${fmtMoney(q.pendingTotalHt, c)}`}
            tone={q.pendingTotalTtc > 0 ? "neutral" : "neutral"}
          />
          <Detail
            label="Taux conversion"
            value={fmtPct(q.conversionRate)}
            sub={`accepté / (accepté + refusé) · refusés : ${q.refused} · annulés : ${q.cancelled}`}
            tone={q.conversionRate !== null && q.conversionRate >= 0.5 ? "good" : q.conversionRate !== null && q.conversionRate < 0.3 ? "warn" : "neutral"}
          />
          <Detail
            label="Dernier devis"
            value={q.latestQuote ? q.latestQuote.ref : "—"}
            sub={
              q.latestQuote
                ? `${q.latestQuote.clientName} · ${fmtMoney(q.latestQuote.totalTtc, c)} · ${fmtDateShort(q.latestQuote.createdAt)}`
                : "Aucun devis"
            }
          />
        </div>
      </div>
    </section>
  );
}

// ---------- Containers tab ----------

interface ContainerItem {
  id: string;
  ref: string | null;
  title: string;
  supplierName: string | null;
  originCountry: string | null;
  destinationCountry: string | null;
  containerType: string | null;
  purchaseAmount: number | null;
  transportCost: number | null;
  customsCost: number | null;
  insuranceCost: number | null;
  conditioningCost: number | null;
  otherCost: number | null;
  saleAmount: number | null;
  currency: string;
  status: string;
  notes: string | null;
  createdAt: string;
  margin: { totalCost: number; grossMargin: number | null; marginRate: number | null };
}

function ContainersTab({ onQuoteCreated }: { onQuoteCreated: (quoteId: string) => void }) {
  const [items, setItems] = useState<ContainerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creatingQuoteForId, setCreatingQuoteForId] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch("/api/vlm/containers")
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
        return j;
      })
      .then((j) => setItems(j.items || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function createQuoteFromDeal(dealId: string) {
    setCreatingQuoteForId(dealId);
    setError(null);
    try {
      const r = await fetch("/api/vlm/quotes/from-deal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dealId }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      onQuoteCreated(j.item.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setCreatingQuoteForId(null);
    }
  }

  if (loading) return <SectionLoader />;
  if (error) return <SectionError msg={error} />;
  if (items.length === 0) return <SectionEmpty msg="Aucun deal container." />;

  return (
    <section className="card-sharp p-6 overflow-x-auto">
      <table className="w-full text-xs">
        <thead className="border-b border-border-subtle text-text-muted text-[10px] uppercase tracking-wider">
          <tr>
            <th className="text-left py-2 px-2">Deal</th>
            <th className="text-left py-2 px-2">Origine → Dest</th>
            <th className="text-right py-2 px-2">Total coût</th>
            <th className="text-right py-2 px-2">Vente</th>
            <th className="text-right py-2 px-2">Marge</th>
            <th className="text-right py-2 px-2">Taux</th>
            <th className="text-center py-2 px-2">Statut</th>
            <th className="text-right py-2 px-2"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border-subtle">
          {items.map((d) => (
            <tr key={d.id} className="hover:bg-surface-2/40">
              <td className="py-2 px-2">
                <div className="text-text-primary">{d.title}</div>
                {d.ref && <div className="text-text-muted font-mono text-[10px]">{d.ref}</div>}
              </td>
              <td className="py-2 px-2 text-text-secondary text-[10px]">
                {(d.originCountry || "—") + " → " + (d.destinationCountry || "—")}
                {d.containerType && <div className="text-text-muted">{d.containerType}</div>}
              </td>
              <td className="py-2 px-2 text-right font-mono text-text-primary">{fmtMoney(d.margin.totalCost, d.currency)}</td>
              <td className="py-2 px-2 text-right font-mono text-text-secondary">{fmtMoney(d.saleAmount, d.currency)}</td>
              <td className={`py-2 px-2 text-right font-mono ${d.margin.grossMargin === null ? "text-text-muted" : d.margin.grossMargin >= 0 ? "text-emerald-300" : "text-status-danger"}`}>
                {d.margin.grossMargin !== null ? fmtMoney(d.margin.grossMargin, d.currency) : "—"}
              </td>
              <td className="py-2 px-2 text-right font-mono text-text-muted">
                {d.margin.marginRate !== null ? `${(d.margin.marginRate * 100).toFixed(1)}%` : "—"}
              </td>
              <td className="py-2 px-2 text-center">
                <StatusChip value={d.status} />
              </td>
              <td className="py-2 px-2 text-right">
                <div className="inline-flex items-center gap-1">
                  <a
                    href={`/api/vlm/pdf/packing-list/${d.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Ouvrir la packing list PDF dans un nouvel onglet"
                    className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-bold uppercase tracking-tight border border-amber-400/30 bg-amber-400/10 text-amber-300 hover:bg-amber-400/20"
                  >
                    <FileDown className="w-3 h-3" />
                    Packing list
                  </a>
                  <button
                    type="button"
                    onClick={() => createQuoteFromDeal(d.id)}
                    disabled={creatingQuoteForId !== null}
                    title="Générer un devis VL Medical pré-rempli depuis ce deal"
                    className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-bold uppercase tracking-tight border border-accent-primary/30 bg-accent-primary/10 text-accent-glow hover:bg-accent-primary/20 disabled:opacity-40 disabled:cursor-wait"
                  >
                    {creatingQuoteForId === d.id ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <FileText className="w-3 h-3" />
                    )}
                    {creatingQuoteForId === d.id ? "Création…" : "Créer devis"}
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

// ---------- Stock tab ----------

interface StockItemView {
  id: string;
  label: string;
  sku: string | null;
  warehouse: string | null;
  location: string | null;
  quantity: number;
  minQuantity: number;
  unit: string | null;
  status: string;
  lotNumber: string | null;
  expiryDate: string | null;
  medicalCategory: string | null;
  ceMarking: string | null;
  supplierName: string | null;
  originCountry: string | null;
}

function StockTab() {
  const [items, setItems] = useState<StockItemView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch("/api/vlm/stock")
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
        return j;
      })
      .then((j) => setItems(j.items || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <SectionLoader />;
  if (error) return <SectionError msg={error} />;
  if (items.length === 0) return <SectionEmpty msg="Aucun stock item." />;

  return (
    <section className="card-sharp p-6 overflow-x-auto">
      <table className="w-full text-xs">
        <thead className="border-b border-border-subtle text-text-muted text-[10px] uppercase tracking-wider">
          <tr>
            <th className="text-left py-2 px-2">Item</th>
            <th className="text-left py-2 px-2">Entrepôt</th>
            <th className="text-right py-2 px-2">Qté</th>
            <th className="text-left py-2 px-2">Lot / CE</th>
            <th className="text-left py-2 px-2">Catégorie</th>
            <th className="text-left py-2 px-2">Péremption</th>
            <th className="text-left py-2 px-2">Fournisseur</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border-subtle">
          {items.map((s) => {
            const low = s.quantity <= s.minQuantity && s.minQuantity > 0 && s.status === "active";
            return (
              <tr key={s.id} className="hover:bg-surface-2/40">
                <td className="py-2 px-2">
                  <div className="text-text-primary">{s.label}</div>
                  {s.sku && <div className="text-text-muted font-mono text-[10px]">{s.sku}</div>}
                </td>
                <td className="py-2 px-2 text-text-secondary">
                  {s.warehouse || "—"}
                  {s.location && <div className="text-[10px] text-text-muted">{s.location}</div>}
                </td>
                <td className={`py-2 px-2 text-right font-mono ${low ? "text-amber-300 font-bold" : "text-text-primary"}`}>
                  {low && <AlertTriangle className="inline w-3 h-3 mr-1 -mt-0.5" />}
                  {s.quantity} {s.unit || ""}
                </td>
                <td className="py-2 px-2">
                  <div className="font-mono text-[10px] text-text-secondary">{s.lotNumber || "—"}</div>
                  <div className="font-mono text-[10px] text-text-muted">{s.ceMarking || "—"}</div>
                </td>
                <td className="py-2 px-2 text-text-secondary">{s.medicalCategory || "—"}</td>
                <td className="py-2 px-2 font-mono text-text-secondary">{s.expiryDate || "—"}</td>
                <td className="py-2 px-2 text-text-muted">
                  {s.supplierName || "—"}
                  {s.originCountry && <div className="text-[10px]">({s.originCountry})</div>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

// ---------- Deliveries tab ----------

interface DeliveryView {
  id: string;
  ref: string | null;
  clientName: string | null;
  title: string;
  shipFrom: string | null;
  shipTo: string | null;
  carrier: string | null;
  status: string;
  expectedDate: string | null;
  transportCost: number | null;
  currency: string;
  trackingNumber: string | null;
}

function DeliveriesTab() {
  const [items, setItems] = useState<DeliveryView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch("/api/vlm/deliveries")
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
        return j;
      })
      .then((j) => setItems(j.items || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <SectionLoader />;
  if (error) return <SectionError msg={error} />;
  if (items.length === 0) return <SectionEmpty msg="Aucune livraison." />;

  return (
    <section className="card-sharp p-6 overflow-x-auto">
      <table className="w-full text-xs">
        <thead className="border-b border-border-subtle text-text-muted text-[10px] uppercase tracking-wider">
          <tr>
            <th className="text-left py-2 px-2">Réf / Titre</th>
            <th className="text-left py-2 px-2">Client</th>
            <th className="text-left py-2 px-2">Trajet</th>
            <th className="text-left py-2 px-2">Date prévue</th>
            <th className="text-right py-2 px-2">Coût transport</th>
            <th className="text-center py-2 px-2">Statut</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border-subtle">
          {items.map((d) => (
            <tr key={d.id} className="hover:bg-surface-2/40">
              <td className="py-2 px-2">
                <div className="text-text-primary">{d.title}</div>
                {d.ref && <div className="text-text-muted font-mono text-[10px]">{d.ref}</div>}
              </td>
              <td className="py-2 px-2 text-text-secondary">{d.clientName || "—"}</td>
              <td className="py-2 px-2 text-text-secondary text-[10px]">
                {(d.shipFrom || "—") + " → " + (d.shipTo || "—")}
                {d.carrier && <div className="text-text-muted">via {d.carrier}</div>}
                {d.trackingNumber && <div className="text-text-muted font-mono">{d.trackingNumber}</div>}
              </td>
              <td className="py-2 px-2 font-mono text-text-secondary">{d.expectedDate || "—"}</td>
              <td className="py-2 px-2 text-right font-mono">{fmtMoney(d.transportCost, d.currency)}</td>
              <td className="py-2 px-2 text-center">
                <StatusChip value={d.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

// ---------- Regulatory tab ----------

interface RegulatoryView {
  id: string;
  ansmFileNumber: string | null;
  ceCertificateNumber: string | null;
  deviceClass: string | null;
  regulatoryStatus: string;
  complianceNotes: string | null;
  documentUrl: string | null;
  catalogName: string | null;
  stockLabel: string | null;
}

function RegulatoryTab() {
  const [items, setItems] = useState<RegulatoryView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch("/api/vlm/regulatory")
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
        return j;
      })
      .then((j) => setItems(j.items || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <SectionLoader />;
  if (error) return <SectionError msg={error} />;
  if (items.length === 0) return <SectionEmpty msg="Aucun dossier réglementaire." />;

  return (
    <section className="card-sharp p-6 overflow-x-auto">
      <table className="w-full text-xs">
        <thead className="border-b border-border-subtle text-text-muted text-[10px] uppercase tracking-wider">
          <tr>
            <th className="text-left py-2 px-2">N° ANSM</th>
            <th className="text-left py-2 px-2">N° CE</th>
            <th className="text-left py-2 px-2">Classe DM</th>
            <th className="text-left py-2 px-2">Lien</th>
            <th className="text-center py-2 px-2">Statut</th>
            <th className="text-left py-2 px-2">Notes</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border-subtle">
          {items.map((r) => (
            <tr key={r.id} className="hover:bg-surface-2/40">
              <td className="py-2 px-2 font-mono text-text-secondary">{r.ansmFileNumber || "—"}</td>
              <td className="py-2 px-2 font-mono text-text-secondary">{r.ceCertificateNumber || "—"}</td>
              <td className="py-2 px-2 text-text-primary">{r.deviceClass || "—"}</td>
              <td className="py-2 px-2 text-text-muted text-[10px]">
                {r.catalogName || r.stockLabel || "—"}
              </td>
              <td className="py-2 px-2 text-center">
                <RegulatoryChip value={r.regulatoryStatus} />
              </td>
              <td className="py-2 px-2 text-text-muted text-[10px] max-w-xs truncate">
                {r.complianceNotes || "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

// ---------- shared ----------

function Kpi({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string | null;
  tone?: "neutral" | "good" | "warn";
}) {
  const colorClass =
    tone === "good" ? "text-emerald-300"
    : tone === "warn" ? "text-amber-300"
    : "text-text-primary";
  return (
    <div className="card-sharp-high p-4">
      <p className="text-[10px] uppercase tracking-wider text-text-muted">{label}</p>
      <p className={`text-xl font-headline font-extrabold mt-2 font-mono ${colorClass}`}>{value}</p>
      {sub && <p className="text-[10px] text-text-muted mt-1">{sub}</p>}
    </div>
  );
}

function Detail({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "neutral" | "good" | "warn" }) {
  const colorClass =
    tone === "good" ? "text-emerald-300"
    : tone === "warn" ? "text-amber-300"
    : "text-text-primary";
  return (
    <div className="p-3 border border-border-subtle bg-surface-2/50">
      <p className="text-[10px] uppercase tracking-wider text-text-muted">{label}</p>
      <p className={`text-sm font-bold font-mono mt-1 ${colorClass}`}>{value}</p>
      {sub && <p className="text-[10px] text-text-muted mt-1">{sub}</p>}
    </div>
  );
}

function StatusChip({ value }: { value: string }) {
  const cls =
    value === "delivered" || value === "billed" ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
    : value === "in_transit" ? "bg-blue-500/15 text-blue-300 border-blue-500/30"
    : value === "ordered" || value === "preparing" ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
    : value === "cancelled" ? "bg-text-muted/15 text-text-muted border-border-subtle"
    : "bg-surface-3/50 text-text-secondary border-border-subtle";
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 text-[9px] font-bold uppercase border ${cls}`}>
      {value}
    </span>
  );
}

function RegulatoryChip({ value }: { value: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    compliant: { label: "conforme", cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
    pending: { label: "en cours", cls: "bg-blue-500/15 text-blue-300 border-blue-500/30" },
    expired: { label: "expiré", cls: "bg-status-danger/15 text-status-danger border-status-danger/30" },
    to_configure: { label: "à configurer", cls: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
    not_applicable: { label: "n/a", cls: "bg-text-muted/15 text-text-muted border-border-subtle" },
  };
  const m = map[value] || { label: value, cls: "bg-surface-3 text-text-secondary border-border-subtle" };
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 text-[9px] font-bold uppercase border ${m.cls}`}>
      {m.label}
    </span>
  );
}

function SectionLoader() {
  return (
    <div className="card-sharp p-12 flex items-center justify-center">
      <Loader2 className="w-5 h-5 animate-spin text-text-muted" />
    </div>
  );
}
function SectionError({ msg }: { msg: string }) {
  return (
    <div className="card-sharp p-6">
      <div className="flex items-start gap-2 text-status-danger text-sm">
        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
        <span>{msg}</span>
      </div>
    </div>
  );
}
function SectionEmpty({ msg }: { msg: string }) {
  return (
    <div className="card-sharp p-12">
      <p className="text-xs text-text-muted italic text-center">{msg}</p>
    </div>
  );
}
