"use client";

// V1.1.D Phase 1 — Cockpit Affaires (= projects.lifecycle_stage='affaire').
//
// Source : /api/affaires (proxy → mybotia-business /api/v1/affaires).
// Doctrine : pas de mock, pas de fallback projets legacy ; si l'endpoint
// retourne vide → empty state actionnable. Si feature `pipeline` désactivée
// ou provider non câblé → FeatureDisabled / message explicite.

import { useMemo } from "react";
import Link from "next/link";
import { TrendingUp, Loader2, Briefcase, AlertTriangle } from "lucide-react";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { FeatureDisabled } from "@/components/shared/FeatureDisabled";
import {
  useAffaires,
  useCockpitFeatures,
  type AffaireItem,
} from "@/hooks/use-api";
import { cn } from "@/lib/utils";

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

function affaireTitle(a: AffaireItem): string {
  return a.title || a.name || "(sans titre)";
}

export default function AffairesPage() {
  const { data: cockpitFeatures, loading: featuresLoading } = useCockpitFeatures();
  const pipelineEnabled = cockpitFeatures?.features?.pipeline === true;

  const { data: affaires, loading, error } = useAffaires();

  const grouped = useMemo(() => {
    const out: Record<string, AffaireItem[]> = {};
    for (const a of affaires) {
      const key = a.status || "active";
      if (!out[key]) out[key] = [];
      out[key].push(a);
    }
    return out;
  }, [affaires]);

  if (!featuresLoading && cockpitFeatures && !pipelineEnabled) {
    return <FeatureDisabled featureKey="pipeline" tenantSlug={cockpitFeatures.tenant} />;
  }

  return (
    <div className="p-8 min-h-screen space-y-6">
      <ModuleHeader
        icon={Briefcase}
        title="Affaires"
        subtitle={
          loading
            ? "Chargement…"
            : `${affaires.length} affaire${affaires.length > 1 ? "s" : ""}`
        }
      />

      {error && (
        <div className="card-sharp p-5 flex items-start gap-3 text-sm border-amber-400/30 bg-amber-400/5 text-amber-200">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">Module Affaires non disponible</p>
            <p className="text-[12px] mt-1 text-amber-200/80">
              {error}. Si tu es superadmin, vérifie que le tenant est câblé sur{" "}
              <span className="font-mono">mybotia_business</span> et que le module{" "}
              <span className="font-mono">pipeline</span> est activé.
            </p>
          </div>
        </div>
      )}

      {loading && (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-accent-glow" />
        </div>
      )}

      {!loading && !error && affaires.length === 0 && (
        <div className="card-sharp p-10 text-center space-y-4">
          <div className="inline-flex items-center justify-center w-12 h-12 mx-auto bg-accent-primary/10 border border-accent-primary/30">
            <TrendingUp className="w-5 h-5 text-accent-glow" />
          </div>
          <h3 className="text-sm font-bold text-text-primary">
            Aucune affaire en cours
          </h3>
          <p className="text-[12px] text-text-muted leading-relaxed max-w-md mx-auto">
            Une affaire = un cycle commercial avant signature (lead, qualif,
            devis). Crée ta première affaire depuis la page Pipeline ou via la
            barre Léa.
          </p>
          <Link
            href="/pipeline"
            className="inline-block px-5 py-2 text-[11px] font-bold uppercase tracking-tight border border-accent-primary/30 bg-accent-primary/10 text-accent-glow hover:bg-accent-primary/20"
          >
            Ouvrir le pipeline
          </Link>
        </div>
      )}

      {!loading && !error && affaires.length > 0 && (
        <div className="space-y-6">
          {Object.entries(grouped).map(([stage, items]) => (
            <section key={stage} className="card-sharp p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold uppercase tracking-tight text-text-primary font-headline">
                  {STAGE_LABEL[stage] ?? stage}
                </h2>
                <span className="text-[10px] text-text-muted font-mono tabular-nums">
                  {items.length}
                </span>
              </div>
              <ul className="divide-y divide-border-subtle">
                {items.map((a) => (
                  <li key={a.id} className="py-2.5 flex items-center gap-3">
                    <span
                      className={cn(
                        "px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-tight border shrink-0",
                        STAGE_COLOR[a.status] ??
                          "bg-zinc-500/15 text-zinc-300 border-zinc-500/30",
                      )}
                    >
                      {STAGE_LABEL[a.status] ?? a.status}
                    </span>
                    <span className="text-sm text-text-primary flex-1 truncate">
                      {affaireTitle(a)}
                    </span>
                    {a.updatedAt && (
                      <span className="text-[10px] text-text-muted font-mono tabular-nums shrink-0">
                        {new Date(a.updatedAt).toLocaleDateString("fr-FR")}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
