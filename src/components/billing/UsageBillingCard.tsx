"use client";

// UB-6 — Carte client lecture commerciale euro-first.
// Source : GET /api/billing/usage (UB-3).
// Doctrine : aucune mention provider / model / Sonnet / Opus / Claude / Anthropic / GPT / Kimi.

import { useEffect, useState } from "react";
import {
  Loader2,
  AlertCircle,
  Wallet,
  CheckCircle2,
  AlertTriangle,
  CircleAlert,
  CircleHelp,
  Sparkles,
  Zap,
} from "lucide-react";

type AlertItem = "soft_limit" | "high_usage" | "hard_limit";

interface UsageOk {
  status: "ok";
  tenant_slug: string;
  period: { month: string; from: string; to: string };
  plan: { code: string | null; label: string | null; category: string | null };
  budget: {
    monthly_eur: number;
    consumed_eur: number;
    remaining_eur: number;
    usage_percent: number;
  };
  limits: {
    soft_limit_percent: number;
    hard_limit_percent: number;
    recharge_enabled: boolean;
  };
  service_tiers: Array<{ tier: string; label: string; consumed_eur: number }>;
  alerts: AlertItem[];
}

interface UsageNotConfigured {
  status: "not_configured";
  tenant_slug: string;
  message: string;
  period: { month: string; from: string; to: string };
  budget: {
    monthly_eur: number;
    consumed_eur: number;
    remaining_eur: number;
    usage_percent: number;
  };
  alerts: [];
}

type UsageResp = UsageOk | UsageNotConfigured;

