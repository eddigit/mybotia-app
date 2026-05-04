"use client";

// UB-7 — Page Admin Billing globale.
// Source : GET /api/admin/billing/usage (UB-4, superadmin only).
// Doctrine : EUR uniquement. Aucun provider/model/Sonnet/Opus/Claude/Anthropic/GPT/Kimi.

import { useEffect, useMemo, useState } from "react";
import {
  Wallet,
  Loader2,
  AlertCircle,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  CircleAlert,
  CircleHelp,
  Sparkles,
  Zap,
  TrendingUp,
} from "lucide-react";
import { ModuleHeader } from "@/components/shared/ModuleHeader";

type AlertState =
  | "ok"
  | "soft_limit"
  | "high_usage"
  | "hard_limit"
  | "not_configured";

interface ServiceTier {
  tier: string;
  label: string;
  consumed_client_eur: number;
  consumed_api_eur: number;
}

interface BillingItem {
  tenant_slug: string;
  tenant_label: string;
  agent_slug: string | null;
  plan: { code: string | null; label: string | null; category: string | null };
  budget: {
    monthly_eur: number;
    consumed_client_eur: number;
    consumed_api_eur: number;
    remaining_eur: number;
    usage_percent: number;
    recharges_eur: number;
  };
  margin: { eur: number; percent: number | null };
  limits: {
    soft_limit_percent: number;
    hard_limit_percent: number;
    recharge_enabled: boolean;
  };
  alert_state: AlertState;
  service_tiers: ServiceTier[];
}

interface BillingResp {
  status: "ok";
  period: { month: string; from: string; to: string };
  summary: {
    tenants_count: number;
    configured_count: number;
    not_configured_count: number;
    budget_total_eur: number;
    consumed_client_eur: number;
    consumed_api_eur: number;
    margin_eur: number;
    recharges_eur: number;
  };
  items: BillingItem[];
}

