"use client";

// Bloc 5D + 5G : page /tasks scopée par hostname.
// Le serveur résout le tenant via Host (app.mybotia.com → mybotia,
// vlmedical.mybotia.com → vlmedical, etc.). Aucun pill tenant côté UI,
// aucun query forcé côté hook (useScopedTasks/useScopedProjects).

import { useState } from "react";
import { CheckSquare, Plus, FolderPlus } from "lucide-react";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { btnPrimary, btnSecondary } from "@/components/shared/FormModal";
import { CreateProjectModal } from "@/components/shared/CreateProjectModal";
import { TaskPanel } from "@/components/tasks/TaskPanel";
import { TaskEditPanel } from "@/components/tasks/TaskEditPanel";
import { CreateTaskModal } from "@/components/tasks/CreateTaskModal";
import { useScopedTasks, useScopedProjects, type TaskItem } from "@/hooks/use-api";

const TENANT_SLUG = "mybotia";

export default function TasksPage() {
  const { data: tasks, loading: tasksLoading, refetch: refetchTasks } = useScopedTasks();
  const { data: projects, loading: projectsLoading, refetch: refetchProjects } = useScopedProjects();
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [showCreate, setShowCreate] = useState(false);
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [selectedTask, setSelectedTask] = useState<TaskItem | null>(null);

  const loading = tasksLoading || projectsLoading;

  // Garde-fou défensif : on ne montre QUE les tâches mybotia même si la route
  // venait à fuiter. Conformité brief : "si tenantSlug !== mybotia : ne pas afficher".
  const safeTasks = tasks.filter((t) => t.tenantSlug === TENANT_SLUG);

  // Projets mybotia uniquement pour le filtre
  const mybotiaProjects = projects.filter(
    (p) => !p.tenantSlug || p.tenantSlug === TENANT_SLUG
  );
  const activeProjects = mybotiaProjects.filter((p) => p.status === "active");

  const filteredTasks =
    projectFilter === "all"
      ? safeTasks
      : safeTasks.filter((t) => t.projectId === projectFilter);

  const activeTasks = filteredTasks.filter((t) => t.status !== "done").length;

  async function handleUpdateStatus(t: TaskItem, progress: number) {
    // Bloc 5G-bis : hostname décide du tenant côté serveur.
    await fetch(`/api/tasks/${encodeURIComponent(t.id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ progress: String(progress) }),
    });
    refetchTasks();
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
          subtitle={`${activeTasks} tâches actives · ${activeProjects.length} projets`}
          actions={
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowCreateProject(true)}
                className={btnSecondary}
              >
                <FolderPlus className="w-3.5 h-3.5" />
                Nouveau projet
              </button>
              <button onClick={() => setShowCreate(true)} className={btnPrimary}>
                <Plus className="w-3.5 h-3.5" />
                Nouvelle tâche
              </button>
            </div>
          }
        />

        {/* Filtre projet */}
        <div className="flex items-center gap-3 mt-5">
          <span className="micro-label text-text-muted">Projet</span>
          <div className="flex gap-1 bg-surface-1 p-1 rounded-sm overflow-x-auto">
            <button
              onClick={() => setProjectFilter("all")}
              className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-tight rounded-sm transition-all whitespace-nowrap ${
                projectFilter === "all"
                  ? "bg-accent-primary/10 text-accent-glow"
                  : "text-text-muted hover:bg-surface-3/50"
              }`}
            >
              Tous
            </button>
            {activeProjects.slice(0, 8).map((p) => (
              <button
                key={p.id}
                onClick={() => setProjectFilter(p.id)}
                className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-tight rounded-sm transition-all whitespace-nowrap ${
                  projectFilter === p.id
                    ? "bg-accent-primary/10 text-accent-glow"
                    : "text-text-muted hover:bg-surface-3/50"
                }`}
              >
                {p.name.length > 20 ? p.name.slice(0, 20) + "..." : p.name}
              </button>
            ))}
          </div>
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
        />
      </div>

      <CreateTaskModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={() => refetchTasks()}
        tenantSlug={TENANT_SLUG}
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
