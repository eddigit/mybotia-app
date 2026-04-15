import { CheckSquare, Plus, Filter } from "lucide-react";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { TaskPanel } from "@/components/tasks/TaskPanel";
import { tasks, projects } from "@/data/mock";

export default function TasksPage() {
  const activeTasks = tasks.filter(t => t.status !== 'done').length;

  return (
    <div className="p-6 flex flex-col h-full max-w-[1400px] mx-auto">
      <div className="shrink-0 mb-6">
        <ModuleHeader
          icon={CheckSquare}
          title="Taches & Projets"
          subtitle={`${activeTasks} taches actives · ${projects.filter(p => p.status === 'active').length} projets`}
          actions={
            <div className="flex items-center gap-2">
              <button className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-3 border border-border-subtle text-text-secondary text-xs font-medium hover:bg-surface-3/80 transition-all">
                <Filter className="w-3.5 h-3.5" />
                Filtrer
              </button>
              <button className="flex items-center gap-2 px-3 py-2 rounded-lg bg-accent-primary text-white text-xs font-medium hover:bg-accent-primary/90 transition-all">
                <Plus className="w-3.5 h-3.5" />
                Nouvelle tache
              </button>
            </div>
          }
        />

        {/* Project filter strip */}
        <div className="flex items-center gap-2 mt-4">
          <span className="text-[11px] text-text-muted">Projet :</span>
          <div className="flex gap-1">
            {['Tous', ...projects.filter(p => p.status === 'active').map(p => p.name)].map((name) => (
              <button
                key={name}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                  name === 'Tous'
                    ? "bg-accent-primary/10 text-accent-glow"
                    : "text-text-muted hover:text-text-secondary hover:bg-white/[0.03]"
                }`}
              >
                {name.length > 20 ? name.slice(0, 20) + '...' : name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Kanban board */}
      <div className="flex-1 min-h-0">
        <TaskPanel tasks={tasks} />
      </div>
    </div>
  );
}
