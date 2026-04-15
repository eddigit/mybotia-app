"use client";

import { cn } from "@/lib/utils";
import { Calendar, User, Bot, Tag, ChevronRight } from "lucide-react";
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
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/[0.06] shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-text-primary font-headline uppercase">{col.label}</span>
              <span className="flex items-center justify-center min-w-[20px] h-5 px-1.5 bg-surface-4 text-[10px] font-bold text-text-muted">
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
              <div className="flex items-center justify-center h-24 border border-dashed border-white/[0.06]">
                <span className="micro-label text-text-muted">Vide</span>
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
    <div className={cn(
      "p-4 cursor-pointer group transition-all",
      task.priority === 'critical'
        ? "bg-surface-2 border-l-4 border-l-red-400 border-t border-r border-b border-white/[0.04]"
        : task.priority === 'high'
        ? "bg-surface-2 border-l-4 border-l-accent-primary border-t border-r border-b border-white/[0.04]"
        : "bg-surface-2 border border-white/[0.04]"
    )}>
      {/* Priority label */}
      <div className="flex items-center justify-between mb-2">
        <span className={cn(
          "micro-label",
          task.priority === 'critical' ? "text-red-400" :
          task.priority === 'high' ? "text-accent-glow" :
          "text-text-muted"
        )}>
          {task.priority === 'critical' ? 'Critique' : task.priority === 'high' ? 'Haute' : task.priority === 'medium' ? 'Moyenne' : 'Basse'}
        </span>
        {task.projectName && (
          <span className="text-[10px] text-text-muted font-mono truncate max-w-[100px]">{task.projectName}</span>
        )}
      </div>

      {/* Title */}
      <h4 className="text-xs font-bold text-text-primary mb-2 leading-snug group-hover:text-accent-glow transition-colors">
        {task.title}
      </h4>

      {/* Tags */}
      {task.tags && task.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {task.tags.map((tag) => (
            <span key={tag} className="px-1.5 py-0.5 bg-surface-4 text-[9px] text-text-muted font-mono">
              #{tag}
            </span>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-2 border-t border-white/[0.04]">
        {task.assignee && (
          <div className="flex items-center gap-1.5">
            {task.assigneeType === 'agent' ? (
              <Bot className="w-3 h-3 text-accent-glow" />
            ) : (
              <User className="w-3 h-3 text-text-muted" />
            )}
            <span className={cn(
              "text-[10px] font-bold",
              task.assigneeType === 'agent' ? "text-accent-glow" : "text-text-secondary"
            )}>
              {task.assignee}
            </span>
          </div>
        )}
        {task.dueDate && (
          <div className="flex items-center gap-1 text-[10px] text-text-muted font-mono">
            <Calendar className="w-2.5 h-2.5" />
            {new Date(task.dueDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
          </div>
        )}
      </div>
    </div>
  );
}
