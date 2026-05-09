"use client";

// V1.1.D Phase 1+2 — Cockpit Affaires (= projects.lifecycle_stage='affaire').
//
// Source : /api/affaires (proxy → mybotia-business /api/v1/affaires).
// Doctrine : pas de mock, pas de fallback projets legacy ; si l'endpoint
// retourne vide → empty state actionnable. Si feature `pipeline` désactivée
// ou provider non câblé → FeatureDisabled / message explicite.
//
// Phase 2 :
//   - Bouton "Nouvelle affaire" → CreateAffaireModal
//   - Filtres : stage (multi-select), recherche titre/client, tri
//   - Lien direct vers /affaires/[id] pour chaque ligne
//   - Mobile responsive (table → cards < 768px)

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  TrendingUp,
  Loader2,
  Briefcase,
  Plus,
  Search,
  ArrowUpDown,
} from "lucide-react";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { FeatureDisabled } from "@/components/shared/FeatureDisabled";
import { ErrorState } from "@/components/shared/ErrorState";
import { EmptyState } from "@/components/shared/EmptyState";
import { CreateAffaireModal } from "@/components/affaires/CreateAffaireModal";
import {
  useAffaires,
  useCockpitFeatures,
  useScopedClients,
  type AffaireItem,
} from "@/hooks/use-api";
import { cn } from "@/lib/utils";
import { formatDateFR, formatMoneyCompactFR } from "@/lib/format";

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

const STAGES_FILTERABLE = [
  "lead",
  "qualified",
  "active",
  "paused",
  "won",
  "lost",
  "abandoned",
] as const;

type SortKey = "created" | "due" | "potential";

// Le proxy retourne du snake_case (ProjectRow) mais AffaireItem laisse les
// champs en optional + index signature. On lit les deux formes possibles.
type AffaireRowLike = AffaireItem & {
  client_id?: string;
  due_date?: string | null;
  created_at?: string;
  updated_at?: string;
  oneshot_amount_ht?: string | number | null;
  mrr_ht?: string | number | null;
};

function affaireTitle(a: AffaireRowLike): string {
  return a.title || a.name || "(sans titre)";
}

