"use client";

import { useState } from "react";
import { CheckSquare, Plus, Loader2 } from "lucide-react";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import {
  FormModal,
  FormField,
  inputClass,
  selectClass,
  btnPrimary,
  btnSecondary,
} from "@/components/shared/FormModal";
import { TaskPanel } from "@/components/tasks/TaskPanel";
import { useTasks, useProjects } from "@/hooks/use-api";

export default function TasksPage() {
  const { data: tasks, loading: tasksLoading, refetch: refetchTasks } = useTasks();
  const { data: projects, loading: projectsLoading } = useProjects();
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);

  const loading = tasksLoading || projectsLoading;
  const activeProjects = projects.filter((p) => p.status === "active");

  const filteredTasks =
    projectFilter === "all"
      ? tasks
      : tasks.filter((t) => t.projectId === projectFilter);

  const activeTasks = filteredTasks.filter((t) => t.status !== "done").length;

  async function handleCreateTask(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setCreating(true);
    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: form.get("label"),
          fk_project: form.get("fk_project"),
          description: form.get("description"),
          date_end: form.get("date_end") || undefined,
          priority: form.get("priority"),
        }),
      });
      if (res.ok) {
        setShowCreate(false);
        refetchTasks();
      }
    } finally {
      setCreating(false);
    }
  }

  async function handleUpdateStatus(id: string, progress: number) {
    await fetch("/api/tasks", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, progress: String(progress) }),
    });
    refetchTasks();
  }

  if (loading) {
    return (
      <div className="p-8 min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-accent-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-text-muted micro-label">
            Chargement des taches...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 flex flex-col h-full">
      <div className="shrink-0 mb-6">
        <ModuleHeader
          icon={CheckSquare}
          title="Taches & Projets"
          subtitle={`${activeTasks} taches actives · ${activeProjects.length} projets`}
          actions={
            <button
              onClick={() => setShowCreate(true)}
              className={btnPrimary}
            >
              <Plus className="w-3.5 h-3.5" />
              Nouvelle tache
            </button>
          }
        />

        {/* Project filter strip */}
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
        <TaskPanel tasks={filteredTasks} onUpdateStatus={handleUpdateStatus} />
      </div>

      {/* Create task modal */}
      <FormModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="Nouvelle tache"
      >
        <form onSubmit={handleCreateTask}>
          <FormField label="Titre *">
            <input
              name="label"
              required
              className={inputClass}
              placeholder="Decrire la tache..."
            />
          </FormField>
          <FormField label="Projet *">
            <select name="fk_project" required className={selectClass}>
              <option value="">-- Choisir un projet --</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.ref ? `${p.ref} — ` : ""}{p.name}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Description">
            <textarea
              name="description"
              className={inputClass}
              rows={3}
              placeholder="Details..."
            />
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Echeance">
              <input name="date_end" type="date" className={inputClass} />
            </FormField>
            <FormField label="Priorite">
              <select
                name="priority"
                className={selectClass}
                defaultValue="0"
              >
                <option value="0">Basse</option>
                <option value="1">Moyenne</option>
                <option value="2">Haute</option>
              </select>
            </FormField>
          </div>
          <div className="flex items-center justify-end gap-3 mt-6">
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className={btnSecondary}
            >
              Annuler
            </button>
            <button type="submit" disabled={creating} className={btnPrimary}>
              {creating && (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              )}
              Creer
            </button>
          </div>
        </form>
      </FormModal>
    </div>
  );
}
