"use client";

// V1.1.F — Cockpit Devis (liste).
//
// Doctrine "app.mybotia = parité CRM" : les devis se gèrent depuis app, plus
// depuis crm.mybotia.com. Source : /api/quotes (proxy → mybotia-business).
//
// Fonctions :
//   - Liste filtrable (statut, client, date, recherche numéro/client/objet)
//   - CTA "Nouveau devis" → CreateQuoteModal
//   - Lignes cliquables → /quotes/[id]
//   - Actions inline : voir / éditer (modal) / PDF / supprimer (confirm)
//
// 0 mock. Empty state actionnable. Mobile responsive (table → cards <md).

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  FileSignature,
  Loader2,
  Plus,
  Search,
  Trash2,
  Pencil,
  Eye,
  Download,
} from "lucide-react";

import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { FeatureDisabled } from "@/components/shared/FeatureDisabled";
import { ErrorState } from "@/components/shared/ErrorState";
import { EmptyState } from "@/components/shared/EmptyState";
import { CreateQuoteModal } from "@/components/quotes/CreateQuoteModal";
import {
  useQuotes,
  useCockpitFeatures,
  useScopedClients,
  deleteQuoteApi,
  type QuoteRow,
} from "@/hooks/use-api";
import { toast } from "@/components/shared/Toast";
import { cn } from "@/lib/utils";
import { formatDateFR, formatMoneyFR } from "@/lib/format";

const STATUS_LABEL: Record<string, string> = {
  draft: "Brouillon",
  sent: "Envoyé",
  accepted: "Accepté",
  refused: "Refusé",
  cancelled: "Annulé",
};

const STATUS_COLOR: Record<string, string> = {
  draft: "bg-zinc-500/15 text-zinc-300 border-zinc-500/30",
  sent: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  accepted: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  refused: "bg-rose-500/15 text-rose-300 border-rose-500/30",
  cancelled: "bg-zinc-500/15 text-zinc-300 border-zinc-500/30",
};

const STATUS_TOOLTIP: Record<string, string> = {
  draft: "Devis en cours de rédaction. Pas encore envoyé au client.",
  sent: "Devis transmis au client. En attente de retour.",
  accepted: "Devis accepté par le client. Convertible en facture.",
  refused: "Devis refusé par le client.",
  cancelled: "Devis annulé.",
};

const STATUS_FILTER_VALUES = [
  "draft",
  "sent",
  "accepted",
  "refused",
  "cancelled",
] as const;