const fmtEur = (n: number) =>
  `${n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

const fmtMonthLabel = (monthIso: string) => {
  const [y, m] = monthIso.split("-");
  if (!y || !m) return monthIso;
  const months = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];
  return `${months[Number(m) - 1]} ${y}`;
};

function alertTone(percent: number, soft: number, hard: number) {
  if (percent >= hard) return "hard";
  if (percent >= 90) return "high";
  if (percent >= soft) return "soft";
  return "ok";
}

export function UsageBillingCard() {
  const [data, setData] = useState<UsageResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch("/api/billing/usage", { credentials: "same-origin" })
      .then(async (r) => {
        const j = (await r.json().catch(() => ({}))) as Partial<UsageResp> & {
          error?: string;
        };
        if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
        return j as UsageResp;
      })
      .then((j) => {
        if (!cancelled) setData(j);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Erreur");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <section className="card-sharp p-6 flex items-center gap-3 text-text-muted">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-sm">Chargement du budget IA…</span>
      </section>
    );
  }

  if (error || !data) {
    return (
      <section className="card-sharp p-6 flex items-start gap-2 text-status-danger text-sm">
        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
        <span>{error || "Aucune donnée"}</span>
      </section>
    );
  }

  const isOk = data.status === "ok";
  const monthly = data.budget.monthly_eur;
  const consumed = data.budget.consumed_eur;
  const remaining = data.budget.remaining_eur;
  const percent = data.budget.usage_percent;
  const soft = isOk ? data.limits.soft_limit_percent : 70;
  const hard = isOk ? data.limits.hard_limit_percent : 100;
  const tone = isOk ? alertTone(percent, soft, hard) : "notconf";
  const rechargeEnabled = isOk ? data.limits.recharge_enabled : false;

  const planLabel = isOk ? data.plan.label || "Plan personnalisé" : "Non configuré";

  const barWidth = Math.max(0, Math.min(100, percent));
  const barColor =
    tone === "hard"
      ? "bg-status-danger"
      : tone === "high"
      ? "bg-amber-400"
      : tone === "soft"
      ? "bg-amber-300"
      : tone === "notconf"
      ? "bg-surface-3"
      : "bg-accent-primary";

  return (
    <section className="card-sharp p-6 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Wallet className="w-4 h-4 text-accent-glow" />
            <h2 className="text-sm font-bold uppercase tracking-tight text-text-primary font-headline">
              Consommation IA
            </h2>
          </div>
          <p className="mt-1 text-[11px] text-text-muted">
            {planLabel} · {fmtMonthLabel(data.period.month)}
          </p>
        </div>
        <StatusBadge tone={tone} />
      </div>

      {/* KPI strip 3 colonnes */}
      <div className="grid grid-cols-3 gap-3">
        <Kpi label="Budget" value={fmtEur(monthly)} accent />
        <Kpi label="Consommé" value={fmtEur(consumed)} />
        <Kpi
          label="Restant"
          value={fmtEur(remaining)}
          tone={remaining < 0 ? "danger" : "neutral"}
        />
      </div>

      {/* Barre de progression */}
      <div>
        <div className="w-full h-2 bg-surface-3 rounded-sm overflow-hidden">
          <div
            className={`h-full transition-all ${barColor}`}
            style={{ width: `${barWidth}%` }}
          />
        </div>
        <div className="flex justify-between mt-2 text-[10px] text-text-muted font-mono">
          <span>{percent.toFixed(2).replace(".", ",")}% utilisé</span>
          <span>
            seuils {soft}% / {hard}%
          </span>
        </div>
      </div>

      {/* Service tiers (Standard / Premium) */}
      {isOk && data.service_tiers.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {data.service_tiers.map((t) => (
            <span
              key={t.tier}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold uppercase tracking-tight border border-border-subtle bg-surface-2 text-text-secondary"
            >
              {t.tier === "premium" ? (
                <Sparkles className="w-3 h-3 text-accent-glow" />
              ) : (
                <Zap className="w-3 h-3 text-text-muted" />
              )}
              {t.label}
              <span className="font-mono normal-case text-text-muted ml-1">
                {fmtEur(t.consumed_eur)}
              </span>
            </span>
          ))}
        </div>
      )}

      {/* Bouton recharge — disabled jusqu'à UB-8 */}
      <div className="flex flex-col items-start gap-1.5">
        <button
          type="button"
          disabled
          aria-disabled="true"
          title="Disponible bientôt"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-tight border border-border-subtle text-text-muted bg-surface-2/40 cursor-not-allowed opacity-70"
        >
          <Wallet className="w-3 h-3" />
          Recharger mon budget IA
        </button>
        <span className="text-[10px] text-text-muted/70 italic">
          {rechargeEnabled ? "Disponible bientôt" : "Disponible bientôt — recharge non activée pour ce plan"}
        </span>
      </div>
    </section>
  );
}

function StatusBadge({ tone }: { tone: "ok" | "soft" | "high" | "hard" | "notconf" }) {
  if (tone === "notconf") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-1 text-[10px] font-bold uppercase tracking-tight border border-border-subtle text-text-muted bg-surface-2">
        <CircleHelp className="w-3 h-3" />
        Non configuré
      </span>
    );
  }
  if (tone === "hard") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-1 text-[10px] font-bold uppercase tracking-tight border border-status-danger/40 text-status-danger bg-status-danger/10">
        <CircleAlert className="w-3 h-3" />
        Limite atteinte
      </span>
    );
  }
  if (tone === "high") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-1 text-[10px] font-bold uppercase tracking-tight border border-amber-400/40 text-amber-300 bg-amber-400/10">
        <AlertTriangle className="w-3 h-3" />
        Usage élevé
      </span>
    );
  }
  if (tone === "soft") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-1 text-[10px] font-bold uppercase tracking-tight border border-amber-300/30 text-amber-200 bg-amber-300/5">
        <AlertTriangle className="w-3 h-3" />
        Seuil souple
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-1 text-[10px] font-bold uppercase tracking-tight border border-emerald-400/30 text-emerald-300 bg-emerald-400/10">
      <CheckCircle2 className="w-3 h-3" />
      Dans la cible
    </span>
  );
}

function Kpi({
  label,
  value,
  accent,
  tone,
}: {
  label: string;
  value: string;
  accent?: boolean;
  tone?: "neutral" | "danger";
}) {
  const colorClass =
    tone === "danger" ? "text-amber-300" : accent ? "text-accent-glow" : "text-text-primary";
  return (
    <div className="card-sharp-high p-4">
      <p className="text-[10px] uppercase tracking-wider text-text-muted">{label}</p>
      <p className={`text-lg font-headline font-extrabold mt-1.5 font-mono ${colorClass}`}>
        {value}
      </p>
    </div>
  );
}
