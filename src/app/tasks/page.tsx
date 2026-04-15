import { CheckSquare, Plus, Filter } from "lucide-react";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { TaskPanel } from "@/components/tasks/TaskPanel";
import { tasks, projects } from "@/data/mock";

export default function TasksPage() {
  const activeTasks = tasks.filter(t => t.status !== 'done').length;

  return (
    <div className="p-8 flex flex-col h-full">
      <div className="shrink-0 mb-6">
        <ModuleHeader
          icon={CheckSquare}
          title="Taches & Projets"
          subtitle={`${activeTasks} taches actives · ${projects.filter(p => p.status === 'active').length} projets`}
          actions={
            <div className="flex items-center gap-2">
              <button className="flex items-center gap-2 px-4 py-2.5 bg-surface-3 border border-white/[0.06] text-text-secondary text-xs font-bold uppercase tracking-wider hover:bg-surface-4 transition-all">
                <Filter className="w-3.5 h-3.5" />
                Filtrer
              </button>
              <button className="flex items-center gap-2 px-4 py-2.5 bg-accent-primary text-white text-xs font-bold uppercase tracking-widest hover:bg-accent-primary/80 transition-all">
                <Plus className="w-3.5 h-3.5" />
                Nouvelle tache
              </button>
            </div>
          }
        />

        {/* Project filter strip */}
        <div className="flex items-center gap-3 mt-5">
          <span className="micro-label text-text-muted">Projet</span>
          <div className="flex gap-1 bg-surface-1 p-1 rounded-sm">
            {['Tous', ...projects.filter(p => p.status === 'active').slice(0, 4).map(p => p.name.length > 18 ? p.name.slice(0, 18) + '...' : p.name)].map((name) => (
              <button
                key={name}
                className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-tight rounded-sm transition-all ${
                  name === 'Tous'
                    ? "bg-accent-primary/10 text-accent-glow"
                    : "text-text-muted hover:bg-surface-3/50"
                }`}
              >
                {name}
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
