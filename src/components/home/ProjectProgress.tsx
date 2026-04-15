import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { Project } from "@/types";

export function ProjectProgress({ projects }: { projects: Project[] }) {
  return (
    <div className="glass-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-text-primary">Projets actifs</h3>
        <Link href="/tasks" className="text-[10px] text-accent-glow hover:underline flex items-center gap-0.5">
          Tout voir <ChevronRight className="w-3 h-3" />
        </Link>
      </div>
      <div className="space-y-3">
        {projects.slice(0, 4).map((project) => (
          <div key={project.id} className="group cursor-pointer">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: project.color }}
                />
                <span className="text-xs font-medium text-text-primary group-hover:text-accent-glow transition-colors">
                  {project.name}
                </span>
              </div>
              <span className="text-[10px] text-text-muted">
                {project.tasksDone}/{project.tasksTotal}
              </span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-surface-3 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${project.progress}%`,
                  backgroundColor: project.color,
                  opacity: 0.8,
                }}
              />
            </div>
            {project.dueDate && (
              <p className="text-[10px] text-text-muted mt-1">
                Echeance : {new Date(project.dueDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
