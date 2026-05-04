"use client";

// Bloc 6F — Vue client : usage tokens du cockpit courant.
// Le client ne voit que son tenant (résolu hostname côté serveur).

import { useEffect, useState } from "react";
import {
  Coins,
  Loader2,
  AlertCircle,
  Info,
  RefreshCw,
} from "lucide-react";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { UsageBillingCard } from "@/components/billing/UsageBillingCard";

interface Summary {
  tenant: string;
  displayName: string | null;
  monthIso: string;
  tokensIncludedMonthly: number | null;
  tokensConsumedMonth: number;
  tokensRemaining: number | null;
  tokensOverage: number;
  estimatedCostMonth: number | null;
  overagePricePer1000Tokens: number | null;
  estimatedOverageAmount: number | null;
  packagesActive: number;
  status: "ready" | "partial" | "to_configure" | "error";
  hasUsage: boolean;
  currency: string;
}

interface DailyRow {
  date: string;
  agentSlug: string;
  provider: string;
  model: string;
  tokensInput: number;
  tokensOutput: number;
  tokensTotal: number;
  estimatedCost: number | null;
  requestCount: number;
}

function fmtTk(n: number | null): string {
  if (n === null) return "—";
  return n.toLocaleString("fr-FR");
}
function fmtMoney(n: number | null, currency: string): string {
  if (n === null) return "—";
  return `${n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

export default function MyUsagePage() {
  const [data, setData] = useState<{ summary: Summary; daily: DailyRow[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function load() {
    setLoading(true);
    setError(null);
    fetch("/api/me/usage/tokens")
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
        return j;
      })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  if (loading) {
    return (
      <div className="p-8 min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-accent-glow" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8">
        <ModuleHeader icon={Coins} title="Mon usage tokens" />
        <div className="mt-6 flex items-start gap-2 p-4 border border-status-danger/30 bg-status-danger/10 text-status-danger text-sm">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error || "Aucune donnée"}</span>
        </div>
      </div>
    );
  }

  const { summary, daily } = data;
  const ratio =
    summary.tokensIncludedMonthly && summary.tokensIncludedMonthly > 0
      ? Math.min(100, Math.round((summary.tokensConsumedMonth / summary.tokensIncludedMonthly) * 100))
      : 0;

  return (
    <div className="p-8 min-h-screen space-y-6">
      <ModuleHeader
        icon={Coins}
        title="Consommation IA"
        subtitle={`${summary.displayName || summary.tenant} · ${summary.monthIso}`}
        actions={
          <button
            onClick={load}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-tight border border-border-subtle text-text-muted hover:text-text-primary hover:border-accent-primary/30"
          >
            <RefreshCw className="w-3 h-3" />
            Actualiser
          </button>
        }
      />

      {/* UB-6 — lecture commerciale euro-first prioritaire */}
      <UsageBillingCard />

      {/* Détail technique / historique — déclassé sous la carte commerciale */}
      <div className="pt-2">
        <h2 className="text-[11px] font-bold uppercase tracking-wider text-text-muted font-headline mb-4">
          Détail technique / historique
        </h2>
      </div>

      {/* Bandeau si pas instrumenté */}
      {!summary.hasUsage && (
        <div className="flex items-start gap-2 p-3 border border-amber-400/30 bg-amber-400/10 text-[11px] text-amber-300">
          <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>
            Suivi de consommation non encore instrumenté pour ce mois. Les
            valeurs réelles apparaîtront dès que <span className="font-mono">claude-bridge</span> /{" "}
            <span className="font-mono">api-mybotia</span> écriront dans{" "}
            <span className="font-mono">core.token_usage</span>.
          </span>
        </div>
      )}

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Tokens inclus / mois" value={fmtTk(summary.tokensIncludedMonthly)} accent />
        <Kpi label="Consommés ce mois" value={fmtTk(summary.tokensConsumedMonth)} />
        <Kpi
          label="Restants"
          value={fmtTk(summary.tokensRemaining)}
          tone={summary.tokensOverage > 0 ? "danger" : "neutral"}
        />
        <Kpi
          label="Dépassement"
          value={fmtTk(summary.tokensIncludedMonthly !== null ? summary.tokensOverage : null)}
          tone={summary.tokensOverage > 0 ? "danger" : "neutral"}
        />
      </div>

      {/* Barre de progression mois courant */}
      {summary.tokensIncludedMonthly && summary.tokensIncludedMonthly > 0 && (
        <section className="card-sharp p-6">
          <h2 className="text-sm font-bold uppercase tracking-tight text-text-primary font-headline mb-3">
            Mois en cours
          </h2>
          <div className="w-full h-2 bg-surface-3 rounded-sm overflow-hidden">
            <div
              className={`h-full ${ratio >= 100 ? "bg-status-danger" : ratio >= 80 ? "bg-amber-400" : "bg-accent-primary"}`}
              style={{ width: `${ratio}%` }}
            />
          </div>
          <div className="flex justify-between mt-2 text-[10px] text-text-muted font-mono">
            <span>{ratio}% consommé</span>
            <span>{fmtTk(summary.tokensConsumedMonth)} / {fmtTk(summary.tokensIncludedMonthly)}</span>
          </div>
        </section>
      )}

      {/* Coût */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Kpi label="Coût estimé du mois" value={fmtMoney(summary.estimatedCostMonth, summary.currency)} />
        <Kpi
          label="Surcoût dépassement"
          value={fmtMoney(summary.estimatedOverageAmount, summary.currency)}
          tone={summary.estimatedOverageAmount && summary.estimatedOverageAmount > 0 ? "danger" : "neutral"}
        />
        <Kpi
          label="Tarif dépassement / 1k tokens"
          value={summary.overagePricePer1000Tokens !== null
            ? fmtMoney(summary.overagePricePer1000Tokens, summary.currency)
            : "—"}
        />
      </div>

      {/* Historique 30 jours */}
      <section className="card-sharp p-6">
        <h2 className="text-sm font-bold uppercase tracking-tight text-text-primary font-headline mb-3">
          Historique 30 derniers jours
        </h2>
        {daily.length === 0 ? (
          <p className="text-xs text-text-muted italic text-center py-6">
            Aucune ligne d&apos;usage enregistrée.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="border-b border-border-subtle text-text-muted text-[10px] uppercase tracking-wider">
                <tr>
                  <th className="text-left py-2 px-2">Date</th>
                  <th className="text-left py-2 px-2">Agent</th>
                  <th className="text-right py-2 px-2">Input</th>
                  <th className="text-right py-2 px-2">Output</th>
                  <th className="text-right py-2 px-2">Total</th>
                  <th className="text-right py-2 px-2">Requêtes</th>
                  <th className="text-right py-2 px-2">Coût</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {daily.map((r, i) => (
                  <tr key={i} className="hover:bg-surface-2/40">
                    <td className="py-2 px-2 font-mono text-text-primary">{r.date}</td>
                    <td className="py-2 px-2 text-text-secondary">{r.agentSlug}</td>
                    <td className="py-2 px-2 text-right font-mono">{fmtTk(r.tokensInput)}</td>
                    <td className="py-2 px-2 text-right font-mono">{fmtTk(r.tokensOutput)}</td>
                    <td className="py-2 px-2 text-right font-mono text-text-primary">{fmtTk(r.tokensTotal)}</td>
                    <td className="py-2 px-2 text-right font-mono text-text-muted">{r.requestCount}</td>
                    <td className="py-2 px-2 text-right font-mono">{fmtMoney(r.estimatedCost, summary.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Kpi({ label, value, accent, tone }: { label: string; value: string; accent?: boolean; tone?: "neutral" | "danger" }) {
  const colorClass = tone === "danger" && value !== "—" && value !== "0" ? "text-amber-300" : accent ? "text-accent-glow" : "text-text-primary";
  return (
    <div className={`card-sharp-high p-4`}>
      <p className="text-[10px] uppercase tracking-wider text-text-muted">{label}</p>
      <p className={`text-xl font-headline font-extrabold mt-2 font-mono ${colorClass}`}>{value}</p>
    </div>
  );
}
