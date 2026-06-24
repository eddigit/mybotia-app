"use client";

// Bloc 5D + 5G : page /tasks scopée par hostname.
// Le serveur résout le tenant via Host (app.mybotia.com → mybotia,
// vlmedical.mybotia.com → vlmedical, etc.). Aucun pill tenant côté UI,
// aucun query forcé côté hook (useScopedTasks/useScopedProjects).
//
// V1.1.B Phase 3C — refonte filtres :
// - Onglets projets (illisibles >5) → select projet recherchable
// - Support param URL `?projectId={id}` (pré-sélection depuis fiche projet)
// - Affichage explicite client + projet par tâche dans TaskPanel

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckSquare, Plus, FolderPlus } from "lucide-react";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { btnPrimary, btnSecondary } from "@/components/shared/FormModal";
import { CreateProjectModal } from "@/components/shared/CreateProjectModal";
import { TaskPanel } from "@/components/tasks/TaskPanel";
import { TaskEditPanel } from "@/components/tasks/TaskEditPanel";
import { CreateTaskModal } from "@/components/tasks/CreateTaskModal";
import { useScopedTasks, useScopedProjects, useCockpitFeatures, type TaskItem } from "@/hooks/use-api";
import { FeatureDisabled } from "@/components/shared/FeatureDisabled";

