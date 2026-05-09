"use client";

// V1.1.F — Fiche détail Devis (cockpit app.mybotia.com).
//
// Doctrine "app.mybotia = parité CRM" : la fiche devis DOIT exister côté app,
// utilisable, sans hard refresh. Source = /api/quotes/[id] (proxy → biz).
//
// Sections :
//   - Header : numéro, statut, actions (modifier, status quick-actions, PDF,
//     supprimer, conversion facture si accepted).
//   - Bloc client (avec lien vers fiche client).
//   - Bloc lignes (table) + totaux HT/TVA/TTC.
//   - Bloc notes (si présentes).
//
// 0 mock. URL `?edit=1` ouvre EditQuoteModal au mount (utilisé depuis la liste
// pour le bouton "stylo" inline).

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Download,
  FileSignature,
  Loader2,
  Pencil,
  Receipt,
  Trash2,
  AlertTriangle,
} from "lucide-react";

import {
  useQuote,
  useScopedClients,
  deleteQuoteApi,
  convertQuoteToInvoiceApi,
} from "@/hooks/use-api";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { EditQuoteModal } from "@/components/quotes/EditQuoteModal";
import { QuoteStatusActions } from "@/components/quotes/QuoteStatusActions";
import { toast } from "@/components/shared/Toast";
import { cn } from "@/lib/utils";
import { formatDateFR, formatDateLongFR, formatMoneyFR } from "@/lib/format";

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
  draft: "Devis en cours de rédaction.",
  sent: "Devis transmis au client.",
  accepted: "Devis accepté. Convertible en facture.",
  refused: "Devis refusé.",
  cancelled: "Devis annulé.",
};

