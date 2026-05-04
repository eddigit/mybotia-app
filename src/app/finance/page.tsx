"use client";

// Bloc 6C — Page Finance KPI MyBotIA, lecture seule.
// Doctrine : aucun chiffre inventé. Sources non fiables → "à configurer".

import {
  Wallet,
  TrendingUp,
  Receipt,
  Coins,
  Building2,
  AlertTriangle,
  CheckCircle2,
  Clock,
  XCircle,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { FeatureDisabled } from "@/components/shared/FeatureDisabled";
import {
  useCockpitFeatures,
  useFinanceKpis,
  type FinanceKpi,
  type FinanceKpiSection,
  type KpiStatus,
} from "@/hooks/use-api";
import { cn } from "@/lib/utils";

const SECTION_ICON: Record<string, typeof Wallet> = {
  synthesis: Building2,
  oneshot: Wallet,
  recurring: TrendingUp,
  tokens: Coins,
  activity: Building2,
  billing: Receipt,
  reference: Wallet,
};

const STATUS_STYLE: Record<
  KpiStatus,
  { label: string; chipClass: string; Icon: typeof CheckCircle2 }
> = {
  ready: {
    label: "ready",
    chipClass: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    Icon: CheckCircle2,
  },
  partial: {
    label: "réf.",
    chipClass: "bg-blue-500/15 text-blue-300 border-blue-500/30",
    Icon: Clock,
  },
  to_configure: {
    label: "à configurer",
    chipClass: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    Icon: AlertTriangle,
  },
  error: {
    label: "erreur",
    chipClass: "bg-red-500/15 text-red-300 border-red-500/30",
    Icon: XCircle,
  },
};

function formatValue(kpi: FinanceKpi, currency: string): string {
  if (kpi.value === null || kpi.value === undefined) return "—";
  if (typeof kpi.value === "string") return kpi.value;
  if (kpi.unit === "EUR" || kpi.unit === currency) {
    return `${Number(kpi.value).toLocaleString("fr-FR")} ${currency}`;
  }
  if (kpi.unit === "count") {
    return Number(kpi.value).toLocaleString("fr-FR");
  }
  if (kpi.unit === "tokens") {
    return Number(kpi.value).toLocaleString("fr-FR") + " tk";
  }
  return String(kpi.value);
}

function KpiCard({ kpi, currency }: { kpi: FinanceKpi; currency: string }) {
  const style = STATUS_STYLE[kpi.status];
  const Icon = style.Icon;
  return (
    <div className="card-sharp-high p-4 flex flex-col gap-2 min-h-[110px]">
      <div className="flex items-start justify-between gap-2">
        <span className="micro-label text-text-muted leading-tight">
          {kpi.label}
        </span>
        <span
          className={cn(
            "inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-tight border shrink-0",
            style.chipClass
          )}
        >
          <Icon className="w-2.5 h-2.5" />
          {style.label}
        </span>
      </div>
      <p
        className={cn(
          "text-xl font-headline font-extrabold leading-tight",
          kpi.status === "to_configure" || kpi.value === null
            ? "text-text-muted"
            : "text-text-primary"
        )}
      >
        {formatValue(kpi, currency)}
      </p>
      {kpi.note && (
        <p className="text-[10px] text-text-muted italic mt-auto">{kpi.note}</p>
      )}
    </div>
  );
}

function Section({
  section,
  currency,
}: {
  section: FinanceKpiSection;
  currency: string;
}) {
  const Icon = SECTION_ICON[section.id] || Wallet;
  return (
    <section className="card-sharp p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-accent-glow" />
          <h2 className="text-sm font-bold uppercase tracking-tight text-text-primary font-headline">
            {section.title}
          </h2>
        </div>
        <span className="micro-label text-text-muted font-mono">
          {section.kpis.length}
        </span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {section.kpis.map((kpi) => (
          <KpiCard key={kpi.id} kpi={kpi} currency={currency} />
        ))}
      </div>
    </section>
  );
}

export default function FinancePage() {
  // Bloc 6B-final — feature gate
  const { data: cockpitFeatures, loading: featuresLoading } = useCockpitFeatures();
  const financeEnabled = cockpitFeatures?.features?.finance === true;

  const { data, loading, error, refetch } = useFinanceKpis();

  if (!featuresLoading && cockpitFeatures && !financeEnabled) {
    return <FeatureDisabled featureKey="finance" tenantSlug={cockpitFeatures.tenant} />;
  }

  if (loading) {
    return (
      <div className="p-8 min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-accent-glow" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8 min-h-screen space-y-4">
        <ModuleHeader
          icon={Wallet}
          title="Finances"
          subtitle="KPI lecture seule"
        />
        <div className="card-sharp p-6 text-sm text-status-danger flex items-start gap-2">
          <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            Erreur chargement KPI : {error || "réponse vide"}.
            <button
              onClick={refetch}
              className="ml-2 inline-flex items-center gap-1 text-accent-glow hover:underline"
            >
              <RefreshCw className="w-3 h-3" />
              Réessayer
            </button>
          </span>
        </div>
      </div>
    );
  }

  const dolibarrError = data.sources.dolibarr === "error";

  return (
    <div className="p-8 min-h-screen space-y-6">
      <ModuleHeader
        icon={Wallet}
        title="Finances"
        subtitle={`Cockpit ${data.displayName || data.tenant} · devise ${data.currency}`}
        actions={
          <button
            onClick={refetch}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-tight border border-border-subtle text-text-muted hover:text-text-primary hover:border-accent-primary/30"
          >
            <RefreshCw className="w-3 h-3" />
            Actualiser
          </button>
        }
      />

      {/* Bandeau sources */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <SourceChip
          label="Source Dolibarr"
          status={data.sources.dolibarr}
          okLabel="ok"
          ko="error"
        />
        <SourceChip
          label="Source mybotia_core"
          status={data.sources.core}
          okLabel="ok"
          ko="error"
        />
        <SourceChip
          label="Modèle économique"
          status={data.sources.businessModel === "ok" ? "ok" : "error"}
          okLabel="configuré"
          ko="missing"
          missingLabel="à configurer"
        />
      </div>

      {dolibarrError && (
        <div className="flex items-start gap-2 p-3 border border-amber-400/30 bg-amber-400/10 text-[11px] text-amber-300">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>
            Source Dolibarr indisponible — les KPI commerciaux affichent{" "}
            <span className="font-mono">erreur</span>. Le reste du cockpit
            n&apos;est pas affecté.
          </span>
        </div>
      )}

      {data.sections.map((section) => (
        <Section key={section.id} section={section} currency={data.currency} />
      ))}

      <p className="text-[10px] text-text-muted italic text-center pt-4">
        KPI générés à {new Date(data.generatedAt).toLocaleTimeString("fr-FR")} ·
        Sources fiables uniquement · MRR/ARR/tokens à configurer
      </p>
    </div>
  );
}

function SourceChip({
  label,
  status,
  okLabel,
  ko,
  missingLabel,
}: {
  label: string;
  status: string;
  okLabel: string;
  ko: string;
  missingLabel?: string;
}) {
  const isOk = status === "ok";
  const isMissing = !isOk && status === ko;
  return (
    <div
      className={cn(
        "flex items-center justify-between p-3 border text-xs",
        isOk
          ? "bg-emerald-500/5 text-emerald-300 border-emerald-500/30"
          : "bg-amber-500/5 text-amber-300 border-amber-500/30"
      )}
    >
      <span className="micro-label">{label}</span>
      <span className="inline-flex items-center gap-1 font-bold">
        {isOk ? (
          <CheckCircle2 className="w-3 h-3" />
        ) : (
          <AlertTriangle className="w-3 h-3" />
        )}
        {isOk ? okLabel : isMissing && missingLabel ? missingLabel : status}
      </span>
    </div>
  );
}
