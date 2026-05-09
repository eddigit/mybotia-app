"use client";

// V1.1.F — Liste des factures (cockpit app.mybotia).
//
// Source : /api/invoices (proxy → mybotia-business /api/v1/invoices).
// Doctrine "app.mybotia = parité CRM" : Gilles n'ouvre plus crm.mybotia.com
// pour le parcours principal facturation.
//
// Fonctions :
//   - Filtres : statut, client, recherche (numéro/objet), "à recouvrer".
//   - Actions ligne : voir, marquer payée, télécharger PDF, supprimer.
//   - Bouton header : nouvelle facture.

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Receipt,
  Plus,
  Loader2,
  RefreshCw,
  Search,
  Download,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { FeatureDisabled } from "@/components/shared/FeatureDisabled";
import { ErrorState } from "@/components/shared/ErrorState";
import {
  useCockpitFeatures,
  useInvoices,
  useScopedClients,
  deleteInvoiceApi,
  type InvoiceRow,
} from "@/hooks/use-api";
import { CreateInvoiceModal } from "@/components/invoices/CreateInvoiceModal";
import { InvoiceStatusActions } from "@/components/invoices/InvoiceStatusActions";
import { toast } from "@/components/shared/Toast";
import { formatDateFR, formatMoneyFR } from "@/lib/format";
import { cn } from "@/lib/utils";

const STATUS_TONE: Record<string, { label: string; className: string }> = {
  draft: {
    label: "Brouillon",
    className: "bg-text-muted/15 text-text-muted border-border-subtle",
  },
  sent: {
    label: "Envoyée",
    className: "bg-accent-primary/15 text-accent-glow border-accent-primary/40",
  },
  paid: {
    label: "Payée",
    className: "bg-emerald-400/15 text-emerald-300 border-emerald-400/40",
  },
  overdue: {
    label: "En retard",
    className: "bg-amber-400/15 text-amber-200 border-amber-400/40",
  },
  cancelled: {
    label: "Annulée",
    className: "bg-rose-400/15 text-rose-300 border-rose-400/40",
  },
};

function safeNumber(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = parseFloat(v);
    return Number.isNaN(n) ? 0 : n;
  }
  return 0;
}

function getDate(inv: InvoiceRow, key: "issuedAt" | "dueDate"): string | null {
  if (key === "issuedAt") return inv.issuedAt ?? inv.issued_at ?? null;
  return inv.dueDate ?? inv.due_date ?? null;
}

function getClientId(inv: InvoiceRow): string {
  return (inv.clientId ?? inv.client_id ?? "") as string;
}

function isOverdue(inv: InvoiceRow): boolean {
  if (inv.status === "paid" || inv.status === "cancelled") return false;
  const due = getDate(inv, "dueDate");
  if (!due) return false;
  const today = new Date().toISOString().slice(0, 10);
  return due < today;
}

