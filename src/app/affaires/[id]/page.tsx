"use client";

// V1.1.D Phase 2 — Fiche détail Affaire (cockpit app.mybotia.com).
//
// Doctrine "app.mybotia = parité CRM" : la fiche affaire DOIT exister côté
// app, utilisable, sans hard refresh. Source = /api/affaires/[id] (proxy
// → mybotia-business).
//
// BUG-AG-10 (2026-05-09) : devis liés = /api/quotes?project_id=<affaireId>,
// strictement filtré côté business (zéro fallback silencieux client_id).
// Si aucun devis lié → empty state actionnable, pas tous les devis du client.
//
// Activité récente : pas d'endpoint audit côté business V1.1.D — empty state.

import { use, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  Briefcase,
  CheckCircle2,
  Loader2,
  Pencil,
  Plus,
  Receipt,
  Trash2,
  History,
} from "lucide-react";

import {
  useAffaire,
  useScopedClients,
  useQuotesByProject,
  convertQuoteToInvoiceApi,
  type AffaireRow,
  type QuoteRow,
} from "@/hooks/use-api";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { EditAffaireModal } from "@/components/affaires/EditAffaireModal";
import { SignAffaireModal } from "@/components/affaires/SignAffaireModal";
import { toast } from "@/components/shared/Toast";
import { cn } from "@/lib/utils";
import { formatDateFR, formatDateLongFR, formatMoneyCompactFR } from "@/lib/format";

// Aliases historiques, conservés pour limiter le bruit dans le rendu.
const fmtDateShort = formatDateFR;
const fmtDateLong = formatDateLongFR;
const fmtMoney = (v: number | string | null | undefined) => formatMoneyCompactFR(v);

const STAGE_LABEL: Record<string, string> = {
  lead: "Prospect",
  qualified: "Qualifié",
  won: "Gagné",
  lost: "Perdu",
  active: "En cours",
  paused: "En attente",
  done: "Livré",
  cancelled: "Annulé",
  abandoned: "Abandonné",
};

const STAGE_COLOR: Record<string, string> = {
  lead: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  qualified: "bg-violet-500/15 text-violet-300 border-violet-500/30",
  won: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  lost: "bg-rose-500/15 text-rose-300 border-rose-500/30",
  active: "bg-accent-primary/15 text-accent-glow border-accent-primary/30",
  paused: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  done: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  cancelled: "bg-rose-500/15 text-rose-300 border-rose-500/30",
  abandoned: "bg-zinc-500/15 text-zinc-300 border-zinc-500/30",
};

const QUOTE_STATUS_LABEL: Record<string, string> = {
  draft: "Brouillon",
  sent: "Envoyé",
  accepted: "Accepté",
  refused: "Refusé",
  cancelled: "Annulé",
};