export default function QuoteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();

  const { data: quote, loading, error, refetch } = useQuote(id);
  const { data: clients } = useScopedClients();

  const [editOpen, setEditOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [converting, setConverting] = useState(false);

  // Auto-open edit modal si ?edit=1 (depuis le bouton inline de la liste).
  useEffect(() => {
    if (!quote) return;
    if (searchParams.get("edit") === "1") {
      setEditOpen(true);
    }
  }, [quote, searchParams]);

  const client = useMemo(
    () => clients.find((c) => c.id === quote?.clientId) ?? null,
    [clients, quote],
  );

  async function handleDelete() {
    if (!quote) return;
    if (
      !window.confirm(
        `Supprimer le devis ${quote.number} ? Cette action est définitive (suppression douce côté serveur).`,
      )
    ) {
      return;
    }
    setDeleting(true);
    try {
      await deleteQuoteApi(quote.id);
      toast.success(`Devis ${quote.number} supprimé`);
      router.push("/quotes");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur réseau");
    } finally {
      setDeleting(false);
    }
  }

  async function handleConvert() {
    if (!quote) return;
    if (
      !window.confirm(
        `Convertir le devis ${quote.number} en facture ? Une facture brouillon sera créée avec les mêmes lignes et un nouveau numéro FAC-AAMM-NNNN.`,
      )
    ) {
      return;
    }
    setConverting(true);
    try {
      const inv = await convertQuoteToInvoiceApi(quote.id);
      toast.success(`Facture ${inv.number ?? ""} créée`);
      // /invoices dédiée non livrée → redirection vers ancrage finance.
      router.push("/finance#factures");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur réseau");
    } finally {
      setConverting(false);
    }
  }

  return (
    <div className="p-4 sm:p-8 min-h-screen space-y-6">
      <Link
        href="/quotes"
        className="inline-flex items-center gap-1.5 text-xs text-text-muted hover:text-text-primary transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Retour aux devis
      </Link>

      {loading && (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-accent-glow" />
        </div>
      )}

      {!loading && error && (
        <div className="card-sharp p-6 flex items-start gap-3 border-amber-400/30 bg-amber-400/5 text-amber-200">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="space-y-2">
            <p className="font-bold text-sm">Impossible de charger le devis</p>
            <p className="text-xs text-amber-200/80">
              {error}. Si vous étiez authentifié, votre session a peut-être
              expiré.
            </p>
          </div>
        </div>
      )}

      {!loading && !error && quote && (
        <>
          <ModuleHeader
            icon={FileSignature}
            title={quote.number}
            subtitle={
              quote.subject ??
              (client ? client.company || client.name : undefined)
            }
            actions={
              <>
                <button
                  onClick={() => setEditOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 border border-border-subtle text-[11px] font-bold uppercase tracking-tight text-text-muted hover:text-text-primary hover:border-border"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Modifier</span>
                </button>
                <a
                  href={`/api/quotes/${quote.id}/pdf`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-2 border border-border-subtle text-[11px] font-bold uppercase tracking-tight text-text-muted hover:text-text-primary hover:border-border"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">PDF</span>
                </a>
                {quote.status === "accepted" && (
                  <button
                    onClick={handleConvert}
                    disabled={converting}
                    className="inline-flex items-center gap-1.5 px-3 py-2 border border-emerald-500/40 bg-emerald-500/10 text-emerald-200 text-[11px] font-bold uppercase tracking-tight hover:bg-emerald-500/20 disabled:opacity-40"
                    title="Convertir ce devis en facture"
                  >
                    {converting ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Receipt className="w-3.5 h-3.5" />
                    )}
                    <span className="hidden sm:inline">
                      Créer facture depuis ce devis
                    </span>
                  </button>
                )}
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="inline-flex items-center gap-1.5 px-3 py-2 border border-rose-500/40 bg-rose-500/10 text-rose-200 text-[11px] font-bold uppercase tracking-tight hover:bg-rose-500/20 disabled:opacity-40"
                >
                  {deleting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="w-3.5 h-3.5" />
                  )}
                  <span className="hidden sm:inline">Supprimer</span>
                </button>
              </>
            }
          />

          {/* Statut + status quick-actions */}
          <div className="flex items-center gap-3 flex-wrap">
            <span
              title={STATUS_TOOLTIP[quote.status] ?? quote.status}
              className={cn(
                "px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border",
                STATUS_COLOR[quote.status] ?? STATUS_COLOR.draft,
              )}
            >
              {STATUS_LABEL[quote.status] ?? quote.status}
            </span>
            <QuoteStatusActions quote={quote} onChanged={() => refetch()} />
          </div>

          {/* Bloc client + métadonnées */}
          <section className="card-sharp p-5">
            <h2 className="text-xs font-bold uppercase tracking-wider text-text-muted mb-4">
              Informations
            </h2>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-y-3 gap-x-6 text-sm">
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-text-muted">
                  Client
                </dt>
                <dd className="text-text-primary mt-0.5">
                  {client ? (
                    <Link
                      href={`/crm/clients/${client.id}`}
                      className="hover:underline"
                    >
                      {client.company || client.name}
                    </Link>
                  ) : (
                    <span className="text-text-muted">—</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-text-muted">
                  Date émission
                </dt>
                <dd className="text-text-primary mt-0.5">
                  {formatDateLongFR(quote.createdAt)}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-text-muted">
                  Validité
                </dt>
                <dd className="text-text-primary mt-0.5">
                  {quote.validUntil
                    ? formatDateLongFR(quote.validUntil)
                    : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-text-muted">
                  Dernière mise à jour
                </dt>
                <dd className="text-text-primary mt-0.5">
                  {formatDateFR(quote.updatedAt, { withTime: true })}
                </dd>
              </div>
              {quote.projectId && (
                <div>
                  <dt className="text-[11px] uppercase tracking-wide text-text-muted">
                    Affaire associée
                  </dt>
                  <dd className="text-text-primary mt-0.5">
                    <Link
                      href={`/affaires/${quote.projectId}`}
                      className="hover:underline"
                    >
                      Voir l&apos;affaire
                    </Link>
                  </dd>
                </div>
              )}
            </dl>
          </section>

          {/* Lignes + totaux */}
          <section className="card-sharp p-0 overflow-hidden">
            <div className="px-5 pt-5 flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-text-primary">
                Lignes
              </h2>
              <span className="text-[10px] text-text-muted font-mono tabular-nums">
                {quote.items.length} ligne
                {quote.items.length > 1 ? "s" : ""}
              </span>
            </div>

            {/* Desktop : table */}
            <div className="hidden md:block overflow-x-auto mt-3">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wider text-text-muted border-b border-border-subtle">
                    <th className="text-left font-bold py-2 px-5">Libellé</th>
                    <th className="text-right font-bold py-2 px-3">Qté</th>
                    <th className="text-right font-bold py-2 px-3">P.U. HT</th>
                    <th className="text-right font-bold py-2 px-3">TVA %</th>
                    <th className="text-right font-bold py-2 px-3">HT</th>
                    <th className="text-right font-bold py-2 px-5">TTC</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {quote.items.map((it, i) => (
                    <tr
                      key={it.id ?? i}
                      className="hover:bg-surface-2 transition-colors"
                    >
                      <td className="py-2 px-5">
                        <div className="text-text-primary">{it.label}</div>
                        {it.description && (
                          <div className="text-xs text-text-muted mt-0.5">
                            {it.description}
                          </div>
                        )}
                      </td>
                      <td className="py-2 px-3 text-right tabular-nums text-text-primary">
                        {it.qty}
                      </td>
                      <td className="py-2 px-3 text-right tabular-nums text-text-primary">
                        {formatMoneyFR(it.unitPriceHt)}
                      </td>
                      <td className="py-2 px-3 text-right tabular-nums text-text-muted">
                        {String(it.vatRate)}
                      </td>
                      <td className="py-2 px-3 text-right tabular-nums text-text-primary">
                        {formatMoneyFR(it.lineHt ?? 0)}
                      </td>
                      <td className="py-2 px-5 text-right tabular-nums text-text-primary">
                        {formatMoneyFR(it.lineTtc ?? 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile : cards */}
            <ul className="md:hidden divide-y divide-border-subtle mt-3">
              {quote.items.map((it, i) => (
                <li key={it.id ?? i} className="px-5 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-text-primary">{it.label}</div>
                      {it.description && (
                        <div className="text-xs text-text-muted mt-0.5">
                          {it.description}
                        </div>
                      )}
                    </div>
                    <div className="text-right tabular-nums text-text-primary shrink-0">
                      {formatMoneyFR(it.lineTtc ?? 0)}
                    </div>
                  </div>
                  <div className="text-xs text-text-muted mt-1 tabular-nums">
                    {it.qty} × {formatMoneyFR(it.unitPriceHt)} · TVA{" "}
                    {String(it.vatRate)}%
                  </div>
                </li>
              ))}
            </ul>

            <div className="border-t border-border-subtle bg-surface-2 px-5 py-4 grid grid-cols-3 gap-4">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-text-muted">
                  Sous-total HT
                </div>
                <div className="tabular-nums font-bold text-text-primary">
                  {formatMoneyFR(quote.subtotalHt)}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-text-muted">
                  TVA
                </div>
                <div className="tabular-nums text-text-primary">
                  {formatMoneyFR(quote.vatTotal)}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-text-muted">
                  Total TTC
                </div>
                <div className="tabular-nums font-bold text-accent-glow">
                  {formatMoneyFR(quote.totalTtc)}
                </div>
              </div>
            </div>
          </section>

          {/* Notes */}
          {quote.notes && (
            <section className="card-sharp p-5">
              <h2 className="text-xs font-bold uppercase tracking-wider text-text-muted mb-2">
                Notes
              </h2>
              <p className="text-sm text-text-primary whitespace-pre-wrap">
                {quote.notes}
              </p>
            </section>
          )}

          <EditQuoteModal
            open={editOpen}
            onClose={() => {
              setEditOpen(false);
              // Si on est arrivé via ?edit=1, on nettoie l'URL pour ne pas
              // ré-ouvrir au refresh.
              if (searchParams.get("edit") === "1") {
                router.replace(`/quotes/${quote.id}`);
              }
            }}
            quote={quote}
            onSaved={() => refetch()}
          />
        </>
      )}
    </div>
  );
}
