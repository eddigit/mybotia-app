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
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { FeatureDisabled } from "@/components/shared/FeatureDisabled";
import { useCockpitFeatures, useFinanceSummary } from "@/hooks/use-api";
import { cn } from "@/lib/utils";

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

export default function FinancePage() {
  const { data: cockpitFeatures, loading: featuresLoading } = useCockpitFeatures();
  const financeEnabled = cockpitFeatures?.features?.finance === true;

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
        <div className="card-sharp p-5 flex items-start gap-3 text-sm border-amber-400/30 bg-amber-400/5 text-amber-200">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">Trésorerie indisponible</p>
            <p className="text-[12px] mt-1 text-amber-200/80">
              {error}. Pour la vue KPI multi-sources, voir{" "}
              <Link href="/finance/kpis" className="font-mono text-accent-glow hover:underline">
                /finance/kpis
              </Link>
              .
            </p>
          </div>
        </div>
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

          <p className="text-[10px] text-text-muted italic text-center pt-2">
            Vue agrégée — détail factures encaissées et abonnements actifs : à
            venir Phase 2. KPI multi-sources Dolibarr →{" "}
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
