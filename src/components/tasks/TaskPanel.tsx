"use client";

import { cn } from "@/lib/utils";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Calendar, User, Bot, Tag } from "lucide-react";
import type { Task } from "@/types";

export function TaskPanel({ tasks }: { tasks: Task[] }) {
  const columns = [
    { id: 'todo', label: 'A faire', tasks: tasks.filter(t => t.status === 'todo') },
    { id: 'in_progress', label: 'En cours', tasks: tasks.filter(t => t.status === 'in_progress') },
    { id: 'review', label: 'En revue', tasks: tasks.filter(t => t.status === 'review') },
    { id: 'done', label: 'Termine', tasks: tasks.filter(t => t.status === 'done') },
  ];

  return (
    <div className="grid grid-cols-4 gap-4 h-full">
      {columns.map((col) => (
        <div key={col.id} className="flex flex-col min-h-0">
          {/* Column header */}
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-border-subtle shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-text-primary">{col.label}</span>
              <span className="flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[10px] bg-surface-3 text-text-muted">
                {col.tasks.length}
              </span>
            </div>
          </div>

          {/* Tasks */}
          <div className="flex-1 space-y-2 overflow-y-auto">
            {col.tasks.map((task) => (
              <TaskCard key={task.id} task={task} />
            ))}
            {col.tasks.length === 0 && (
              <div className="flex items-center justify-center h-24 rounded-lg border border-dashed border-border-subtle">
                <span className="text-[11px] text-text-muted">Aucune tache</span>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function TaskCard({ task }: { task: Task }) {
  return (
    <div className="glass-card p-3 cursor-pointer group">
      {/* Priority + Project */}
      <div className="flex items-center justify-between mb-2">
        <StatusBadge status={task.priority} size="xs" />
        {task.projectName && (
          <span className="text-[10px] text-text-muted truncate max-w-[120px]">{task.projectName}</span>
        )}
      </div>

      {/* Title */}
      <h4 className="text-xs font-semibold text-text-primary mb-2 leading-snug group-hover:text-accent-glow transition-colors">
        {task.title}
      </h4>

      {/* Description */}
      {task.description && (
        <p className="text-[11px] text-text-muted mb-2 line-clamp-2">{task.description}</p>
      )}

      {/* Tags */}
      {task.tags && task.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {task.tags.map((tag) => (
            <span key={tag} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] bg-surface-3/50 text-text-muted">
              <Tag className="w-2 h-2" />
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-2 border-t border-border-subtle">
        {task.assignee && (
          <div className="flex items-center gap-1.5">
            {task.assigneeType === 'agent' ? (
              <Bot className="w-3 h-3 text-accent-glow" />
            ) : (
              <User className="w-3 h-3 text-text-muted" />
            )}
            <span className={cn(
              "text-[10px] font-medium",
              task.assigneeType === 'agent' ? "text-accent-glow" : "text-text-secondary"
            )}>
              {task.assignee}
            </span>
          </div>
        )}
        {task.dueDate && (
          <div className="flex items-center gap-1 text-[10px] text-text-muted">
            <Calendar className="w-2.5 h-2.5" />
            {new Date(task.dueDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
          </div>
        )}
      </div>
    </div>
  );
}
