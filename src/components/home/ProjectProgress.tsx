import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import type { Project } from "@/types";

export function ProjectProgress({ projects }: { projects: Project[] }) {
  return (
    <div className="card-sharp-high p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="section-title">Projets actifs</h3>
        <Link href="/tasks" className="micro-label text-accent-glow hover:underline flex items-center gap-0.5">
          Tout voir <ChevronRight className="w-3 h-3" />
        </Link>
      </div>
      <div className="space-y-4">
        {projects.slice(0, 5).map((project) => (
          <div key={project.id} className="group cursor-pointer">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-text-primary group-hover:text-accent-glow transition-colors truncate">
                {project.name}
              </span>
              {project.budget !== undefined && project.budget > 0 && (
                <span className="text-[10px] font-bold text-accent-glow shrink-0 ml-2">
                  {formatCurrency(project.budget)}
                </span>
              )}
            </div>
            {project.clientName && (
              <span className="text-[10px] text-text-muted">
                {project.clientName}
              </span>
            )}
            <div className="w-full h-1 bg-white/[0.04] mt-1.5">
              <div
                className="h-full transition-all duration-700"
                style={{
                  width: `${project.progress}%`,
                  backgroundColor: project.color,
                  opacity: 0.8,
                }}
              />
            </div>
            <div className="flex items-center justify-between mt-1">
              {project.dueDate ? (
                <span className="text-[10px] text-text-muted font-mono">
                  {new Date(project.dueDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                </span>
              ) : (
                <span />
              )}
              <span className="text-[10px] font-bold" style={{ color: project.color }}>
                {project.status === "completed" ? "Termine" : project.status === "paused" ? "En pause" : "En cours"}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