function asNumber(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

export default function AffairesPage() {
  const { data: cockpitFeatures, loading: featuresLoading } =
    useCockpitFeatures();
  const pipelineEnabled = cockpitFeatures?.features?.pipeline === true;

  const { data: affaires, loading, error, refetch } = useAffaires();
  const { data: clients } = useScopedClients();

  const [createOpen, setCreateOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [stages, setStages] = useState<Set<string>>(new Set());
  const [sortKey, setSortKey] = useState<SortKey>("created");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const clientById = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of clients) {
      map.set(c.id, c.company || c.name || "");
    }
    return map;
  }, [clients]);

  const filtered = useMemo<AffaireRowLike[]>(() => {
    const rows = affaires as AffaireRowLike[];
    const q = search.trim().toLowerCase();

    const filteredRows = rows.filter((a) => {
      if (stages.size > 0 && !stages.has(a.status)) return false;
      if (q) {
        const title = affaireTitle(a).toLowerCase();
        const cid = a.client_id ?? a.clientId ?? "";
        const cname = (clientById.get(cid) ?? "").toLowerCase();
        if (!title.includes(q) && !cname.includes(q)) return false;
      }
      return true;
    });

    const dir = sortDir === "asc" ? 1 : -1;
    filteredRows.sort((a, b) => {
      if (sortKey === "created") {
        const av = a.created_at ?? a.createdAt ?? "";
        const bv = b.created_at ?? b.createdAt ?? "";
        return av.localeCompare(bv) * dir;
      }
      if (sortKey === "due") {
        const av = a.due_date ?? "";
        const bv = b.due_date ?? "";
        return av.localeCompare(bv) * dir;
      }
      // potential = oneshot + mrr*12
      const av = asNumber(a.oneshot_amount_ht) + asNumber(a.mrr_ht) * 12;
      const bv = asNumber(b.oneshot_amount_ht) + asNumber(b.mrr_ht) * 12;
      return (av - bv) * dir;
    });

    return filteredRows;
  }, [affaires, search, stages, sortKey, sortDir, clientById]);

  function toggleStage(stage: string) {
    setStages((prev) => {
      const next = new Set(prev);
      if (next.has(stage)) next.delete(stage);
      else next.add(stage);
      return next;
    });
  }

  function toggleSort(k: SortKey) {
    if (sortKey === k) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(k);
      setSortDir("desc");
    }
  }

  if (!featuresLoading && cockpitFeatures && !pipelineEnabled) {
    return (
      <FeatureDisabled
        featureKey="pipeline"
        tenantSlug={cockpitFeatures.tenant}
      />
    );
  }

  return (
    <div className="p-4 sm:p-8 min-h-screen space-y-6">
      <ModuleHeader
        icon={Briefcase}
        title="Affaires"
        subtitle={
          loading
            ? "Chargement…"
            : `${affaires.length} affaire${affaires.length > 1 ? "s" : ""} · ${filtered.length} affichée${filtered.length > 1 ? "s" : ""}`
        }
        actions={
          <button
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-accent-primary text-white text-[11px] font-bold uppercase tracking-wider hover:bg-accent-primary/80 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Nouvelle affaire</span>
          </button>
        }
      />

      {error && (
        <ErrorState
          title="Module Affaires non disponible"
          message={`${error}. Si tu es superadmin, vérifie que le tenant est câblé sur 'mybotia_business' et que le module 'pipeline' est activé.`}
          onRetry={refetch}
        />
      )}

      {/* Filtres + recherche */}
      {!error && (
        <div className="card-sharp p-4 space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted pointer-events-none" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-surface-2 border border-border-subtle text-sm py-2 pl-8 pr-3 text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent-primary/40"
                placeholder="Rechercher par titre ou client…"
                aria-label="Rechercher"
              />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] uppercase tracking-wider text-text-muted">
                Trier :
              </span>
              <button
                onClick={() => toggleSort("created")}
                className={cn(
                  "inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] uppercase tracking-tight border",
                  sortKey === "created"
                    ? "border-accent-primary/40 bg-accent-primary/10 text-accent-glow"
                    : "border-border-subtle text-text-muted hover:text-text-primary",
                )}
              >
                Création
                {sortKey === "created" && <ArrowUpDown className="w-3 h-3" />}
              </button>
              <button
                onClick={() => toggleSort("due")}
                className={cn(
                  "inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] uppercase tracking-tight border",
                  sortKey === "due"
                    ? "border-accent-primary/40 bg-accent-primary/10 text-accent-glow"
                    : "border-border-subtle text-text-muted hover:text-text-primary",
                )}
              >
                Date close
                {sortKey === "due" && <ArrowUpDown className="w-3 h-3" />}
              </button>
              <button
                onClick={() => toggleSort("potential")}
                className={cn(
                  "inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] uppercase tracking-tight border",
                  sortKey === "potential"
                    ? "border-accent-primary/40 bg-accent-primary/10 text-accent-glow"
                    : "border-border-subtle text-text-muted hover:text-text-primary",
                )}
              >
                Potentiel
                {sortKey === "potential" && <ArrowUpDown className="w-3 h-3" />}
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <span className="text-[10px] uppercase tracking-wider text-text-muted self-center mr-2">
              Stage :
            </span>
            {STAGES_FILTERABLE.map((s) => (
              <button
                key={s}
                onClick={() => toggleStage(s)}
                className={cn(
                  "px-2 py-0.5 text-[10px] uppercase tracking-tight border transition-colors",
                  stages.has(s)
                    ? STAGE_COLOR[s]
                    : "border-border-subtle text-text-muted hover:text-text-primary",
                )}
              >
                {STAGE_LABEL[s] ?? s}
              </button>
            ))}
            {stages.size > 0 && (
              <button
                onClick={() => setStages(new Set())}
                className="px-2 py-0.5 text-[10px] uppercase tracking-tight text-text-muted hover:text-text-primary"
              >
                Tout effacer
              </button>
            )}
          </div>
        </div>
      )}

      {loading && (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-accent-glow" />
        </div>
      )}

      {!loading && !error && affaires.length === 0 && (
        <EmptyState
          icon={TrendingUp}
          title="Aucune affaire en cours"
          description="Une affaire = un cycle commercial avant signature (lead, qualif, devis). Créez votre première affaire dès maintenant."
          action={
            <button
              onClick={() => setCreateOpen(true)}
              className="inline-flex items-center gap-1.5 px-5 py-2 text-[11px] font-bold uppercase tracking-tight border border-accent-primary/30 bg-accent-primary/10 text-accent-glow hover:bg-accent-primary/20"
            >
              <Plus className="w-3.5 h-3.5" />
              Nouvelle affaire
            </button>
          }
        />
      )}

      {!loading && !error && affaires.length > 0 && filtered.length === 0 && (
        <div className="card-sharp p-8 text-center">
          <p className="text-sm text-text-muted">
            Aucune affaire ne correspond à ces filtres.
          </p>
        </div>
      )}

      {!loading && !error && filtered.length > 0 && (
        <>
          {/* Desktop : table */}
          <div className="hidden md:block card-sharp p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-text-muted border-b border-border-subtle">
                  <th className="text-left font-bold py-3 px-4">Stage</th>
                  <th className="text-left font-bold py-3 px-4">Titre</th>
                  <th className="text-left font-bold py-3 px-4">Client</th>
                  <th className="text-right font-bold py-3 px-4">Potentiel</th>
                  <th className="text-right font-bold py-3 px-4">Date close</th>
                  <th className="text-right font-bold py-3 px-4">Création</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {filtered.map((a) => {
                  const cid = a.client_id ?? a.clientId ?? "";
                  const cname = clientById.get(cid) ?? "—";
                  const potential =
                    asNumber(a.oneshot_amount_ht) + asNumber(a.mrr_ht) * 12;
                  return (
                    <tr
                      key={a.id}
                      className="hover:bg-surface-2 transition-colors"
                    >
                      <td className="py-3 px-4">
                        <span
                          className={cn(
                            "px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-tight border",
                            STAGE_COLOR[a.status] ??
                              "bg-zinc-500/15 text-zinc-300 border-zinc-500/30",
                          )}
                        >
                          {STAGE_LABEL[a.status] ?? a.status}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <Link
                          href={`/affaires/${a.id}`}
                          className="text-text-primary hover:text-accent-glow font-medium"
                        >
                          {affaireTitle(a)}
                        </Link>
                      </td>
                      <td className="py-3 px-4 text-text-muted truncate max-w-[200px]">
                        {cname}
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums text-text-primary">
                        {potential > 0 ? formatMoneyCompactFR(potential) : "—"}
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums text-text-muted">
                        {formatDateFR(a.due_date)}
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums text-text-muted">
                        {formatDateFR(a.created_at ?? a.createdAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile : cards */}
          <ul className="md:hidden space-y-2">
            {filtered.map((a) => {
              const cid = a.client_id ?? a.clientId ?? "";
              const cname = clientById.get(cid) ?? "—";
              const potential =
                asNumber(a.oneshot_amount_ht) + asNumber(a.mrr_ht) * 12;
              return (
                <li key={a.id}>
                  <Link
                    href={`/affaires/${a.id}`}
                    className="card-sharp block p-3 hover:bg-surface-2 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span
                        className={cn(
                          "px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-tight border shrink-0",
                          STAGE_COLOR[a.status] ??
                            "bg-zinc-500/15 text-zinc-300 border-zinc-500/30",
                        )}
                      >
                        {STAGE_LABEL[a.status] ?? a.status}
                      </span>
                      <span className="text-[10px] text-text-muted tabular-nums">
                        {formatDateFR(a.created_at ?? a.createdAt)}
                      </span>
                    </div>
                    <div className="font-medium text-text-primary truncate">
                      {affaireTitle(a)}
                    </div>
                    <div className="flex items-center justify-between mt-1 text-xs">
                      <span className="text-text-muted truncate">{cname}</span>
                      {potential > 0 && (
                        <span className="tabular-nums text-text-primary">
                          {formatMoneyCompactFR(potential)}
                        </span>
                      )}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </>
      )}

      <CreateAffaireModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => refetch()}
      />
    </div>
  );
}