export default function InvoicesPage() {
  const { data: cockpitFeatures, loading: featuresLoading } = useCockpitFeatures();
  const financeEnabled = cockpitFeatures?.features?.finance === true;
  const isBusiness = cockpitFeatures?.crmProvider === "mybotia_business";

  const [filterStatus, setFilterStatus] = useState<string>("");
  const [filterClient, setFilterClient] = useState<string>("");
  const [search, setSearch] = useState("");
  const [recoverOnly, setRecoverOnly] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  const {
    data: invoices,
    loading,
    error,
    refetch,
  } = useInvoices({
    clientId: filterClient || undefined,
    status: filterStatus || undefined,
  });
  const { data: clients } = useScopedClients();

  const clientById = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of clients) {
      m.set(String(c.id), c.company || c.name || "—");
    }
    return m;
  }, [clients]);

  const filtered = useMemo(() => {
    let rows = [...invoices];
    if (recoverOnly) {
      rows = rows.filter((inv) => isOverdue(inv));
    }
    const q = search.trim().toLowerCase();
    if (q) {
      rows = rows.filter((inv) => {
        const num = String(inv.number || "").toLowerCase();
        const subj = String(inv.subject ?? "").toLowerCase();
        const cname = clientById.get(getClientId(inv))?.toLowerCase() ?? "";
        return num.includes(q) || subj.includes(q) || cname.includes(q);
      });
    }
    rows.sort((a, b) => {
      const da = getDate(a, "issuedAt") ?? a.createdAt ?? a.created_at ?? "";
      const db = getDate(b, "issuedAt") ?? b.createdAt ?? b.created_at ?? "";
      return db.localeCompare(da);
    });
    return rows;
  }, [invoices, recoverOnly, search, clientById]);

  const counts = useMemo(() => {
    const out = { all: invoices.length, overdue: 0, draft: 0, paid: 0 };
    for (const inv of invoices) {
      if (isOverdue(inv)) out.overdue++;
      if (inv.status === "draft") out.draft++;
      if (inv.status === "paid") out.paid++;
    }
    return out;
  }, [invoices]);

  async function handleDelete(inv: InvoiceRow) {
    if (
      !confirm(
        `Supprimer la facture ${inv.number} ? Action irréversible.`,
      )
    )
      return;
    try {
      await deleteInvoiceApi(inv.id);
      toast.success("Facture supprimée.");
      refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur suppression");
    }
  }

  if (!featuresLoading && cockpitFeatures && !financeEnabled) {
    return (
      <FeatureDisabled
        featureKey="finance"
        tenantSlug={cockpitFeatures.tenant}
      />
    );
  }

  if (!featuresLoading && cockpitFeatures && !isBusiness) {
    return (
      <div className="p-8 min-h-screen space-y-6">
        <ModuleHeader
          icon={Receipt}
          title="Factures"
          subtitle={`Cockpit ${cockpitFeatures.displayName || cockpitFeatures.tenant}`}
        />
        <div className="card-sharp p-6 space-y-3">
          <div className="flex items-center gap-2 text-amber-300">
            <AlertTriangle className="w-4 h-4" />
            <span className="text-sm font-bold">
              CRM legacy détecté ({cockpitFeatures.crmProvider}).
            </span>
          </div>
          <p className="text-[12px] text-text-muted">
            Cette page est branchée sur mybotia-business. Pour les tenants
            Dolibarr, la facturation reste sur l&apos;UI legacy. Voir{" "}
            <Link href="/finance" className="text-accent-glow hover:underline">
              /finance
            </Link>{" "}
            pour la vue agrégée.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 min-h-screen space-y-6">
      <ModuleHeader
        icon={Receipt}
        title="Factures"
        subtitle={
          cockpitFeatures
            ? `Cockpit ${cockpitFeatures.displayName || cockpitFeatures.tenant} · ${counts.all} facture${counts.all > 1 ? "s" : ""}`
            : "Chargement…"
        }
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={refetch}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-tight border border-border-subtle text-text-muted hover:text-text-primary"
            >
              <RefreshCw className="w-3 h-3" />
              Actualiser
            </button>
            <button
              onClick={() => setShowCreate(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-tight bg-accent-primary text-white hover:bg-accent-primary/80"
            >
              <Plus className="w-3 h-3" />
              Nouvelle facture
            </button>
          </div>
        }
      />

      {/* KPI strip */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiPill label="Total" value={counts.all} />
        <KpiPill label="Brouillons" value={counts.draft} tone="muted" />
        <KpiPill label="À recouvrer" value={counts.overdue} tone="warn" />
        <KpiPill label="Payées" value={counts.paid} tone="success" />
      </section>

      <section className="card-sharp p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
          <div className="md:col-span-5 relative">
            <Search className="w-3 h-3 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher (numéro, objet, client)…"
              className="w-full bg-surface-2 border border-border-subtle text-sm py-2 pl-8 pr-3 text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent-primary/40"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="md:col-span-3 w-full bg-surface-2 border border-border-subtle text-sm py-2 px-3 text-text-primary focus:outline-none focus:ring-1 focus:ring-accent-primary/40"
          >
            <option value="">Tous les statuts</option>
            <option value="draft">Brouillon</option>
            <option value="sent">Envoyée</option>
            <option value="paid">Payée</option>
            <option value="overdue">En retard</option>
            <option value="cancelled">Annulée</option>
          </select>
          <select
            value={filterClient}
            onChange={(e) => setFilterClient(e.target.value)}
            className="md:col-span-3 w-full bg-surface-2 border border-border-subtle text-sm py-2 px-3 text-text-primary focus:outline-none focus:ring-1 focus:ring-accent-primary/40"
          >
            <option value="">Tous les clients</option>
            {[...clients]
              .sort((a, b) =>
                (a.company || a.name || "").localeCompare(
                  b.company || b.name || "",
                ),
              )
              .map((c) => (
                <option key={c.id} value={String(c.id)}>
                  {c.company || c.name}
                </option>
              ))}
          </select>
          <label className="md:col-span-1 flex items-center gap-1.5 text-[11px] text-text-muted">
            <input
              type="checkbox"
              checked={recoverOnly}
              onChange={(e) => setRecoverOnly(e.target.checked)}
              className="accent-amber-400"
            />
            Retard
          </label>
        </div>
      </section>

      {error && (
        <ErrorState
          title="Factures indisponibles"
          message={error}
          onRetry={refetch}
        />
      )}

      {loading && (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-accent-glow" />
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className="card-sharp p-8 text-center space-y-3">
          <p className="text-sm font-bold text-text-primary">
            {invoices.length === 0
              ? "Aucune facture pour le moment."
              : "Aucune facture ne correspond aux filtres."}
          </p>
          <p className="text-[12px] text-text-muted">
            {invoices.length === 0
              ? "Crée la première facture, ou convertis un devis accepté depuis la fiche affaire."
              : "Réinitialise les filtres pour voir toutes les factures."}
          </p>
          {invoices.length === 0 ? (
            <button
              onClick={() => setShowCreate(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-tight bg-accent-primary text-white hover:bg-accent-primary/80"
            >
              <Plus className="w-3 h-3" />
              Créer une facture
            </button>
          ) : (
            <button
              onClick={() => {
                setSearch("");
                setFilterStatus("");
                setFilterClient("");
                setRecoverOnly(false);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-tight border border-border-subtle text-text-muted hover:text-text-primary"
            >
              Réinitialiser les filtres
            </button>
          )}
        </div>
      )}

      {!loading && !error && filtered.length > 0 && (
        <>
          {/* Desktop table */}
          <section className="card-sharp p-0 hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-[10px] uppercase tracking-tight text-text-muted bg-surface-2/40">
                <tr>
                  <th className="text-left py-2.5 px-4 font-bold">Numéro</th>
                  <th className="text-left py-2.5 px-3 font-bold">Client</th>
                  <th className="text-left py-2.5 px-3 font-bold">Émise</th>
                  <th className="text-left py-2.5 px-3 font-bold">Échéance</th>
                  <th className="text-right py-2.5 px-3 font-bold">Total TTC</th>
                  <th className="text-left py-2.5 px-3 font-bold">Statut</th>
                  <th className="text-right py-2.5 px-4 font-bold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {filtered.map((inv) => {
                  const tone =
                    STATUS_TONE[inv.status] ?? STATUS_TONE.draft;
                  const overdue = isOverdue(inv);
                  const total = safeNumber(inv.totalTtc ?? inv.total_ttc);
                  const cname =
                    clientById.get(getClientId(inv)) ?? "—";
                  return (
                    <tr
                      key={inv.id}
                      className="hover:bg-surface-2/30 transition-colors"
                    >
                      <td className="py-2.5 px-4">
                        <Link
                          href={`/invoices/${encodeURIComponent(inv.id)}`}
                          className="font-mono text-[12px] text-accent-glow hover:underline"
                        >
                          {inv.number}
                        </Link>
                      </td>
                      <td className="py-2.5 px-3 text-text-secondary">
                        {cname}
                      </td>
                      <td className="py-2.5 px-3 text-text-secondary tabular-nums">
                        {formatDateFR(getDate(inv, "issuedAt"))}
                      </td>
                      <td className="py-2.5 px-3 text-text-secondary tabular-nums">
                        {formatDateFR(getDate(inv, "dueDate"))}
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums font-bold text-text-primary">
                        {formatMoneyFR(total)}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className={cn(
                              "inline-flex items-center px-2 py-0.5 text-[10px] font-bold uppercase tracking-tight border",
                              tone.className,
                            )}
                          >
                            {tone.label}
                          </span>
                          {overdue && inv.status !== "overdue" && (
                            <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-bold uppercase tracking-tight border bg-amber-400/15 text-amber-200 border-amber-400/40">
                              Retard
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <div className="inline-flex items-center gap-1">
                          <InvoiceStatusActions
                            invoiceId={inv.id}
                            status={inv.status}
                            onChanged={refetch}
                            size="sm"
                          />
                          <a
                            href={`/api/invoices/${encodeURIComponent(inv.id)}/pdf`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-bold uppercase tracking-tight border border-border-subtle text-text-muted hover:text-text-primary hover:border-accent-primary/40"
                            title="Télécharger PDF"
                          >
                            <Download className="w-3 h-3" />
                            PDF
                          </a>
                          <button
                            type="button"
                            onClick={() => handleDelete(inv)}
                            className="inline-flex items-center px-2 py-1 text-[10px] font-bold uppercase tracking-tight border border-border-subtle text-text-muted hover:text-rose-300 hover:border-rose-400/40"
                            title="Supprimer la facture"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>

          {/* Mobile cards */}
          <section className="md:hidden space-y-3">
            {filtered.map((inv) => {
              const tone = STATUS_TONE[inv.status] ?? STATUS_TONE.draft;
              const overdue = isOverdue(inv);
              const total = safeNumber(inv.totalTtc ?? inv.total_ttc);
              const cname = clientById.get(getClientId(inv)) ?? "—";
              return (
                <div
                  key={inv.id}
                  className="card-sharp p-4 space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link
                        href={`/invoices/${encodeURIComponent(inv.id)}`}
                        className="font-mono text-[12px] text-accent-glow hover:underline"
                      >
                        {inv.number}
                      </Link>
                      <p className="text-[12px] text-text-secondary truncate">
                        {cname}
                      </p>
                    </div>
                    <span className="text-sm font-bold tabular-nums text-text-primary shrink-0">
                      {formatMoneyFR(total)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span
                      className={cn(
                        "inline-flex items-center px-2 py-0.5 text-[10px] font-bold uppercase tracking-tight border",
                        tone.className,
                      )}
                    >
                      {tone.label}
                    </span>
                    {overdue && inv.status !== "overdue" && (
                      <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-bold uppercase tracking-tight border bg-amber-400/15 text-amber-200 border-amber-400/40">
                        Retard
                      </span>
                    )}
                    <span className="text-[11px] text-text-muted tabular-nums ml-auto">
                      Émise {formatDateFR(getDate(inv, "issuedAt"))}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap pt-1">
                    <InvoiceStatusActions
                      invoiceId={inv.id}
                      status={inv.status}
                      onChanged={refetch}
                      size="sm"
                    />
                    <a
                      href={`/api/invoices/${encodeURIComponent(inv.id)}/pdf`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-bold uppercase tracking-tight border border-border-subtle text-text-muted"
                    >
                      <Download className="w-3 h-3" />
                      PDF
                    </a>
                    <button
                      type="button"
                      onClick={() => handleDelete(inv)}
                      className="inline-flex items-center px-2 py-1 text-[10px] font-bold uppercase tracking-tight border border-border-subtle text-text-muted hover:text-rose-300"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </section>
        </>
      )}

      <CreateInvoiceModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={() => {
          setShowCreate(false);
          refetch();
        }}
      />
    </div>
  );
}

function KpiPill({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "warn" | "success" | "muted";
}) {
  const accent =
    tone === "warn"
      ? "text-amber-300"
      : tone === "success"
        ? "text-emerald-300"
        : tone === "muted"
          ? "text-text-muted"
          : "text-accent-glow";
  return (
    <div className="card-sharp px-4 py-3 flex items-center justify-between">
      <span className="micro-label text-text-muted">{label}</span>
      <span className={cn("text-lg font-headline font-extrabold tabular-nums", accent)}>
        {value}
      </span>
    </div>
  );
}