export default function QuotesPage() {
  const { data: cockpitFeatures, loading: featuresLoading } =
    useCockpitFeatures();
  const financeEnabled = cockpitFeatures?.features?.finance === true;

  const { data: quotes, loading, error, refetch } = useQuotes();
  const { data: clients } = useScopedClients();

  const [createOpen, setCreateOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [clientFilter, setClientFilter] = useState<string>("");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const clientById = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of clients) {
      map.set(c.id, c.company || c.name || "");
    }
    return map;
  }, [clients]);

  const sortedClients = useMemo(
    () =>
      [...clients].sort((a, b) =>
        (a.company || a.name || "").localeCompare(b.company || b.name || ""),
      ),
    [clients],
  );

  const filtered = useMemo<QuoteRow[]>(() => {
    const q = search.trim().toLowerCase();
    return quotes
      .filter((quote) => {
        if (statusFilter && quote.status !== statusFilter) return false;
        if (clientFilter && quote.clientId !== clientFilter) return false;
        if (dateFrom && (quote.createdAt ?? "").slice(0, 10) < dateFrom)
          return false;
        if (dateTo && (quote.createdAt ?? "").slice(0, 10) > dateTo)
          return false;
        if (q) {
          const cname = (clientById.get(quote.clientId) ?? "").toLowerCase();
          const num = (quote.number ?? "").toLowerCase();
          const subj = ((quote.subject ?? "") as string).toLowerCase();
          if (!num.includes(q) && !cname.includes(q) && !subj.includes(q))
            return false;
        }
        return true;
      })
      .sort((a, b) =>
        String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? "")),
      );
  }, [quotes, search, statusFilter, clientFilter, dateFrom, dateTo, clientById]);

  async function handleDelete(quote: QuoteRow) {
    if (
      !window.confirm(
        `Supprimer le devis ${quote.number} ? Cette action est définitive (suppression douce côté serveur).`,
      )
    ) {
      return;
    }
    setDeletingId(quote.id);
    try {
      await deleteQuoteApi(quote.id);
      toast.success(`Devis ${quote.number} supprimé`);
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur réseau");
    } finally {
      setDeletingId(null);
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

  const filtersActive =
    !!statusFilter || !!clientFilter || !!dateFrom || !!dateTo || !!search;

  return (
    <div className="p-4 sm:p-8 min-h-screen space-y-6">
      <ModuleHeader
        icon={FileSignature}
        title="Devis"
        subtitle={
          loading
            ? "Chargement…"
            : `${quotes.length} devis · ${filtered.length} affiché${filtered.length > 1 ? "s" : ""}`
        }
        actions={
          <button
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-accent-primary text-white text-[11px] font-bold uppercase tracking-wider hover:bg-accent-primary/80 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Nouveau devis</span>
          </button>
        }
      />

      {error && (
        <ErrorState
          title="Module Devis non disponible"
          message={`${error}. Si tu es superadmin, vérifie que le tenant a 'finance' activé et que le provider CRM est 'mybotia_business'.`}
          onRetry={refetch}
        />
      )}

      {!error && (
        <div className="card-sharp p-4 space-y-3">
          <div className="flex flex-col lg:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted pointer-events-none" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-surface-2 border border-border-subtle text-sm py-2 pl-8 pr-3 text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent-primary/40"
                placeholder="Rechercher par numéro, client ou objet…"
                aria-label="Rechercher"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-surface-2 border border-border-subtle text-sm py-2 px-3 text-text-primary"
                aria-label="Filtrer par statut"
              >
                <option value="">Tous statuts</option>
                {STATUS_FILTER_VALUES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABEL[s]}
                  </option>
                ))}
              </select>
              <select
                value={clientFilter}
                onChange={(e) => setClientFilter(e.target.value)}
                className="bg-surface-2 border border-border-subtle text-sm py-2 px-3 text-text-primary max-w-[200px] truncate"
                aria-label="Filtrer par client"
              >
                <option value="">Tous clients</option>
                {sortedClients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.company || c.name}
                  </option>
                ))}
              </select>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="bg-surface-2 border border-border-subtle text-sm py-2 px-3 text-text-primary"
                aria-label="Date début"
                title="Date de début"
              />
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="bg-surface-2 border border-border-subtle text-sm py-2 px-3 text-text-primary"
                aria-label="Date fin"
                title="Date de fin"
              />
              {filtersActive && (
                <button
                  type="button"
                  onClick={() => {
                    setStatusFilter("");
                    setClientFilter("");
                    setDateFrom("");
                    setDateTo("");
                    setSearch("");
                  }}
                  className="text-[10px] uppercase tracking-tight text-text-muted hover:text-text-primary px-2"
                >
                  Effacer
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {loading && (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-accent-glow" />
        </div>
      )}

      {!loading && !error && quotes.length === 0 && (
        <EmptyState
          icon={FileSignature}
          title="Aucun devis"
          description="Créez votre premier devis. Numérotation auto (DEV-AAMM-NNNN), calculs HT/TVA/TTC live, PDF généré à la demande."
          action={
            <button
              onClick={() => setCreateOpen(true)}
              className="inline-flex items-center gap-1.5 px-5 py-2 text-[11px] font-bold uppercase tracking-tight border border-accent-primary/30 bg-accent-primary/10 text-accent-glow hover:bg-accent-primary/20"
            >
              <Plus className="w-3.5 h-3.5" />
              Créer mon premier devis
            </button>
          }
        />
      )}

      {!loading && !error && quotes.length > 0 && filtered.length === 0 && (
        <div className="card-sharp p-8 text-center">
          <p className="text-sm text-text-muted">
            Aucun devis ne correspond à ces filtres.
          </p>
        </div>
      )}

      {!loading && !error && filtered.length > 0 && (
        <>
          {/* Desktop : table */}
          <div className="hidden md:block card-sharp p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-text-muted border-b border-border-subtle">
                  <th className="text-left font-bold py-3 px-4">Numéro</th>
                  <th className="text-left font-bold py-3 px-4">Client</th>
                  <th className="text-left font-bold py-3 px-4">Date</th>
                  <th className="text-right font-bold py-3 px-4">HT</th>
                  <th className="text-right font-bold py-3 px-4">TTC</th>
                  <th className="text-left font-bold py-3 px-4">Statut</th>
                  <th className="text-right font-bold py-3 px-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {filtered.map((q) => {
                  const cname = clientById.get(q.clientId) ?? "—";
                  return (
                    <tr
                      key={q.id}
                      className="hover:bg-surface-2 transition-colors"
                    >
                      <td className="py-3 px-4">
                        <Link
                          href={`/quotes/${q.id}`}
                          className="font-mono text-text-primary hover:text-accent-glow"
                        >
                          {q.number}
                        </Link>
                      </td>
                      <td className="py-3 px-4 text-text-primary truncate max-w-[220px]">
                        {cname}
                      </td>
                      <td className="py-3 px-4 text-text-muted tabular-nums">
                        {formatDateFR(q.createdAt)}
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums text-text-primary">
                        {formatMoneyFR(q.subtotalHt)}
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums text-text-primary">
                        {formatMoneyFR(q.totalTtc)}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          title={
                            STATUS_TOOLTIP[q.status] ??
                            STATUS_LABEL[q.status] ??
                            q.status
                          }
                          className={cn(
                            "inline-block px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-tight border",
                            STATUS_COLOR[q.status] ?? STATUS_COLOR.draft,
                          )}
                        >
                          {STATUS_LABEL[q.status] ?? q.status}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-end gap-1">
                          <Link
                            href={`/quotes/${q.id}`}
                            className="p-1.5 text-text-muted hover:text-text-primary"
                            title="Voir"
                            aria-label="Voir le devis"
                          >
                            <Eye className="w-4 h-4" />
                          </Link>
                          <Link
                            href={`/quotes/${q.id}?edit=1`}
                            className="p-1.5 text-text-muted hover:text-accent-glow"
                            title="Modifier"
                            aria-label="Modifier le devis"
                          >
                            <Pencil className="w-4 h-4" />
                          </Link>
                          <a
                            href={`/api/quotes/${q.id}/pdf`}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1.5 text-text-muted hover:text-text-primary"
                            title="Télécharger PDF"
                            aria-label="Télécharger PDF"
                          >
                            <Download className="w-4 h-4" />
                          </a>
                          <button
                            type="button"
                            onClick={() => handleDelete(q)}
                            disabled={deletingId === q.id}
                            className="p-1.5 text-text-muted hover:text-rose-300 disabled:opacity-30"
                            title="Supprimer"
                            aria-label="Supprimer le devis"
                          >
                            {deletingId === q.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile : cards */}
          <ul className="md:hidden space-y-2">
            {filtered.map((q) => {
              const cname = clientById.get(q.clientId) ?? "—";
              return (
                <li key={q.id}>
                  <Link
                    href={`/quotes/${q.id}`}
                    className="card-sharp block p-3 hover:bg-surface-2 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="font-mono text-text-primary">
                        {q.number}
                      </span>
                      <span
                        title={STATUS_TOOLTIP[q.status]}
                        className={cn(
                          "px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-tight border shrink-0",
                          STATUS_COLOR[q.status] ?? STATUS_COLOR.draft,
                        )}
                      >
                        {STATUS_LABEL[q.status] ?? q.status}
                      </span>
                    </div>
                    <div className="text-text-primary truncate">{cname}</div>
                    <div className="flex items-center justify-between mt-1 text-xs">
                      <span className="text-text-muted">
                        {formatDateFR(q.createdAt)}
                      </span>
                      <span className="tabular-nums text-text-primary font-medium">
                        {formatMoneyFR(q.totalTtc)}
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </>
      )}

      <CreateQuoteModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => refetch()}
      />
    </div>
  );
}
