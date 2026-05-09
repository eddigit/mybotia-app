"use client";

// V1.1.D Phase 1 — Cockpit Trésorerie (parité business /finance).
//
// Source : /api/finance/summary?year=YYYY (proxy → business /api/v1/finance/summary).
// Affichage : 3 KPI (MRR HT, ARR HT, one-shot YTD) + graphique mensuel
// MRR + one-shot stacké sur 12 mois.
//
// Doctrine : aucun mock. Si feature `finance` désactivée → FeatureDisabled.
// Si endpoint vide ou erreur → empty state ou bandeau d'erreur.
// L'ancienne page KPI multi-sources (Bloc 6C) reste accessible via /finance/kpis.

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Wallet,
  TrendingUp,
  Coins,
  Loader2,
  RefreshCw,
  FileText,
  Repeat,
  Download,
  ExternalLink,
} from "lucide-react";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { FeatureDisabled } from "@/components/shared/FeatureDisabled";
import {
  useCockpitFeatures,
  useFinanceSummary,
  type FinanceActiveSubscription,
  type FinanceRecentInvoice,
} from "@/hooks/use-api";
import { cn } from "@/lib/utils";
import { formatDateFR, formatDateLongFR } from "@/lib/format";
import { ErrorState } from "@/components/shared/ErrorState";

const FR_MONTHS = [
  "janv.",
  "févr.",
  "mars",
  "avr.",
  "mai",
  "juin",
  "juil.",
  "août",
  "sept.",
  "oct.",
  "nov.",
  "déc.",
];

function fmtMoney(n: number, currency: string): string {
  return n.toLocaleString("fr-FR", {
    style: "currency",
    currency: currency || "EUR",
    maximumFractionDigits: 0,
  });
}

