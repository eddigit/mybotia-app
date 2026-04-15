"use client";

import { useState } from "react";
import { CheckSquare, Plus, Filter } from "lucide-react";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { TaskPanel } from "@/components/tasks/TaskPanel";
import { useTasks, useProjects } from "@/hooks/use-api";

export default function TasksPage() {
  const { data: tasks, loading: tasksLoading } = useTasks();
  const { data: projects, loading: projectsLoading } = useProjects();
  const [projectFilter, setProjectFilter] = useState<string>("all");

  const loading = tasksLoading || projectsLoading;
  const activeProjects = projects.filter(p => p.status === 'active');

  const filteredTasks = projectFilter === "all"
    ? tasks
    : tasks.filter(t => t.projectId === projectFilter);

  const activeTasks = filteredTasks.filter(t => t.status !== 'done').length;

  if (loading) {
    return (
      <div className="p-8 min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-accent-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-text-muted micro-label">Chargement des taches...</p>
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
            {activeProjects.slice(0, 6).map((p) => (
              <button
                key={p.id}
                onClick={() => setProjectFilter(p.id)}
                className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-tight rounded-sm transition-all whitespace-nowrap ${
                  projectFilter === p.id
                    ? "bg-accent-primary/10 text-accent-glow"
                    : "text-text-muted hover:bg-surface-3/50"
                }`}
              >
                {p.name.length > 20 ? p.name.slice(0, 20) + '...' : p.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Kanban board */}
      <div className="flex-1 min-h-0">
        <TaskPanel tasks={filteredTasks} />
      </div>
    </div>
  );
}