export default function AffaireDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const { data: affaire, loading, error, refetch } = useAffaire(id);
  const { data: clients } = useScopedClients();
  // BUG-AG-10 — filtre strict project_id côté business. Si l'affaire n'a
  // aucun devis lié, la liste est vide (empty state actionnable plus bas).
  const { data: linkedQuotes } = useQuotesByProject(affaire?.id ?? null);

  const [editOpen, setEditOpen] = useState(false);
  const [signOpen, setSignOpen] = useState(false);
  const [abandoning, setAbandoning] = useState(false);

  const client = useMemo(
    () => clients.find((c) => c.id === affaire?.client_id) ?? null,
    [clients, affaire],
  );

  const acceptedLinkedQuotes = useMemo<QuoteRow[]>(
    () => linkedQuotes.filter((q) => q.status === "accepted"),
    [linkedQuotes],
  );
  const canSign = acceptedLinkedQuotes.length > 0;

  // Doctrine revenus mixtes natifs : on lit les snapshots écrits dans
  // audit_logs._intent côté business, mais ces colonnes ne sont pas exposées
  // via /api/affaires/[id] (DDL pas livrée). On affiche donc les valeurs si
  // présentes sur la row (champ libre en attendant), sinon 0€.
  const oneshotHt = useMemo(() => {
    const v = (affaire as Record<string, unknown> | null)?.oneshot_amount_ht;
    if (typeof v === "string") return v;
    if (typeof v === "number") return String(v);
    return "0";
  }, [affaire]);
  const mrrHt = useMemo(() => {
    const v = (affaire as Record<string, unknown> | null)?.mrr_ht;
    if (typeof v === "string") return v;
    if (typeof v === "number") return String(v);
    return "0";
  }, [affaire]);

  async function handleAbandon() {
    if (!affaire) return;
    if (
      !window.confirm(
        "Abandonner cette affaire ? Elle restera consultable mais ne sera plus active.",
      )
    ) {
      return;
    }
    setAbandoning(true);
    try {
      const res = await fetch(
        `/api/affaires/${encodeURIComponent(affaire.id)}`,
        { method: "DELETE" },
      );
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
      };
      if (!res.ok) {
        toast.error(
          json.message || json.error || `Erreur (${res.status})`,
        );
        return;
      }
      toast.success("Affaire abandonnée");
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur réseau");
    } finally {
      setAbandoning(false);
    }
  }

  return (
    <div className="p-4 sm:p-8 min-h-screen space-y-6">
      <Link
        href="/affaires"
        className="inline-flex items-center gap-1.5 text-xs text-text-muted hover:text-text-primary transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Retour aux affaires
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
            <p className="font-bold text-sm">Impossible de charger l&apos;affaire</p>
            <p className="text-xs text-amber-200/80">
              {error}. Si vous étiez authentifié, votre session a peut-être
              expiré.
            </p>
            <button
              onClick={() => router.push("/login")}
              className="text-[11px] font-bold uppercase tracking-tight px-3 py-1.5 border border-amber-400/30 hover:bg-amber-400/10"
            >
              Se reconnecter
            </button>
          </div>
        </div>
      )}

      {!loading && !error && affaire && (
        <>
          <ModuleHeader
            icon={Briefcase}
            title={affaire.name || "(sans titre)"}
            subtitle={
              client
                ? `${STAGE_LABEL[affaire.status] ?? affaire.status} · ${client.company || client.name}`
                : (STAGE_LABEL[affaire.status] ?? affaire.status)
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
                <button
                  onClick={() => setSignOpen(true)}
                  disabled={
                    affaire.lifecycle_stage === "production" ||
                    affaire.status === "abandoned" ||
                    !canSign
                  }
                  title={
                    !canSign
                      ? "Acceptez d'abord un devis lié à cette affaire"
                      : undefined
                  }
                  className="inline-flex items-center gap-1.5 px-3 py-2 border border-emerald-500/40 bg-emerald-500/10 text-emerald-200 text-[11px] font-bold uppercase tracking-tight hover:bg-emerald-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Marquer signée</span>
                </button>
                <button
                  onClick={handleAbandon}
                  disabled={abandoning || affaire.status === "abandoned"}
                  className="inline-flex items-center gap-1.5 px-3 py-2 border border-rose-500/40 bg-rose-500/10 text-rose-200 text-[11px] font-bold uppercase tracking-tight hover:bg-rose-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {abandoning ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="w-3.5 h-3.5" />
                  )}
                  <span className="hidden sm:inline">Abandonner</span>
                </button>
              </>
            }
          />

          {/* Stage badge inline (sous le header) */}
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={cn(
                "px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border",
                STAGE_COLOR[affaire.status] ??
                  "bg-zinc-500/15 text-zinc-300 border-zinc-500/30",
              )}
            >
              {STAGE_LABEL[affaire.status] ?? affaire.status}
            </span>
            <span className="text-[10px] uppercase tracking-wider text-text-muted">
              Lifecycle : {affaire.lifecycle_stage}
            </span>
          </div>

          {/* Métadonnées */}
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
                  Date close prévue
                </dt>
                <dd className="text-text-primary mt-0.5">
                  {formatDateLongFR(affaire.due_date)}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-text-muted">
                  Date création
                </dt>
                <dd className="text-text-primary mt-0.5">
                  {formatDateLongFR(affaire.created_at)}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-text-muted">
                  Dernière mise à jour
                </dt>
                <dd className="text-text-primary mt-0.5">
                  {formatDateLongFR(affaire.updated_at)}
                </dd>
              </div>
            </dl>
            {affaire.description && (
              <div className="mt-4 pt-4 border-t border-border-subtle">
                <dt className="text-[11px] uppercase tracking-wide text-text-muted mb-1">
                  Notes
                </dt>
                <p className="text-sm text-text-primary whitespace-pre-wrap">
                  {affaire.description}
                </p>
              </div>
            )}
          </section>

          {/* Montants potentiels — doctrine revenus mixtes natifs (toujours
              côte à côte, même à 0€) */}
          <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="card-sharp p-5">
              <div className="text-[10px] uppercase tracking-wider text-text-muted">
                One-shot HT
              </div>
              <div className="text-2xl font-bold tabular-nums mt-1 text-text-primary">
                {formatMoneyCompactFR(oneshotHt)}
              </div>
            </div>
            <div className="card-sharp p-5">
              <div className="text-[10px] uppercase tracking-wider text-text-muted">
                MRR HT
              </div>
              <div className="text-2xl font-bold tabular-nums mt-1 text-text-primary">
                {formatMoneyCompactFR(mrrHt)}
                <span className="text-xs text-text-muted font-medium ml-1">
                  /mois
                </span>
              </div>
            </div>
          </section>

          {/* Devis associés — BUG-AG-10 : strictement liés à cette affaire
              (project_id), pas de fallback "tous les devis du client". */}
          <section className="card-sharp p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-bold uppercase tracking-wider text-text-primary flex items-center gap-2">
                <Receipt className="w-3.5 h-3.5 text-accent-glow" />
                Devis liés à cette affaire
              </h2>
              <span className="text-[10px] text-text-muted font-mono tabular-nums">
                {linkedQuotes.length}
              </span>
            </div>
            {linkedQuotes.length === 0 ? (
              <div className="flex flex-col items-start gap-3 py-2">
                <p className="text-xs text-text-muted italic">
                  Aucun devis lié à cette affaire — créez-en un avant de
                  signer.
                </p>
                <Link
                  href={`/crm/clients/${encodeURIComponent(affaire.client_id)}?createQuote=1&projectId=${encodeURIComponent(affaire.id)}`}
                  className="inline-flex items-center gap-1.5 px-3 py-2 border border-accent-primary/40 bg-accent-primary/10 text-accent-glow text-[11px] font-bold uppercase tracking-tight hover:bg-accent-primary/20"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Créer un devis pour cette affaire
                </Link>
              </div>
            ) : (
              <>
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-[10px] uppercase tracking-wider text-text-muted border-b border-border-subtle">
                        <th className="text-left font-bold py-2">Numéro</th>
                        <th className="text-left font-bold py-2">Statut</th>
                        <th className="text-right font-bold py-2">HT</th>
                        <th className="text-right font-bold py-2">TTC</th>
                        <th className="text-right font-bold py-2">Date</th>
                        <th className="text-right font-bold py-2"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-subtle">
                      {linkedQuotes.map((q) => (
                        <tr
                          key={q.id}
                          className="hover:bg-surface-2 transition-colors"
                        >
                          <td className="py-2 font-mono text-text-primary">
                            {q.number}
                          </td>
                          <td className="py-2">
                            <span className="text-[10px] uppercase tracking-tight text-text-muted">
                              {QUOTE_STATUS_LABEL[q.status] ?? q.status}
                            </span>
                          </td>
                          <td className="py-2 text-right tabular-nums text-text-primary">
                            {formatMoneyCompactFR(q.subtotalHt)}
                          </td>
                          <td className="py-2 text-right tabular-nums text-text-muted">
                            {formatMoneyCompactFR(q.totalTtc)}
                          </td>
                          <td className="py-2 text-right tabular-nums text-text-muted">
                            {formatDateFR(q.createdAt)}
                          </td>
                          <td className="py-2 text-right">
                            <ConvertQuoteButton quoteId={q.id} status={q.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {/* Mobile cards */}
                <ul className="sm:hidden space-y-2">
                  {linkedQuotes.map((q) => (
                    <li
                      key={q.id}
                      className="border border-border-subtle bg-surface-2 p-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-sm text-text-primary">
                          {q.number}
                        </span>
                        <span className="text-[10px] uppercase tracking-tight text-text-muted">
                          {QUOTE_STATUS_LABEL[q.status] ?? q.status}
                        </span>
                      </div>
                      <div className="flex items-center justify-between mt-2 text-xs">
                        <span className="text-text-muted">
                          {formatDateFR(q.createdAt)}
                        </span>
                        <span className="tabular-nums text-text-primary">
                          {formatMoneyCompactFR(q.subtotalHt)} HT
                        </span>
                      </div>
                      <div className="mt-2 flex justify-end">
                        <ConvertQuoteButton quoteId={q.id} status={q.status} />
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>

          {/* Activité récente — endpoint audit non livré V1.1.D, empty state */}
          <section className="card-sharp p-5">
            <h2 className="text-xs font-bold uppercase tracking-wider text-text-primary flex items-center gap-2 mb-3">
              <History className="w-3.5 h-3.5 text-text-muted" />
              Activité récente
            </h2>
            <p className="text-xs text-text-muted italic">
              La timeline d&apos;audit n&apos;est pas encore exposée par
              mybotia-business V1.1.D. Les actions sur cette affaire (création,
              modification, signature) sont tracées côté serveur dans
              <span className="font-mono text-[10px]"> audit_logs</span>.
            </p>
          </section>

          <EditAffaireModal
            open={editOpen}
            onClose={() => setEditOpen(false)}
            affaire={affaire as AffaireRow}
            onSaved={() => refetch()}
          />
          <SignAffaireModal
            open={signOpen}
            onClose={() => setSignOpen(false)}
            affaireId={affaire.id}
            clientId={affaire.client_id}
            defaultOneshotHt={oneshotHt}
            defaultMrrHt={mrrHt}
          />
        </>
      )}
    </div>
  );
}

// V1.1.F — bouton de conversion devis → facture (visible si quote.status = "accepted").
function ConvertQuoteButton({
  quoteId,
  status,
}: {
  quoteId: string;
  status: QuoteRow["status"];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  if (status !== "accepted") {
    return null;
  }
  async function handleConvert() {
    if (!confirm("Convertir ce devis en facture ?")) return;
    setBusy(true);
    try {
      const inv = await convertQuoteToInvoiceApi(quoteId);
      toast.success(`Facture ${inv.number} créée.`);
      router.push(`/invoices/${inv.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur conversion");
    } finally {
      setBusy(false);
    }
  }
  return (
    <button
      type="button"
      onClick={handleConvert}
      disabled={busy}
      className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-bold uppercase tracking-tight border border-accent-primary/40 text-accent-glow hover:bg-accent-primary/10 disabled:opacity-50"
      title="Convertir en facture"
    >
      {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Receipt className="w-3 h-3" />}
      Facturer
    </button>
  );
}