export default function TasksPage() {
  // Bloc 6B — feature gate + tenant cockpit courant (résolu via hostname côté serveur)
  const { data: cockpitFeatures, loading: featuresLoading } = useCockpitFeatures();
  const tasksEnabled = cockpitFeatures?.features?.tasks === true;
  // V1.1.H P0-4 — slug dynamique depuis cockpit, jamais hardcodé
  const currentTenant = cockpitFeatures?.tenant ?? "";

  const { data: tasks, loading: tasksLoading, refetch: refetchTasks } = useScopedTasks();
  const { data: projects, loading: projectsLoading, refetch: refetchProjects } = useScopedProjects();
  // V1.1.B Phase 3C — pré-sélection projet via URL (?projectId=xxx)
  const searchParams = useSearchParams();
  const initialProjectId = searchParams.get("projectId");
  const [projectFilter, setProjectFilter] = useState<string>(initialProjectId || "all");
  const [projectSearch, setProjectSearch] = useState("");

  // Sync param URL → state si l'URL change (navigation interne)
  useEffect(() => {
    const fromUrl = searchParams.get("projectId");
    if (fromUrl && fromUrl !== projectFilter) {
      setProjectFilter(fromUrl);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [assignedToFilter, setAssignedToFilter] = useState<string>("all");
  const [showCreate, setShowCreate] = useState(false);
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [selectedTask, setSelectedTask] = useState<TaskItem | null>(null);

  const loading = tasksLoading || projectsLoading;

  // V1.1.H P0-4 — filtre tenant cockpit courant (dynamique, plus de hardcode mybotia).
  // currentTenant vide pendant le chargement initial : on montre [] jusqu'à résolution.
  const safeTasks = currentTenant
    ? tasks.filter((t) => t.tenantSlug === currentTenant)
    : [];

  // Projets du cockpit courant uniquement pour le filtre
  const mybotiaProjects = projects.filter(
    (p) => currentTenant && (!p.tenantSlug || p.tenantSlug === currentTenant)
  );
  const activeProjects = mybotiaProjects.filter((p) => p.status === "active");

  // V1.1.B Phase 3C — pour le select : tous les projets non terminés,
  // triés par priorité puis nom (VIP/haute en haut). Tri stable.
  const sortedProjects = useMemo(() => {
    const list = mybotiaProjects.filter((p) => p.status !== "completed");
    return [...list].sort((a, b) => {
      const pa = (a.priority || "").toLowerCase();
      const pb = (b.priority || "").toLowerCase();
      const wA = pa === "vip" ? 0 : pa === "haute" || pa === "high" ? 1 : 2;
      const wB = pb === "vip" ? 0 : pb === "haute" || pb === "high" ? 1 : 2;
      if (wA !== wB) return wA - wB;
      return a.name.localeCompare(b.name);
    });
  }, [mybotiaProjects]);
  const visibleProjectOptions = useMemo(() => {
    const q = projectSearch.trim().toLowerCase();
    const filtered = q
      ? sortedProjects.filter((p) =>
          [p.name, p.clientName, p.ref]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(q),
        )
      : sortedProjects;
    if (projectFilter === "all" || filtered.some((p) => p.id === projectFilter)) {
      return filtered;
    }
    const selected = sortedProjects.find((p) => p.id === projectFilter);
    return selected ? [selected, ...filtered] : filtered;
  }, [projectFilter, projectSearch, sortedProjects]);

  // V1.1.B agence digitale — filtres composés.
  // Cast pour accéder aux champs étendus (TaskItem ne les déclare pas encore).
  type TaskWithExtras = TaskItem & {
    priority?: string;
    category?: string;
    assignedTo?: string;
  };
  const tasksExtended = safeTasks as TaskWithExtras[];
  const filteredTasks: TaskWithExtras[] = tasksExtended
    .filter((t) => projectFilter === "all" || t.projectId === projectFilter)
    .filter((t) => statusFilter === "all" || t.status === statusFilter)
    .filter((t) => priorityFilter === "all" || (t.priority ?? "medium") === priorityFilter)
    .filter((t) => categoryFilter === "all" || (t.category ?? "") === categoryFilter)
    .filter((t) => assignedToFilter === "all" || (t.assignedTo ?? "") === assignedToFilter)
    // Tri par échéance asc (sans due date à la fin)
    .sort((a, b) => {
      if (!a.dueDate && !b.dueDate) return 0;
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return a.dueDate.localeCompare(b.dueDate);
    });

  const selectedFilterProject =
    projectFilter !== "all"
      ? sortedProjects.find((p) => p.id === projectFilter)
      : undefined;
  const activeTasks = filteredTasks.filter((t) => t.status !== "done").length;
  const today = new Date().toISOString().slice(0, 10);
  const overdueTasks = filteredTasks.filter(
    (t) => t.dueDate && t.dueDate < today && t.status !== "done",
  ).length;

  async function handleUpdateStatus(t: TaskItem, progress: number) {
    // Bloc 5G-bis : hostname décide du tenant côté serveur.
    await fetch(`/api/tasks/${encodeURIComponent(t.id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ progress: String(progress) }),
    });
    refetchTasks();
  }

  async function handleDeleteTasks(tasksToDelete: TaskItem[]) {
    if (tasksToDelete.length === 0) return;
    const results = await Promise.allSettled(
      tasksToDelete.map(async (task) => {
        const res = await fetch(`/api/tasks/${encodeURIComponent(task.id)}`, {
          method: "DELETE",
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(
            body.error || `Suppression impossible pour "${task.title}"`,
          );
        }
        return task.id;
      }),
    );
    const deletedCount = results.filter((result) => result.status === "fulfilled").length;
    if (deletedCount > 0) {
      refetchTasks();
    }
    const failed = results.find((result) => result.status === "rejected");
    if (failed?.status === "rejected") {
      throw failed.reason instanceof Error
        ? failed.reason
        : new Error("Certaines tâches n'ont pas pu être supprimées");
    }
  }

  if (!featuresLoading && cockpitFeatures && !tasksEnabled) {
    return <FeatureDisabled featureKey="tasks" tenantSlug={cockpitFeatures.tenant} />;
  }

  if (loading) {
    return (
      <div className="p-8 min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-accent-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-text-muted micro-label">Chargement des tâches...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 flex flex-col h-full">
      <div className="shrink-0 mb-6">
        <ModuleHeader
          icon={CheckSquare}
          title="Tâches MyBotIA"
          subtitle={`${activeTasks} tâche${activeTasks > 1 ? "s" : ""} active${activeTasks > 1 ? "s" : ""}${overdueTasks > 0 ? ` · ${overdueTasks} en retard` : ""} · ${activeProjects.length} affaire${activeProjects.length > 1 ? "s" : ""}`}
          actions={
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowCreateProject(true)}
                className={btnSecondary}
              >
                <FolderPlus className="w-3.5 h-3.5" />
                Nouvelle affaire
              </button>
              <button onClick={() => setShowCreate(true)} className={btnPrimary}>
                <Plus className="w-3.5 h-3.5" />
                Nouvelle tâche
              </button>
            </div>
          }
        />

        {/* Filtre affaire : recherche + select pour les longues listes. */}
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-end">
          <label className="flex flex-col gap-1">
            <span className="micro-label text-text-muted">Recherche</span>
            <input
              type="search"
              value={projectSearch}
              onChange={(e) => setProjectSearch(e.target.value)}
              placeholder="Rechercher une affaire"
              className="min-w-[220px] bg-surface-2 border border-border-subtle px-2 py-1.5 text-[11px] text-text-primary outline-none focus:border-accent-primary/40"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="micro-label text-text-muted">Affaire</span>
            <select
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              className="min-w-[320px] bg-surface-2 border border-border-subtle px-2 py-1.5 text-[11px] text-text-primary outline-none focus:border-accent-primary/40"
            >
              <option value="all">Toutes les affaires</option>
              {visibleProjectOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.clientName ? ` — ${p.clientName}` : ""}
                </option>
              ))}
            </select>
          </label>
          {(projectFilter !== "all" || projectSearch) && (
            <button
              type="button"
              onClick={() => {
                setProjectFilter("all");
                setProjectSearch("");
              }}
              className="pb-1.5 text-[10px] text-text-muted hover:text-text-primary underline"
            >
              Effacer
            </button>
          )}
        </div>

        {/* V1.1.B agence digitale — filtres composés */}
        <div className="flex flex-wrap items-center gap-3 mt-3 text-[11px]">
          <div className="flex items-center gap-1.5">
            <span className="micro-label text-text-muted">Statut</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-surface-2 border border-border-subtle px-2 py-1 text-text-primary"
            >
              <option value="all">Tous</option>
              <option value="todo">À faire</option>
              <option value="in_progress">En cours</option>
              <option value="done">Terminé</option>
            </select>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="micro-label text-text-muted">Priorité</span>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="bg-surface-2 border border-border-subtle px-2 py-1 text-text-primary"
            >
              <option value="all">Toutes</option>
              <option value="urgent">Urgent</option>
              <option value="high">Haute</option>
              <option value="medium">Moyenne</option>
              <option value="low">Basse</option>
            </select>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="micro-label text-text-muted">Catégorie</span>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-surface-2 border border-border-subtle px-2 py-1 text-text-primary"
            >
              <option value="all">Toutes</option>
              <option value="dev">Dev</option>
              <option value="design">Design</option>
              <option value="contenu">Contenu</option>
              <option value="client">Client</option>
              <option value="admin">Admin</option>
              <option value="devis">Devis</option>
              <option value="facture">Facture</option>
              <option value="déploiement">Déploiement</option>
              <option value="bug">Bug</option>
              <option value="ia">IA</option>
            </select>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="micro-label text-text-muted">Assigné</span>
            <select
              value={assignedToFilter}
              onChange={(e) => setAssignedToFilter(e.target.value)}
              className="bg-surface-2 border border-border-subtle px-2 py-1 text-text-primary"
            >
              <option value="all">Tous</option>
              <option value="gilles">Gilles</option>
              <option value="lea">Léa</option>
              <option value="damien">Damien</option>
              <option value="client">Client</option>
              <option value="autre">Autre</option>
            </select>
          </div>
          {(statusFilter !== "all" ||
            priorityFilter !== "all" ||
            categoryFilter !== "all" ||
            assignedToFilter !== "all") && (
            <button
              onClick={() => {
                setStatusFilter("all");
                setPriorityFilter("all");
                setCategoryFilter("all");
                setAssignedToFilter("all");
              }}
              className="text-text-muted hover:text-text-primary px-2 py-1 underline"
            >
              Réinitialiser
            </button>
          )}
        </div>
      </div>

      {/* Kanban board */}
      <div className="flex-1 min-h-0">
        <TaskPanel
          tasks={filteredTasks}
          onUpdateStatus={(id, progress) => {
            const t = filteredTasks.find((x) => x.id === id);
            if (t) handleUpdateStatus(t, progress);
          }}
          onOpenTask={(t) => setSelectedTask(t)}
          onDeleteTasks={handleDeleteTasks}
        />
      </div>

      <CreateTaskModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={() => refetchTasks()}
        tenantSlug={currentTenant}
        defaultProjectId={projectFilter !== "all" ? projectFilter : undefined}
        defaultProjectLabel={selectedFilterProject?.name}
      />

      <CreateProjectModal
        open={showCreateProject}
        onClose={() => setShowCreateProject(false)}
        onCreated={() => refetchProjects()}
      />

      <TaskEditPanel
        task={selectedTask}
        onClose={() => setSelectedTask(null)}
        onSaved={() => refetchTasks()}
      />
    </div>
  );
}
