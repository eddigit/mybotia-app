"use client";

// V1.1.B Phase 3C — Projects Command Center.
// Carte projet réutilisable (Pipeline + listes projets).
// Affiche : nom, client (link), priorité (badge), prochaine action,
// échéance, liens rapides GitHub/Vercel/prod/staging, indicateur tâches.

import Link from "next/link";
import {
  Code,
  ExternalLink,
  Globe,
  FlaskConical,
  Calendar,
  Sparkles,
  CheckSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Project } from "@/types";

const PRIORITY_BADGE: Record<string, { label: string; className: string }> = {
  vip: {
    label: "VIP",
    className: "bg-amber-400/15 text-amber-300 border-amber-400/30",
  },
  haute: {
    label: "Haute",
    className: "bg-rose-400/15 text-rose-300 border-rose-400/30",
  },
  high: {
    label: "Haute",
    className: "bg-rose-400/15 text-rose-300 border-rose-400/30",
  },
  normale: {
    label: "Normale",
    className: "bg-surface-3/60 text-text-muted border-border-subtle",
  },
  medium: {
    label: "Normale",
    className: "bg-surface-3/60 text-text-muted border-border-subtle",
  },
};

function formatDueShort(due?: string): string | null {
  if (!due) return null;
  const d = new Date(due);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  const diff = Math.round((d.getTime() - now.getTime()) / 86400000);
  const datePart = d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
  if (diff < -1) return `${datePart} (retard ${Math.abs(diff)}j)`;
  if (diff === -1) return `${datePart} (hier)`;
  if (diff === 0) return `${datePart} (aujourd'hui)`;
  if (diff === 1) return `${datePart} (demain)`;
  if (diff <= 7) return `${datePart} (dans ${diff}j)`;
  return datePart;
}

function dueClass(due?: string): string {
  if (!due) return "text-text-muted";
  const d = new Date(due);
  if (Number.isNaN(d.getTime())) return "text-text-muted";
  const diff = Math.round((d.getTime() - new Date().getTime()) / 86400000);
  if (diff < 0) return "text-rose-300";
  if (diff <= 2) return "text-amber-300";
  return "text-text-muted";
}

export function ProjectCard({
  project,
  onOpen,
  compact = false,
}: {
  project: Project;
  onOpen?: (p: Project) => void;
  compact?: boolean;
}) {
  const priority = project.priority?.toLowerCase();
  const badge = priority ? PRIORITY_BADGE[priority] : null;
  const dueLabel = formatDueShort(project.dueDate);
  const dueCls = dueClass(project.dueDate);

  const links: Array<{ url: string; icon: React.ComponentType<{ className?: string }>; title: string; type: "github" | "vercel" | "prod" | "staging" }> = [];
  if (project.repoGithubUrl) links.push({ url: project.repoGithubUrl, icon: Code, title: "GitHub", type: "github" });
  if (project.vercelProjectUrl) links.push({ url: project.vercelProjectUrl, icon: ExternalLink, title: "Vercel", type: "vercel" });
  if (project.productionUrl) links.push({ url: project.productionUrl, icon: Globe, title: "Production", type: "prod" });
  if (project.stagingUrl) links.push({ url: project.stagingUrl, icon: FlaskConical, title: "Staging", type: "staging" });

  return (
    <button
      type="button"
      onClick={() => onOpen?.(project)}
      className={cn(
        "group w-full text-left bg-surface-1 border border-border-subtle hover:border-accent-primary/40 hover:bg-surface-2/40 transition-all",
        compact ? "p-3" : "p-4",
      )}
    >
      {/* Ligne 1 : titre + priorité */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className={cn("font-semibold text-text-primary leading-tight truncate", compact ? "text-xs" : "text-sm")}>
          {project.name}
        </h3>
        {badge && (
          <span className={cn(
            "shrink-0 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-tight border whitespace-nowrap",
            badge.className,
          )}>
            {badge.label}
          </span>
        )}
      </div>

      {/* Ligne 2 : client */}
      {project.clientName && (
        <div className="text-[11px] text-text-secondary truncate mb-2">
          {project.clientId ? (
            <Link
              href={`/crm/${encodeURIComponent(project.clientId)}`}
              onClick={(e) => e.stopPropagation()}
              className="hover:text-accent-glow underline-offset-2 hover:underline"
            >
              {project.clientName}
            </Link>
          ) : (
            project.clientName
          )}
        </div>
      )}

      {/* Ligne 3 : prochaine action */}
      {project.nextAction && (
        <div className="flex items-start gap-1 text-[11px] text-text-secondary mb-2 leading-snug">
          <Sparkles className="w-3 h-3 shrink-0 mt-0.5 text-accent-glow/70" />
          <span className="line-clamp-2">{project.nextAction}</span>
        </div>
      )}

      {/* Ligne 4 : meta (échéance + tasks) */}
      <div className="flex items-center justify-between gap-2 mt-2">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {dueLabel && (
            <span className={cn("inline-flex items-center gap-1 text-[10px]", dueCls)}>
              <Calendar className="w-3 h-3" />
              {dueLabel}
            </span>
          )}
          {(project.tasksTotal ?? 0) > 0 && (
            <span className="inline-flex items-center gap-1 text-[10px] text-text-muted">
              <CheckSquare className="w-3 h-3" />
              {project.tasksDone}/{project.tasksTotal}
            </span>
          )}
        </div>

        {/* Liens rapides */}
        {links.length > 0 && (
          <div className="flex items-center gap-1 shrink-0">
            {links.map(({ url, icon: Icon, title, type }) => (
              <a
                key={type}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                title={title}
                className="inline-flex items-center justify-center w-5 h-5 text-text-muted hover:text-accent-glow transition-colors"
              >
                <Icon className="w-3 h-3" />
              </a>
            ))}
          </div>
        )}
      </div>
    </button>
  );
}
