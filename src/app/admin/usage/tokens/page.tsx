"use client";

// Bloc 6F — Vue admin globale usage tokens. Superadmin only (ACL serveur).

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Coins,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Clock,
  XCircle,
  ExternalLink,
  RefreshCw,
} from "lucide-react";
import { ModuleHeader } from "@/components/shared/ModuleHeader";

interface TenantSummary {
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

const STATUS_STYLE: Record<TenantSummary["status"], { label: string; chip: string; Icon: typeof CheckCircle2 }> = {
  ready: { label: "ready", chip: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30", Icon: CheckCircle2 },
  partial: { label: "partial", chip: "bg-blue-500/15 text-blue-300 border-blue-500/30", Icon: Clock },
  to_configure: { label: "à configurer", chip: "bg-amber-500/15 text-amber-300 border-amber-500/30", Icon: AlertCircle },
  error: { label: "erreur", chip: "bg-red-500/15 text-red-300 border-red-500/30", Icon: XCircle },
};

function fmtTk(n: number | null): string {
  if (n === null) return "—";
  return n.toLocaleString("fr-FR");
}
function fmtMoney(n: number | null, currency: string): string {
  if (n === null) return "—";
  return `${n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

export default function AdminUsageTokensPage() {
  const [data, setData] = useState<{ generatedAt: string; tenants: TenantSummary[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function load() {
    setLoading(true);
    setError(null);
    fetch("/api/admin/usage/tokens")
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

  const totals = useMemo(() => {
    if (!data) return null;
    let totIncluded = 0;
    let totConsumed = 0;
    let totOverage = 0;
    let totCost = 0;
    let withUsage = 0;
    for (const t of data.tenants) {
      if (t.tokensIncludedMonthly !== null) totIncluded += t.tokensIncludedMonthly;
      totConsumed += t.tokensConsumedMonth;
      totOverage += t.tokensOverage;
      if (t.estimatedCostMonth !== null) totCost += t.estimatedCostMonth;
      if (t.hasUsage) withUsage += 1;
    }
    return { totIncluded, totConsumed, totOverage, totCost, withUsage, total: data.tenants.length };
  }, [data]);

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
        <ModuleHeader icon={Coins} title="Admin · Usage tokens" subtitle="Zone superadmin" />
        <div className="mt-6 flex items-start gap-2 p-4 border border-status-danger/30 bg-status-danger/10 text-status-danger text-sm">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error || "Aucune donnée"}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 min-h-screen space-y-6">
      <ModuleHeader
        icon={Coins}
        title="Admin · Usage tokens"
        subtitle={`Mois en cours · ${data.tenants.length} tenant(s)`}
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

      {/* Totaux écosystème */}
      {totals && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Total label="Tenants instrumentés" value={`${totals.withUsage}/${totals.total}`} />
          <Total label="Tokens inclus / mois" value={fmtTk(totals.totIncluded)} accent />
          <Total label="Tokens consommés" value={fmtTk(totals.totConsumed)} />
          <Total label="Tokens dépassement" value={fmtTk(totals.totOverage)} />
          <Total label="Coût estimé" value={fmtMoney(totals.totCost, "EUR")} />
        </div>
      )}

      <section className="card-sharp p-6">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="border-b border-border-subtle text-text-muted text-[10px] uppercase tracking-wider">
              <tr>
                <th className="text-left py-2 px-2">Tenant</th>
                <th className="text-right py-2 px-2">Inclus / mois</th>
                <th className="text-right py-2 px-2">Consommés</th>
                <th className="text-right py-2 px-2">Restants</th>
                <th className="text-right py-2 px-2">Dépassement</th>
                <th className="text-right py-2 px-2">Coût mois</th>
                <th className="text-right py-2 px-2">Surcoût</th>
                <th className="text-center py-2 px-2">Statut</th>
                <th className="text-right py-2 px-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {data.tenants.map((t) => {
                const st = STATUS_STYLE[t.status];
                const Icon = st.Icon;
                return (
                  <tr key={t.tenant} className="hover:bg-surface-2/40">
                    <td className="py-2 px-2">
                      <p className="text-text-primary font-semibold">{t.displayName || t.tenant}</p>
                      <p className="text-text-muted text-[10px] font-mono">{t.tenant}</p>
                    </td>
                    <td className="py-2 px-2 text-right text-text-primary font-mono">{fmtTk(t.tokensIncludedMonthly)}</td>
                    <td className="py-2 px-2 text-right text-text-primary font-mono">{fmtTk(t.tokensConsumedMonth)}</td>
                    <td className="py-2 px-2 text-right text-text-muted font-mono">{fmtTk(t.tokensRemaining)}</td>
                    <td className={`py-2 px-2 text-right font-mono ${t.tokensOverage > 0 ? "text-amber-300" : "text-text-muted"}`}>
                      {fmtTk(t.tokensOverage)}
                    </td>
                    <td className="py-2 px-2 text-right text-text-secondary font-mono">{fmtMoney(t.estimatedCostMonth, t.currency)}</td>
                    <td className={`py-2 px-2 text-right font-mono ${t.estimatedOverageAmount && t.estimatedOverageAmount > 0 ? "text-amber-300" : "text-text-muted"}`}>
                      {fmtMoney(t.estimatedOverageAmount, t.currency)}
                    </td>
                    <td className="py-2 px-2 text-center">
                      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-tight border ${st.chip}`}>
                        <Icon className="w-2.5 h-2.5" />
                        {st.label}
                      </span>
                    </td>
                    <td className="py-2 px-2 text-right">
                      <Link
                        href={`/admin/tenants/${encodeURIComponent(t.tenant)}`}
                        className="inline-flex items-center gap-1 text-accent-glow text-[10px] hover:underline"
                        title="Voir tenant"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <p className="text-[10px] text-text-muted italic text-center">
        Généré à {new Date(data.generatedAt).toLocaleTimeString("fr-FR")} · Mois courant ·
        L&apos;instrumentation des consommations réelles est à brancher dans claude-bridge / api-mybotia (Bloc 6G).
      </p>
    </div>
  );
}

function Total({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`p-3 border ${accent ? "border-accent-primary/30 bg-accent-primary/5" : "border-border-subtle bg-surface-2/50"}`}>
      <p className="text-[10px] uppercase tracking-wider text-text-muted">{label}</p>
      <p className={`text-base font-bold mt-1 font-mono ${accent ? "text-accent-glow" : "text-text-primary"}`}>{value}</p>
    </div>
  );
}