function fmtMoneyPrecise(n: number, currency: string): string {
  return n.toLocaleString("fr-FR", {
    style: "currency",
    currency: currency || "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// Helpers FR centralisés via @/lib/format. Les fonctions locales fmtDateShort
// et fmtDateLong restent comme adapters fins (signature `string | null`).
function fmtDateShort(iso: string | null): string {
  return formatDateFR(iso);
}

function fmtDateLong(iso: string | null): string {
  return formatDateLongFR(iso);
}

const BILLING_CYCLE_LABEL: Record<string, string> = {
  monthly: "Mensuel",
  quarterly: "Trimestriel",
  yearly: "Annuel",
};

const INVOICE_STATUS_TONE: Record<
  string,
  { label: string; className: string }
> = {
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

export default function FinancePage() {
  const { data: cockpitFeatures, loading: featuresLoading } = useCockpitFeatures();
  const financeEnabled = cockpitFeatures?.features?.finance === true;
  const isBusiness = cockpitFeatures?.crmProvider === "mybotia_business";

  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const { data: summary, loading, error, refetch } = useFinanceSummary(year);

  const maxStack = useMemo(() => {
    if (!summary) return 0;
    return summary.by_month.reduce(
      (acc, p) => Math.max(acc, Number(p.mrr ?? 0) + Number(p.oneshot ?? 0)),
      0,
    );
  }, [summary]);

  const noActivity =
    summary !== null &&
    summary.mrr_active_ht === 0 &&
    summary.oneshot_ytd_ht === 0;

  if (!featuresLoading && cockpitFeatures && !financeEnabled) {
    return (
      <FeatureDisabled
        featureKey="finance"
        tenantSlug={cockpitFeatures.tenant}
      />
    );
  }

  const currency = summary?.currency || "EUR";

  return (
    <div className="p-8 min-h-screen space-y-6">
      <ModuleHeader
        icon={Wallet}
        title="Trésorerie"
        subtitle={
          summary
            ? `Cockpit ${cockpitFeatures?.displayName || cockpitFeatures?.tenant || ""} · exercice ${year}`
            : "Chargement…"
        }
        actions={
          <div className="flex items-center gap-2">
            {[currentYear - 1, currentYear, currentYear + 1].map((y) => (
              <button
                key={y}
                type="button"
                onClick={() => setYear(y)}
                className={cn(
                  "px-2.5 py-1 text-[10px] font-bold uppercase tracking-tight border transition-colors",
                  y === year
                    ? "bg-accent-primary/20 text-accent-glow border-accent-primary/40"
                    : "border-border-subtle text-text-muted hover:text-text-primary",
                )}
              >
                {y}
              </button>
            ))}
            <button
              onClick={refetch}
              className="inline-flex items-center gap-1.5 px-3 py-1 text-[10px] font-bold uppercase tracking-tight border border-border-subtle text-text-muted hover:text-text-primary"
            >
              <RefreshCw className="w-3 h-3" />
              Actualiser
            </button>
          </div>
        }
      />

      {error && (
        <ErrorState
          title="Trésorerie indisponible"
          message={`${error}. Pour la vue KPI multi-sources, voir /finance/kpis.`}
          onRetry={refetch}
        />
      )}

      {loading && (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-accent-glow" />
        </div>
      )}

      {!loading && !error && summary && (
        <>
          <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <KpiCard
              icon={TrendingUp}
              label="MRR actif HT"
              value={fmtMoney(summary.mrr_active_ht, currency)}
              hint={`ARR équivalent : ${fmtMoney(summary.arr_active_ht, currency)}`}
              tone="info"
            />
            <KpiCard
              icon={Coins}
              label={`One-shot signé ${year}`}
              value={fmtMoney(summary.oneshot_ytd_ht, currency)}
            />
            <KpiCard
              icon={Wallet}
              label="Portefeuille global"
              value={fmtMoney(summary.portfolio_total_ht, currency)}
              hint="ARR + one-shot YTD"
              tone="success"
            />
          </section>

          {noActivity && (
            <div className="card-sharp p-8 text-center space-y-2">
              <p className="text-sm font-bold text-text-primary">
                Aucune facture émise — démarre la première.
              </p>
              <p className="text-[12px] text-text-muted">
                Cette page se peuplera dès la première facture émise et le
                premier abonnement activé côté business.
              </p>
            </div>
          )}

          <section className="card-sharp p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-tight text-text-primary font-headline">
                MRR + one-shot — 12 mois
              </h2>
              <div className="flex items-center gap-3 text-[10px] text-text-muted">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 bg-accent-primary" />
                  MRR HT
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 bg-accent-primary/30" />
                  One-shot HT
                </span>
              </div>
            </div>

            {summary.by_month.length === 0 ? (
              <p className="text-sm text-text-muted text-center py-8">
                Aucune donnée mensuelle pour cet exercice.
              </p>
            ) : (
              <div className="flex items-end gap-1 h-48">
                {summary.by_month.map((p) => {
                  const total = Number(p.mrr ?? 0) + Number(p.oneshot ?? 0);
                  const totalH = maxStack > 0 ? (total / maxStack) * 100 : 0;
                  const mrrH =
                    maxStack > 0 ? (Number(p.mrr ?? 0) / maxStack) * 100 : 0;
                  return (
                    <div
                      key={p.month}
                      className="flex-1 flex flex-col items-center gap-1 group"
                    >
                      <div className="relative w-full h-full flex flex-col justify-end">
                        <div
                          className="bg-accent-primary/30 transition-all"
                          style={{ height: `${Math.max(0, totalH - mrrH)}%` }}
                          title={`One-shot : ${fmtMoney(Number(p.oneshot ?? 0), currency)}`}
                        />
                        <div
                          className="bg-accent-primary transition-all"
                          style={{ height: `${mrrH}%` }}
                          title={`MRR : ${fmtMoney(Number(p.mrr ?? 0), currency)}`}
                        />
                      </div>
                      <span className="text-[10px] text-text-muted">
                        {FR_MONTHS[Number(p.month) - 1] ?? p.month}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="card-sharp p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold uppercase tracking-tight text-text-primary font-headline">
                Détail mensuel
              </h2>
              <span className="text-[10px] text-text-muted font-mono">
                {summary.by_month.length} ligne{summary.by_month.length > 1 ? "s" : ""}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-[10px] uppercase tracking-tight text-text-muted">
                  <tr className="border-b border-border-subtle">
                    <th className="text-left py-2 font-bold">Mois</th>
                    <th className="text-right py-2 font-bold">MRR HT</th>
                    <th className="text-right py-2 font-bold">One-shot HT</th>
                    <th className="text-right py-2 font-bold">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {summary.by_month.map((p) => {
                    const total = Number(p.mrr ?? 0) + Number(p.oneshot ?? 0);
                    return (
                      <tr key={p.month}>
                        <td className="py-2 text-text-primary">
                          {FR_MONTHS[Number(p.month) - 1] ?? p.month} {year}
                        </td>
                        <td className="py-2 text-right tabular-nums text-text-secondary">
                          {fmtMoney(Number(p.mrr ?? 0), currency)}
                        </td>
                        <td className="py-2 text-right tabular-nums text-text-secondary">
                          {fmtMoney(Number(p.oneshot ?? 0), currency)}
                        </td>
                        <td className="py-2 text-right tabular-nums font-bold text-text-primary">
                          {fmtMoney(total, currency)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <ActiveSubscriptionsSection
            subscriptions={summary.active_subscriptions}
            currency={currency}
          />

          <RecentInvoicesSection
            invoices={summary.recent_invoices}
            currency={currency}
            isBusiness={isBusiness}
          />

          <p className="text-[10px] text-text-muted italic text-center pt-2">
            Vue agrégée parité business. KPI multi-sources Dolibarr →{" "}
            <Link href="/finance/kpis" className="font-mono text-accent-glow hover:underline">
              /finance/kpis
            </Link>
            .
          </p>
        </>
      )}
    </div>
  );
}

function ActiveSubscriptionsSection({
  subscriptions,
  currency,
}: {
  subscriptions: FinanceActiveSubscription[];
  currency: string;
}) {
  return (
    <section className="card-sharp p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-bold uppercase tracking-tight text-text-primary font-headline inline-flex items-center gap-2">
          <Repeat className="w-4 h-4 text-accent-glow" />
          Abonnements actifs
        </h2>
        <span className="text-[10px] text-text-muted font-mono">
          {subscriptions.length} ligne{subscriptions.length > 1 ? "s" : ""}
        </span>
      </div>

      {subscriptions.length === 0 ? (
        <div className="py-10 text-center space-y-3">
          <p className="text-sm text-text-primary font-bold">
            Aucun abonnement actif.
          </p>
          <p className="text-[12px] text-text-muted">
            Les abonnements apparaissent ici dès qu&apos;une production récurrente
            est signée.
          </p>
          <Link
            href="/affaires"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-tight border border-accent-primary/40 text-accent-glow hover:bg-accent-primary/10 transition-colors"
          >
            Ouvrir le pipeline affaires
            <ExternalLink className="w-3 h-3" />
          </Link>
        </div>
      ) : (
        <>
          {/* Desktop : table */}
          <div className="overflow-x-auto hidden md:block">
            <table className="w-full text-sm">
              <thead className="text-[10px] uppercase tracking-tight text-text-muted">
                <tr className="border-b border-border-subtle">
                  <th className="text-left py-2 font-bold">Libellé</th>
                  <th className="text-left py-2 font-bold">Client</th>
                  <th className="text-left py-2 font-bold">Production</th>
                  <th className="text-right py-2 font-bold">MRR HT</th>
                  <th className="text-left py-2 font-bold pl-3">Cycle</th>
                  <th className="text-left py-2 font-bold">Début</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {subscriptions.map((s) => (
                  <tr key={s.id}>
                    <td className="py-2 text-text-primary font-medium">
                      {s.label}
                    </td>
                    <td className="py-2 text-text-secondary">
                      {s.client_name}
                    </td>
                    <td className="py-2 text-text-secondary">
                      {s.production_id && s.production_title ? (
                        <Link
                          href={`/productions/${s.production_id}`}
                          className="text-accent-glow hover:underline inline-flex items-center gap-1"
                        >
                          {s.production_title}
                          <ExternalLink className="w-3 h-3" />
                        </Link>
                      ) : (
                        <span className="text-text-muted">—</span>
                      )}
                    </td>
                    <td className="py-2 text-right tabular-nums font-bold text-text-primary">
                      {fmtMoney(s.mrr_ht, currency)}
                    </td>
                    <td className="py-2 pl-3 text-text-secondary">
                      {BILLING_CYCLE_LABEL[s.billing_cycle] ?? s.billing_cycle}
                    </td>
                    <td className="py-2 text-text-secondary tabular-nums">
                      <span title={fmtDateLong(s.started_at)}>
                        {fmtDateShort(s.started_at)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile : cards */}
          <div className="md:hidden space-y-3">
            {subscriptions.map((s) => (
              <div
                key={s.id}
                className="border border-border-subtle p-3 space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-text-primary truncate">
                      {s.label}
                    </p>
                    <p className="text-[12px] text-text-secondary truncate">
                      {s.client_name}
                    </p>
                  </div>
                  <span className="text-sm font-bold tabular-nums text-text-primary shrink-0">
                    {fmtMoney(s.mrr_ht, currency)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-text-muted">
                  <span>
                    {BILLING_CYCLE_LABEL[s.billing_cycle] ?? s.billing_cycle}
                  </span>
                  <span className="tabular-nums">
                    {fmtDateShort(s.started_at)}
                  </span>
                </div>
                {s.production_id && s.production_title && (
                  <Link
                    href={`/productions/${s.production_id}`}
                    className="inline-flex items-center gap-1 text-[11px] text-accent-glow hover:underline"
                  >
                    {s.production_title}
                    <ExternalLink className="w-3 h-3" />
                  </Link>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function RecentInvoicesSection({
  invoices,
  currency,
  isBusiness,
}: {
  invoices: FinanceRecentInvoice[];
  currency: string;
  isBusiness: boolean;
}) {
  return (
    <section className="card-sharp p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-bold uppercase tracking-tight text-text-primary font-headline inline-flex items-center gap-2">
          <FileText className="w-4 h-4 text-accent-glow" />
          Dernières factures
        </h2>
        <span className="text-[10px] text-text-muted font-mono">
          {invoices.length} ligne{invoices.length > 1 ? "s" : ""}
        </span>
      </div>

      {invoices.length === 0 ? (
        <div className="py-10 text-center space-y-3">
          <p className="text-sm text-text-primary font-bold">
            Aucune facture émise.
          </p>
          <p className="text-[12px] text-text-muted">
            Les factures apparaissent ici dès que la première est éditée côté
            CRM.
          </p>
          <Link
            href="/documents"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-tight border border-accent-primary/40 text-accent-glow hover:bg-accent-primary/10 transition-colors"
          >
            Ouvrir le module documents
            <ExternalLink className="w-3 h-3" />
          </Link>
        </div>
      ) : (
        <>
          {/* Desktop : table */}
          <div className="overflow-x-auto hidden md:block">
            <table className="w-full text-sm">
              <thead className="text-[10px] uppercase tracking-tight text-text-muted">
                <tr className="border-b border-border-subtle">
                  <th className="text-left py-2 font-bold">Numéro</th>
                  <th className="text-left py-2 font-bold">Client</th>
                  <th className="text-left py-2 font-bold">Date</th>
                  <th className="text-right py-2 font-bold">Montant TTC</th>
                  <th className="text-left py-2 font-bold pl-3">Statut</th>
                  <th className="text-right py-2 font-bold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {invoices.map((inv) => {
                  const tone =
                    INVOICE_STATUS_TONE[inv.status] ?? {
                      label: inv.status,
                      className:
                        "bg-text-muted/15 text-text-muted border-border-subtle",
                    };
                  const pdfHref = `/api/documents/download?modulepart=facture&ref=${encodeURIComponent(inv.number)}`;
                  return (
                    <tr key={inv.id}>
                      <td className="py-2 font-mono text-[12px] text-text-primary">
                        {inv.number}
                      </td>
                      <td className="py-2 text-text-secondary">
                        {inv.client_name ?? (
                          <span className="text-text-muted">—</span>
                        )}
                      </td>
                      <td className="py-2 text-text-secondary tabular-nums">
                        <span title={fmtDateLong(inv.issued_at)}>
                          {fmtDateShort(inv.issued_at)}
                        </span>
                      </td>
                      <td className="py-2 text-right tabular-nums font-bold text-text-primary">
                        {fmtMoneyPrecise(inv.total_ttc, currency)}
                      </td>
                      <td className="py-2 pl-3">
                        <span
                          className={cn(
                            "inline-flex items-center px-2 py-0.5 text-[10px] font-bold uppercase tracking-tight border",
                            tone.className,
                          )}
                        >
                          {tone.label}
                        </span>
                      </td>
                      <td className="py-2 text-right">
                        <div className="inline-flex items-center gap-1">
                          {isBusiness ? (
                            <a
                              href={`/api/invoices/${encodeURIComponent(inv.id)}/pdf`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-bold uppercase tracking-tight border border-accent-primary/30 bg-accent-primary/10 text-accent-glow hover:bg-accent-primary/20"
                              title="Télécharger le PDF Premium MyBotIA"
                            >
                              <Download className="w-3 h-3" />
                              PDF
                            </a>
                          ) : (
                            <a
                              href={pdfHref}
                              className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-bold uppercase tracking-tight border border-border-subtle text-text-muted hover:text-text-primary hover:border-accent-primary/40"
                              title="Télécharger PDF"
                            >
                              <Download className="w-3 h-3" />
                              PDF
                            </a>
                          )}
                          <Link
                            href={`/documents?ref=${encodeURIComponent(inv.number)}`}
                            className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-bold uppercase tracking-tight border border-border-subtle text-text-muted hover:text-text-primary hover:border-accent-primary/40"
                            title="Voir dans documents"
                          >
                            <ExternalLink className="w-3 h-3" />
                            Voir
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile : cards */}
          <div className="md:hidden space-y-3">
            {invoices.map((inv) => {
              const tone =
                INVOICE_STATUS_TONE[inv.status] ?? {
                  label: inv.status,
                  className:
                    "bg-text-muted/15 text-text-muted border-border-subtle",
                };
              const pdfHref = `/api/documents/download?modulepart=facture&ref=${encodeURIComponent(inv.number)}`;
              return (
                <div
                  key={inv.id}
                  className="border border-border-subtle p-3 space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-mono text-[12px] text-text-primary">
                        {inv.number}
                      </p>
                      <p className="text-[12px] text-text-secondary truncate">
                        {inv.client_name ?? "—"}
                      </p>
                    </div>
                    <span className="text-sm font-bold tabular-nums text-text-primary shrink-0">
                      {fmtMoneyPrecise(inv.total_ttc, currency)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={cn(
                        "inline-flex items-center px-2 py-0.5 text-[10px] font-bold uppercase tracking-tight border",
                        tone.className,
                      )}
                    >
                      {tone.label}
                    </span>
                    <span className="text-[11px] text-text-muted tabular-nums">
                      {fmtDateShort(inv.issued_at)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    {isBusiness ? (
                      <a
                        href={`/api/invoices/${encodeURIComponent(inv.id)}/pdf`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-bold uppercase tracking-tight border border-accent-primary/30 bg-accent-primary/10 text-accent-glow"
                      >
                        <Download className="w-3 h-3" />
                        PDF
                      </a>
                    ) : (
                      <a
                        href={pdfHref}
                        className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-bold uppercase tracking-tight border border-border-subtle text-text-muted hover:text-text-primary"
                      >
                        <Download className="w-3 h-3" />
                        PDF
                      </a>
                    )}
                    <Link
                      href={`/documents?ref=${encodeURIComponent(inv.number)}`}
                      className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-bold uppercase tracking-tight border border-border-subtle text-text-muted hover:text-text-primary"
                    >
                      <ExternalLink className="w-3 h-3" />
                      Voir
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: typeof Wallet;
  label: string;
  value: string;
  hint?: string;
  tone?: "info" | "success";
}) {
  const accent =
    tone === "success"
      ? "text-emerald-300"
      : tone === "info"
        ? "text-accent-glow"
        : "text-text-primary";
  return (
    <div className="card-sharp-high p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Icon className={cn("w-4 h-4", accent)} />
        <span className="micro-label text-text-muted">{label}</span>
      </div>
      <p className="text-2xl font-headline font-extrabold leading-tight text-text-primary">
        {value}
      </p>
      {hint && <p className="text-[10px] text-text-muted">{hint}</p>}
    </div>
  );
}
