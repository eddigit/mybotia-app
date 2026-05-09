"use client";

// V1.1.B Phase 3C — Projects Command Center.
// V1.1.C — lexique FR aligné : UI parle d'"affaires" (le code reste "project").
//
// /pipeline = vue affaires pilotables pour une agence digitale.
// Source : /api/projects (provider business pour tenant mybotia).
// Pas d'agrégation Dolibarr, pas de mock — si la liste est vide, empty state
// avec CTA "Créer une affaire".
//
// Mapping colonnes :
// - DB business expose seulement active|paused|done|cancelled.
// - On enrichit la colonne via une heuristique basée sur `nextAction`
//   (mots-clés FR : devis, cadrage, recette, livr*, bloqu*, attente client,
//   maintenance) pour offrir un Pipeline business-first dès aujourd'hui.
// - Si `nextAction` ne matche aucun bucket : affaire placée dans "En cours".
// - Status DB "paused" → "En attente client".
// - Status DB "done" → "Livré".
// - Status DB "cancelled" → "Bloqué" (NB: business ne renvoie pas cancelled
//   pour tenant mybotia, gardé par sécurité).
//
// Au fur et à mesure que la DB s'enrichit (workflow_step, etc.), le mapping
// se précisera côté serveur sans toucher cette UI.

import { useMemo, useState } from "react";
import {
  TrendingUp,
  Plus,
  FolderPlus,
  Loader2,
} from "lucide-react";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { btnPrimary } from "@/components/shared/FormModal";
import { ProjectCard } from "@/components/crm/ProjectCard";
import { ProjectDetailPanel } from "@/components/crm/ProjectDetailPanel";
import { CreateProjectModal } from "@/components/shared/CreateProjectModal";
import { FeatureDisabled } from "@/components/shared/FeatureDisabled";
import { useScopedProjects, useCockpitFeatures } from "@/hooks/use-api";
import type { Project } from "@/types";

const TENANT_SLUG = "mybotia";

type ColumnKey =
  | "cadrage"
  | "devis"
  | "en_cours"
  | "attente_client"
  | "recette"
  | "livre"
  | "maintenance"
  | "bloque";

const COLUMNS: Array<{
  key: ColumnKey;
  label: string;
  hint: string;
  className: string;
}> = [
  {
    key: "cadrage",
    label: "Cadrage",
    hint: "Brief, audit, kickoff",
    className: "border-t-blue-400/40",
  },
  {
    key: "devis",
    label: "Devis",
    hint: "Devis envoyé, en attente acompte",
    className: "border-t-violet-400/40",
  },
  {
    key: "en_cours",
    label: "En cours",
    hint: "Dev / design / contenu actif",
    className: "border-t-accent-primary/60",
  },
  {
    key: "attente_client",
    label: "Attente client",
    hint: "En pause / retour client requis",
    className: "border-t-amber-400/40",
  },
  {
    key: "recette",
    label: "Recette",
    hint: "Validation / tests client",
    className: "border-t-cyan-400/40",
  },
  {
    key: "livre",
    label: "Livré",
    hint: "Mise en prod terminée",
    className: "border-t-emerald-400/40",
  },
  {
    key: "maintenance",
    label: "Maintenance",
    hint: "Support / TMA en cours",
    className: "border-t-teal-400/40",
  },
  {
    key: "bloque",
    label: "Bloqué",
    hint: "À débloquer en priorité",
    className: "border-t-rose-400/40",
  },
];

/**
 * Heuristique de classement pipeline.
 * Combine status DB + mots-clés nextAction (FR, insensible casse).
 * Doctrine "pas de mock" : si rien ne matche, on met "en_cours" plutôt que
 * de fabriquer un statut inexistant.
 */
function classifyProject(p: Project): ColumnKey {
  const next = (p.nextAction || "").toLowerCase();
  const desc = (p.description || "").toLowerCase();
  const text = `${next} ${desc}`;

  // Status DB explicites en premier
  if (p.status === "completed") return "livre";
  if (p.status === "paused") return "attente_client";

  // Heuristique mots-clés (ordre = priorité de classement)
  if (/\bbloqu/.test(text)) return "bloque";
  if (/\b(maint|tma|support|astreinte)/.test(text)) return "maintenance";
  if (/\b(livr|prod\b|déploiement final|mise en prod|mise en ligne)/.test(text)) return "livre";
  if (/\b(recette|valid|qa|tests? client)/.test(text)) return "recette";
  if (/\b(attente client|retour client|relance client|en attente)/.test(text)) return "attente_client";
  if (/\b(devis|acompte|propos)/.test(text)) return "devis";
  if (/\b(brief|audit|cadrage|kickoff|scope|découverte|specs?)/.test(text)) return "cadrage";

  return "en_cours";
}

