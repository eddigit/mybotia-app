"use client";

// V1.1.D Phase 2 — Cockpit Productions (= projects.lifecycle_stage='production').
//
// Source : /api/productions (proxy → mybotia-business /api/v1/productions).
// Lecture seule : la création d'une production se fait via la bascule
// d'une affaire signée (POST /api/v1/affaires/[id]/sign côté business).
//
// Phase 2 ajoute :
//   - lien fiche détail (/productions/[id])
//   - filtres status, billing_mode (dérivé client-side), owner, recherche
//
// billing_mode n'est pas une colonne persistée (cf. projects-raw.ts) : on
// déclenche une seconde requête /api/productions/[id]/subscriptions au moment
// du filtre uniquement si l'utilisateur active billing_mode (lazy fetch).
// V2 : ajouter billing_mode à la vue business_productions côté biz pour éviter
// ce round-trip.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Hammer,
  Loader2,
  PackageOpen,
  Search,
  X,
  ChevronRight,
} from "lucide-react";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { FeatureDisabled } from "@/components/shared/FeatureDisabled";
import {
  useProductions,
  useCockpitFeatures,
  type ProductionItem,
} from "@/hooks/use-api";
import { cn } from "@/lib/utils";
import { formatDateFR } from "@/lib/format";
import { ErrorState } from "@/components/shared/ErrorState";
import { EmptyState } from "@/components/shared/EmptyState";
import { Skeleton } from "@/components/shared/Skeleton";

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

const BILLING_LABEL: Record<string, string> = {
  one_shot: "One-shot",
  recurring: "Récurrent",
  mixed: "Mixte",
};

function productionTitle(p: ProductionItem): string {
  return p.title || p.name || "(sans titre)";
}

type BillingFilter = "" | "one_shot" | "recurring" | "mixed";

