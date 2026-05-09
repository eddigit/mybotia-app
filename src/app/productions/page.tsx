"use client";

// V1.1.D Phase 1 — Cockpit Productions (= projects.lifecycle_stage='production').
//
// Source : /api/productions (proxy → mybotia-business /api/v1/productions).
// Lecture seule : la création d'une production se fait via la bascule
// d'une affaire signée (POST /api/v1/affaires/[id]/sign côté business).

import { useMemo } from "react";
import { Hammer, Loader2, AlertTriangle, PackageOpen } from "lucide-react";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { FeatureDisabled } from "@/components/shared/FeatureDisabled";
import {
  useProductions,
  useCockpitFeatures,
  type ProductionItem,
} from "@/hooks/use-api";
import { cn } from "@/lib/utils";

const STAGE_LABEL: Record<string, string> = {
  active: "En cours",
  paused: "En pause",
  done: "Livré",
  cancelled: "Annulé",
  abandoned: "Abandonné",
};

const STAGE_COLOR: Record<string, string> = {
  active: "bg-accent-primary/15 text-accent-glow border-accent-primary/30",
  paused: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  done: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  cancelled: "bg-rose-500/15 text-rose-300 border-rose-500/30",
  abandoned: "bg-zinc-500/15 text-zinc-300 border-zinc-500/30",
};

function productionTitle(p: ProductionItem): string {
  return p.title || p.name || "(sans titre)";
}

export default function ProductionsPage() {
  const { data: cockpitFeatures, loading: featuresLoading } = useCockpitFeatures();
  const productionsEnabled = cockpitFeatures?.features?.productions === true;

  const { data: productions, loading, error } = useProductions();

  const grouped = useMemo(() => {
    const out: Record<string, ProductionItem[]> = {};
    for (const p of productions) {
      const key = p.status || "active";
      if (!out[key]) out[key] = [];
      out[key].push(p);
    }
    return out;
  }, [productions]);

  if (!featuresLoading && cockpitFeatures && !productionsEnabled) {
    return (
      <FeatureDisabled
        featureKey="productions"
        tenantSlug={cockpitFeatures.tenant}
      />
    );
  }

  return (
    <div className="p-8 min-h-screen space-y-6">
      <ModuleHeader
        icon={Hammer}
        title="Productions"
        subtitle={
          loading
            ? "Chargement…"
            : `${productions.length} production${productions.length > 1 ? "s" : ""} en portefeuille`
        }
      />

      {error && (
        <div className="card-sharp p-5 flex items-start gap-3 text-sm border-amber-400/30 bg-amber-400/5 text-amber-200">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">Module Productions non disponible</p>
            <p className="text-[12px] mt-1 text-amber-200/80">
              {error}. Vérifie que le tenant a le module{" "}
              <span className="font-mono">productions</span> activé côté business.
            </p>
          </div>
        </div>
      )}

      {loading && (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-accent-glow" />
        </div>
      )}

      {!loading && !error && productions.length === 0 && (
        <div className="card-sharp p-10 text-center space-y-4">
          <div className="inline-flex items-center justify-center w-12 h-12 mx-auto bg-accent-primary/10 border border-accent-primary/30">
            <PackageOpen className="w-5 h-5 text-accent-glow" />
          </div>
          <h3 className="text-sm font-bold text-text-primary">
            Aucune production active
          </h3>
          <p className="text-[12px] text-text-muted leading-relaxed max-w-md mx-auto">
            Une production = une affaire signée en cours d&apos;exécution.
            Bascule une affaire vers production depuis le cockpit Affaires
            (page <span className="font-mono">/affaires</span>) après signature.
          </p>
        </div>
      )}

      {!loading && !error && productions.length > 0 && (
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
                {items.map((p) => (
                  <li key={p.id} className="py-2.5 flex items-center gap-3">
                    <span
                      className={cn(
                        "px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-tight border shrink-0",
                        STAGE_COLOR[p.status] ??
                          "bg-zinc-500/15 text-zinc-300 border-zinc-500/30",
                      )}
                    >
                      {STAGE_LABEL[p.status] ?? p.status}
                    </span>
                    <span className="text-sm text-text-primary flex-1 truncate">
                      {productionTitle(p)}
                    </span>
                    {p.updatedAt && (
                      <span className="text-[10px] text-text-muted font-mono tabular-nums shrink-0">
                        {new Date(p.updatedAt).toLocaleDateString("fr-FR")}
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