const fmtEur = (n: number) =>
  `${n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

const fmtMonthLabel = (monthIso: string) => {
  const [y, m] = monthIso.split("-");
  if (!y || !m) return monthIso;
  const months = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];
  return `${months[Number(m) - 1]} ${y}`;
};

type FilterKey = "all" | "ok" | "alerts" | "not_configured";

const ALERT_FILTERS: AlertState[] = ["soft_limit", "high_usage", "hard_limit"];

export default function AdminBillingPage() {
  const [data, setData] = useState<BillingResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>("all");

  function load() {
    setLoading(true);
    setError(null);
    fetch("/api/admin/billing/usage", { credentials: "same-origin" })
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
        return j as BillingResp;
      })
      .then(setData)
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : "Erreur")
      )
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  const filteredItems = useMemo(() => {
    if (!data) return [];
    if (filter === "all") return data.items;
    if (filter === "ok") return data.items.filter((i) => i.alert_state === "ok");
    if (filter === "not_configured")
      return data.items.filter((i) => i.alert_state === "not_configured");
    return data.items.filter((i) =>
      ALERT_FILTERS.includes(i.alert_state)
    );
  }, [data, filter]);

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
        <ModuleHeader icon={Wallet} title="Billing IA" />
        <div className="mt-6 flex items-start gap-2 p-4 border border-status-danger/30 bg-status-danger/10 text-status-danger text-sm">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error || "Aucune donnée"}</span>
        </div>
      </div>
    );
  }

  const { summary, period, items } = data;
  const counts = {
    all: items.length,
    ok: items.filter((i) => i.alert_state === "ok").length,
    alerts: items.filter((i) => ALERT_FILTERS.includes(i.alert_state)).length,
    not_configured: items.filter((i) => i.alert_state === "not_configured").length,
  };

  return (
    <div className="p-8 min-h-screen space-y-6">
      <ModuleHeader
        icon={Wallet}
        title="Billing IA"
        subtitle={`${fmtMonthLabel(period.month)} · ${summary.tenants_count} tenant${
          summary.tenants_count > 1 ? "s" : ""
        } actif${summary.tenants_count > 1 ? "s" : ""}`}
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

      {/* Cards résumé */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <SummaryCard
          label="Budget total"
          value={fmtEur(summary.budget_total_eur)}
          accent
        />
        <SummaryCard
          label="Consommé client"
          value={fmtEur(summary.consumed_client_eur)}
        />
        <SummaryCard
          label="Coût API interne"
          value={fmtEur(summary.consumed_api_eur)}
          tone="muted"
        />
        <SummaryCard
          label="Marge"
          value={fmtEur(summary.margin_eur)}
          icon={TrendingUp}
          tone={summary.margin_eur >= 0 ? "good" : "danger"}
        />
        <SummaryCard
          label="Recharges"
          value={fmtEur(summary.recharges_eur)}
        />
        <SummaryCard
          label="Configurés"
          value={`${summary.configured_count} / ${summary.tenants_count}`}
          tone={summary.not_configured_count > 0 ? "warn" : "good"}
        />
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] uppercase tracking-wider text-text-muted font-bold">
          Filtre
        </span>
        <FilterChip active={filter === "all"}             onClick={() => setFilter("all")}            label="Tous"             count={counts.all} />
        <FilterChip active={filter === "ok"}              onClick={() => setFilter("ok")}             label="Dans la cible"    count={counts.ok} />
        <FilterChip active={filter === "alerts"}          onClick={() => setFilter("alerts")}         label="Alertes"          count={counts.alerts}          tone="warn" />
        <FilterChip active={filter === "not_configured"} onClick={() => setFilter("not_configured")} label="Non configurés"   count={counts.not_configured} tone="muted" />
      </div>

      {/* Tableau tenants */}
      <section className="card-sharp p-6">
        <h2 className="text-sm font-bold uppercase tracking-tight text-text-primary font-headline mb-4">
          Tenants × Agents — {fmtMonthLabel(period.month)}
        </h2>
        {items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-text-muted">
            <CircleHelp className="w-6 h-6" />
            <p className="text-xs italic">
              Aucun tenant n&apos;a de subscription IA active ni d&apos;usage ce mois.
            </p>
          </div>
        ) : filteredItems.length === 0 ? (
          <p className="text-xs text-text-muted italic text-center py-6">
            Aucun tenant ne correspond à ce filtre.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="border-b border-border-subtle text-text-muted text-[10px] uppercase tracking-wider">
                <tr>
                  <th className="text-left py-2 px-2">Tenant</th>
                  <th className="text-left py-2 px-2">Agent</th>
                  <th className="text-left py-2 px-2">Plan</th>
                  <th className="text-right py-2 px-2">Budget</th>
                  <th className="text-right py-2 px-2">Consommé</th>
                  <th className="text-right py-2 px-2">Restant</th>
                  <th className="text-right py-2 px-2">Usage</th>
                  <th className="text-right py-2 px-2">Marge</th>
                  <th className="text-right py-2 px-2">Recharges</th>
                  <th className="text-left py-2 px-2">État</th>
                  <th className="text-left py-2 px-2">Tiers</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {filteredItems.map((it, i) => (
                  <tr key={`${it.tenant_slug}-${it.agent_slug ?? "none"}-${i}`} className="hover:bg-surface-2/40">
                    <td className="py-2 px-2 text-text-primary font-bold">
                      {it.tenant_label}
                      <span className="block text-[10px] text-text-muted font-normal font-mono">
                        {it.tenant_slug}
                      </span>
                    </td>
                    <td className="py-2 px-2 text-text-secondary font-mono text-[11px]">
                      {it.agent_slug ?? "—"}
                    </td>
                    <td className="py-2 px-2 text-text-secondary text-[11px]">
                      {it.plan.label ?? <span className="text-text-muted italic">—</span>}
                      {it.plan.code && (
                        <span className="block text-[10px] text-text-muted font-mono">
                          {it.plan.code}
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-2 text-right font-mono">
                      {fmtEur(it.budget.monthly_eur)}
                    </td>
                    <td className="py-2 px-2 text-right font-mono text-text-primary">
                      {fmtEur(it.budget.consumed_client_eur)}
                    </td>
                    <td className={`py-2 px-2 text-right font-mono ${it.budget.remaining_eur < 0 ? "text-amber-300" : ""}`}>
                      {fmtEur(it.budget.remaining_eur)}
                    </td>
                    <td className="py-2 px-2 text-right font-mono text-text-muted">
                      {it.budget.usage_percent.toFixed(2).replace(".", ",")} %
                    </td>
                    <td className="py-2 px-2 text-right font-mono">
                      <span className={it.margin.eur >= 0 ? "text-emerald-300" : "text-status-danger"}>
                        {fmtEur(it.margin.eur)}
                      </span>
                      {it.margin.percent !== null && (
                        <span className="block text-[10px] text-text-muted">
                          {it.margin.percent.toFixed(1).replace(".", ",")} %
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-2 text-right font-mono text-text-muted">
                      {fmtEur(it.budget.recharges_eur)}
                    </td>
                    <td className="py-2 px-2">
                      <StateBadge state={it.alert_state} />
                    </td>
                    <td className="py-2 px-2">
                      <TierChips tiers={it.service_tiers} />
                    </td>
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

function SummaryCard({
  label,
  value,
  accent,
  tone,
  icon: Icon,
}: {
  label: string;
  value: string;
  accent?: boolean;
  tone?: "good" | "warn" | "danger" | "muted";
  icon?: React.ComponentType<{ className?: string }>;
}) {
  const colorClass =
    tone === "danger"
      ? "text-status-danger"
      : tone === "warn"
      ? "text-amber-300"
      : tone === "good"
      ? "text-emerald-300"
      : tone === "muted"
      ? "text-text-secondary"
      : accent
      ? "text-accent-glow"
      : "text-text-primary";
  return (
    <div className="card-sharp-high p-4">
      <p className="text-[10px] uppercase tracking-wider text-text-muted flex items-center gap-1">
        {Icon && <Icon className="w-3 h-3" />}
        {label}
      </p>
      <p className={`text-base font-headline font-extrabold mt-1.5 font-mono ${colorClass}`}>
        {value}
      </p>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  label,
  count,
  tone,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  tone?: "warn" | "muted";
}) {
  const baseTone =
    tone === "warn"
      ? "border-amber-400/30 text-amber-200"
      : tone === "muted"
      ? "border-border-subtle text-text-muted"
      : "border-border-subtle text-text-secondary";
  const activeTone = active
    ? tone === "warn"
      ? "bg-amber-400/15 text-amber-200 border-amber-400/50"
      : "bg-accent-primary/15 text-accent-glow border-accent-primary/40"
    : "hover:text-text-primary hover:border-accent-primary/30";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-tight border transition-all ${baseTone} ${activeTone}`}
    >
      {label}
      <span className="font-mono normal-case">({count})</span>
    </button>
  );
}