export default function PipelinePage() {
  const { data: cockpitFeatures, loading: featuresLoading } = useCockpitFeatures();
  const pipelineEnabled = cockpitFeatures?.features?.pipeline === true;

  const { data: projects, loading: projectsLoading, refetch } = useScopedProjects();
  const [selected, setSelected] = useState<Project | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  // Filtre tenant défensif (ceinture+bretelles, le serveur scope déjà via Host)
  const safeProjects = useMemo(
    () => projects.filter((p) => !p.tenantSlug || p.tenantSlug === TENANT_SLUG),
    [projects],
  );

  // Liste affichée : on exclut les affaires terminées depuis > 90j pour ne pas
  // saturer la colonne Livré (mais ils restent visibles via la fiche client).
  const visibleProjects = useMemo(() => {
    const ninetyDaysAgo = Date.now() - 90 * 86400000;
    return safeProjects.filter((p) => {
      if (p.status !== "completed") return true;
      if (!p.dueDate) return true;
      const t = new Date(p.dueDate).getTime();
      return Number.isNaN(t) || t > ninetyDaysAgo;
    });
  }, [safeProjects]);

  const grouped = useMemo(() => {
    const buckets: Record<ColumnKey, Project[]> = {
      cadrage: [],
      devis: [],
      en_cours: [],
      attente_client: [],
      recette: [],
      livre: [],
      maintenance: [],
      bloque: [],
    };
    for (const p of visibleProjects) {
      buckets[classifyProject(p)].push(p);
    }
    // Tri intra-colonne : VIP/haute priorité d'abord, puis par due date
    for (const k of Object.keys(buckets) as ColumnKey[]) {
      buckets[k].sort((a, b) => {
        const pa = a.priority?.toLowerCase();
        const pb = b.priority?.toLowerCase();
        const wA = pa === "vip" ? 0 : pa === "haute" || pa === "high" ? 1 : 2;
        const wB = pb === "vip" ? 0 : pb === "haute" || pb === "high" ? 1 : 2;
        if (wA !== wB) return wA - wB;
        if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
        if (a.dueDate) return -1;
        if (b.dueDate) return 1;
        return a.name.localeCompare(b.name);
      });
    }
    return buckets;
  }, [visibleProjects]);

  if (!featuresLoading && cockpitFeatures && !pipelineEnabled) {
    return <FeatureDisabled featureKey="pipeline" tenantSlug={cockpitFeatures.tenant} />;
  }

  const totalActive = visibleProjects.filter((p) => p.status === "active").length;
  const subtitle = `${totalActive} affaire${totalActive > 1 ? "s" : ""} active${totalActive > 1 ? "s" : ""} · ${visibleProjects.length} affichée${visibleProjects.length > 1 ? "s" : ""}`;

  return (
    <div className="p-8 flex flex-col h-full">
      <div className="shrink-0 mb-5">
        <ModuleHeader
          icon={TrendingUp}
          title="Pipeline affaires"
          subtitle={subtitle}
          actions={
            <button onClick={() => setShowCreate(true)} className={btnPrimary}>
              <Plus className="w-3.5 h-3.5" />
              Nouvelle affaire
            </button>
          }
        />
      </div>

      {projectsLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="w-6 h-6 animate-spin text-accent-glow mx-auto mb-3" />
            <p className="text-text-muted micro-label">Chargement du pipeline…</p>
          </div>
        </div>
      ) : visibleProjects.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-md">
            <div className="w-12 h-12 mx-auto mb-4 bg-accent-primary/10 border border-accent-primary/30 flex items-center justify-center">
              <FolderPlus className="w-5 h-5 text-accent-glow" />
            </div>
            <h3 className="text-sm font-bold text-text-primary mb-2">
              Aucune affaire pour l&apos;instant
            </h3>
            <p className="text-[12px] text-text-muted mb-5 leading-relaxed">
              Crée ta première affaire pour commencer à piloter ton activité d&apos;agence
              digitale. Chaque affaire peut être liée à un client, contenir des tâches,
              des liens GitHub/Vercel et une prochaine action.
            </p>
            <button
              onClick={() => setShowCreate(true)}
              className={btnPrimary}
            >
              <Plus className="w-3.5 h-3.5" />
              Créer une affaire
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-x-auto">
          <div className="flex gap-3 h-full pb-2 min-w-max">
            {COLUMNS.map((col) => {
              const items = grouped[col.key];
              return (
                <div
                  key={col.key}
                  className="flex flex-col w-72 shrink-0 bg-surface-0/40"
                >
                  <div className={`shrink-0 border-t-2 ${col.className} px-3 py-2.5 bg-surface-1/60 border-b border-border-subtle`}>
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-[10px] font-bold uppercase tracking-wider text-text-primary">
                        {col.label}
                      </h3>
                      <span className="text-[10px] text-text-muted font-mono tabular-nums">
                        {items.length}
                      </span>
                    </div>
                    <p className="text-[9px] text-text-muted mt-0.5 truncate">{col.hint}</p>
                  </div>

                  <div className="flex-1 overflow-y-auto p-2 space-y-2">
                    {items.length === 0 ? (
                      <div className="text-[10px] text-text-muted/60 italic text-center py-4">
                        —
                      </div>
                    ) : (
                      items.map((p) => (
                        <ProjectCard
                          key={p.id}
                          project={p}
                          onOpen={(proj) => setSelected(proj)}
                          compact
                        />
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Panel détail affaire */}
      <ProjectDetailPanel
        project={selected}
        onClose={() => setSelected(null)}
        onSaved={() => {
          refetch();
          setSelected(null);
        }}
      />

      {/* Modale création */}
      <CreateProjectModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={() => {
          refetch();
          setShowCreate(false);
        }}
      />
    </div>
  );
}