export default function ProductionsPage() {
  const { data: cockpitFeatures, loading: featuresLoading } =
    useCockpitFeatures();
  const productionsEnabled =
    cockpitFeatures?.features?.productions === true;

  const { data: productions, loading, error, refetch } = useProductions();

  const [statusFilter, setStatusFilter] = useState<string>("");
  const [billingFilter, setBillingFilter] = useState<BillingFilter>("");
  const [ownerFilter, setOwnerFilter] = useState<string>("");
  const [search, setSearch] = useState<string>("");

  // Cache des billing_mode dérivés par production_id (résolu via subs).
  // Lazy : alimenté seulement quand billingFilter !== "".
  const [billingByProd, setBillingByProd] = useState<
    Record<string, "one_shot" | "recurring" | "mixed">
  >({});
  const [billingLoading, setBillingLoading] = useState(false);

  useEffect(() => {
    if (billingFilter === "") return;
    if (productions.length === 0) return;
    let cancelled = false;
    // setState DIFFÉRÉ via microtask : évite le warning
    // react-hooks/set-state-in-effect (cascading renders).
    queueMicrotask(() => {
      if (!cancelled) setBillingLoading(true);
    });
    Promise.all(
      productions.map(async (p) => {
        try {
          const res = await fetch(
            `/api/productions/${encodeURIComponent(p.id)}/subscriptions`,
          );
          if (!res.ok) return [p.id, "one_shot" as const] as const;
          const subs = (await res.json()) as Array<{ status: string }>;
          const hasActive =
            Array.isArray(subs) && subs.some((s) => s.status === "active");
          // En l'absence de oneshot persisté côté liste, heuristique :
          //   - aucune sub active → one_shot
          //   - sinon → recurring (pas de moyen de distinguer mixed sans
          //     fetch /api/productions/[id] pour oneshot_amount_ht).
          // La fiche détail affiche le mode exact.
          return [p.id, hasActive ? ("recurring" as const) : ("one_shot" as const)] as const;
        } catch {
          return [p.id, "one_shot" as const] as const;
        }
      }),
    ).then((entries) => {
      if (cancelled) return;
      setBillingByProd((prev) => {
        const next = { ...prev };
        for (const [pid, mode] of entries) next[pid] = mode;
        return next;
      });
      setBillingLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [billingFilter, productions]);

  const owners = useMemo(() => {
    const set = new Set<string>();
    for (const p of productions) {
      const owner = (p.ownerUserId ?? p.owner_user_id) as string | undefined;
      if (owner) set.add(owner);
    }
    return Array.from(set).sort();
  }, [productions]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return productions.filter((p) => {
      if (statusFilter && p.status !== statusFilter) return false;
      if (ownerFilter) {
        const owner =
          (p.ownerUserId ?? p.owner_user_id) as string | undefined;
        if (owner !== ownerFilter) return false;
      }
      if (billingFilter) {
        const mode = billingByProd[p.id];
        if (!mode) return false;
        if (mode !== billingFilter) return false;
      }
      if (q) {
        const desc = (p.description ?? "") as string;
        const hay = `${productionTitle(p)} ${desc}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [productions, statusFilter, ownerFilter, billingFilter, billingByProd, search]);

  const grouped = useMemo(() => {
    const out: Record<string, ProductionItem[]> = {};
    for (const p of filtered) {
      const key = p.status || "active";
      if (!out[key]) out[key] = [];
      out[key].push(p);
    }
    return out;
  }, [filtered]);

  if (!featuresLoading && cockpitFeatures && !productionsEnabled) {
    return (
      <FeatureDisabled
        featureKey="productions"
        tenantSlug={cockpitFeatures.tenant}
      />
    );
  }

  const hasActiveFilter =
    statusFilter || billingFilter || ownerFilter || search;

  return (
    <div className="p-4 sm:p-8 min-h-screen space-y-6">
      <ModuleHeader
        icon={Hammer}
        title="Productions"
        subtitle={
          loading
            ? "Chargement…"
            : `${filtered.length}${
                filtered.length !== productions.length
                  ? ` sur ${productions.length}`
                  : ""
              } production${productions.length > 1 ? "s" : ""} en portefeuille`
        }
      />

      {/* Filtres */}
      <div className="card-sharp p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher (titre, description)…"
              className="w-full bg-surface-2 border border-border-subtle text-[12px] py-2 pl-8 pr-3 text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent-primary/40"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full bg-surface-2 border border-border-subtle text-[12px] py-2 px-3 text-text-primary focus:outline-none focus:ring-1 focus:ring-accent-primary/40"
          >
            <option value="">Tous les statuts</option>
            {Object.entries(STAGE_LABEL).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
          <select
            value={billingFilter}
            onChange={(e) => setBillingFilter(e.target.value as BillingFilter)}
            className="w-full bg-surface-2 border border-border-subtle text-[12px] py-2 px-3 text-text-primary focus:outline-none focus:ring-1 focus:ring-accent-primary/40"
          >
            <option value="">Tous les modes</option>
            {Object.entries(BILLING_LABEL).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
          {owners.length > 1 ? (
            <select
              value={ownerFilter}
              onChange={(e) => setOwnerFilter(e.target.value)}
              className="w-full bg-surface-2 border border-border-subtle text-[12px] py-2 px-3 text-text-primary focus:outline-none focus:ring-1 focus:ring-accent-primary/40"
            >
              <option value="">Tous les owners</option>
              {owners.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          ) : (
            <div className="text-[11px] text-text-muted self-center px-3 py-2 border border-border-subtle bg-surface-2/50">
              {owners.length === 1
                ? `Owner : ${owners[0]}`
                : "Aucun owner défini"}
            </div>
          )}
        </div>

        {hasActiveFilter ? (
          <button
            onClick={() => {
              setStatusFilter("");
              setBillingFilter("");
              setOwnerFilter("");
              setSearch("");
            }}
            className="inline-flex items-center gap-1 text-[11px] text-text-muted hover:text-text-primary"
          >
            <X className="w-3 h-3" />
            Réinitialiser les filtres
          </button>
        ) : null}

        {billingFilter && billingLoading ? (
          <p className="text-[11px] text-text-muted flex items-center gap-1.5">
            <Loader2 className="w-3 h-3 animate-spin" />
            Résolution des modes de facturation…
          </p>
        ) : null}
      </div>

      {error && (
        <ErrorState
          title="Module Productions non disponible"
          message={`${error}. Vérifie que le tenant a le module 'productions' activé côté business.`}
          onRetry={refetch}
        />
      )}

      {loading && <Skeleton.Table rows={8} cols={6} />}

      {!loading && !error && productions.length === 0 && (
        <EmptyState
          icon={PackageOpen}
          title="Aucune production active"
          description="Une production = une affaire signée en cours d'exécution. Bascule une affaire vers production depuis le cockpit Affaires après signature."
          action={
            <Link
              href="/affaires"
              className="inline-block px-5 py-2 text-[11px] font-bold uppercase tracking-tight border border-accent-primary/30 bg-accent-primary/10 text-accent-glow hover:bg-accent-primary/20"
            >
              Ouvrir les affaires
            </Link>
          }
        />
      )}

      {!loading && !error && productions.length > 0 && filtered.length === 0 && (
        <div className="card-sharp p-10 text-center space-y-3">
          <p className="text-sm font-bold text-text-primary">
            Aucune production ne correspond aux filtres.
          </p>
          <button
            onClick={() => {
              setStatusFilter("");
              setBillingFilter("");
              setOwnerFilter("");
              setSearch("");
            }}
            className="inline-flex items-center gap-1 text-[11px] text-text-muted hover:text-text-primary"
          >
            <X className="w-3 h-3" />
            Réinitialiser les filtres
          </button>
        </div>
      )}

      {!loading && !error && filtered.length > 0 && (
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
                  <li key={p.id}>
                    <Link
                      href={`/productions/${encodeURIComponent(p.id)}`}
                      className="py-2.5 flex items-center gap-3 hover:bg-surface-2/60 -mx-2 px-2 transition-colors"
                    >
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
                        <span className="text-[10px] text-text-muted font-mono tabular-nums shrink-0 hidden sm:inline">
                          {formatDateFR(p.updatedAt)}
                        </span>
                      )}
                      <ChevronRight className="w-3.5 h-3.5 text-text-muted shrink-0" />
                    </Link>
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