function StateBadge({ state }: { state: AlertState }) {
  if (state === "not_configured") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold uppercase tracking-tight border border-border-subtle text-text-muted bg-surface-2">
        <CircleHelp className="w-3 h-3" />
        Non configuré
      </span>
    );
  }
  if (state === "hard_limit") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold uppercase tracking-tight border border-status-danger/40 text-status-danger bg-status-danger/10">
        <CircleAlert className="w-3 h-3" />
        Limite
      </span>
    );
  }
  if (state === "high_usage") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold uppercase tracking-tight border border-amber-400/40 text-amber-300 bg-amber-400/10">
        <AlertTriangle className="w-3 h-3" />
        Élevé
      </span>
    );
  }
  if (state === "soft_limit") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold uppercase tracking-tight border border-amber-300/30 text-amber-200 bg-amber-300/5">
        <AlertTriangle className="w-3 h-3" />
        Souple
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold uppercase tracking-tight border border-emerald-400/30 text-emerald-300 bg-emerald-400/10">
      <CheckCircle2 className="w-3 h-3" />
      Cible
    </span>
  );
}

function TierChips({ tiers }: { tiers: ServiceTier[] }) {
  if (tiers.length === 0) {
    return <span className="text-[10px] text-text-muted italic">—</span>;
  }
  const order = ["standard", "premium"];
  return (
    <div className="flex flex-wrap gap-1">
      {order
        .filter((k) => tiers.some((t) => t.tier === k))
        .map((k) => {
          const t = tiers.find((x) => x.tier === k)!;
          return (
            <span
              key={k}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-tight border border-border-subtle bg-surface-2 text-text-secondary"
              title={`${t.label} — client ${fmtEur(t.consumed_client_eur)} · API ${fmtEur(t.consumed_api_eur)}`}
            >
              {k === "premium" ? (
                <Sparkles className="w-2.5 h-2.5 text-accent-glow" />
              ) : (
                <Zap className="w-2.5 h-2.5 text-text-muted" />
              )}
              {t.label}
            </span>
          );
        })}
    </div>
  );
}
