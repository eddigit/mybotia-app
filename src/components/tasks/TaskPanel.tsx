"use client";

import { cn } from "@/lib/utils";
import { Calendar, CircleDot } from "lucide-react";
import type { TaskItem } from "@/hooks/use-api";

export function TaskPanel({
  tasks,
  onUpdateStatus,
  onOpenTask,
}: {
  tasks: TaskItem[];
  onUpdateStatus?: (id: string, progress: number) => void;
  onOpenTask?: (task: TaskItem) => void;
}) {
  const columns = [
    {
      id: "todo",
      label: "A faire",
      tasks: tasks.filter((t) => t.status === "todo"),
    },
    {
      id: "in_progress",
      label: "En cours",
      tasks: tasks.filter((t) => t.status === "in_progress"),
    },
    {
      id: "done",
      label: "Termine",
      tasks: tasks.filter((t) => t.status === "done"),
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-4 h-full">
      {columns.map((col) => (
        <div key={col.id} className="flex flex-col min-h-0">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-border-subtle shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-text-primary font-headline uppercase">
                {col.label}
              </span>
              <span className="flex items-center justify-center min-w-[20px] h-5 px-1.5 bg-surface-4 text-[10px] font-bold text-text-muted">
                {col.tasks.length}
              </span>
            </div>
          </div>

          <div className="flex-1 space-y-2 overflow-y-auto">
            {col.tasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onUpdateStatus={onUpdateStatus}
                onOpenTask={onOpenTask}
              />
            ))}
            {col.tasks.length === 0 && (
              <div className="flex items-center justify-center h-24 border border-dashed border-border-subtle">
                <span className="micro-label text-text-muted">Vide</span>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function TaskCard({
  task,
  onUpdateStatus,
  onOpenTask,
}: {
  task: TaskItem;
  onUpdateStatus?: (id: string, progress: number) => void;
  onOpenTask?: (task: TaskItem) => void;
}) {
  const clickable = !!onOpenTask;
  return (
    <div
      onClick={clickable ? () => onOpenTask(task) : undefined}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={
        clickable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onOpenTask(task);
              }
            }
          : undefined
      }
      className={cn(
        "p-4 group transition-all",
        clickable && "cursor-pointer hover:bg-surface-3/40",
        task.priority === "high"
          ? "bg-surface-2 border-l-4 border-l-accent-primary border-t border-r border-b border-border-subtle"
          : "bg-surface-2 border border-border-subtle"
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <span
          className={cn(
            "micro-label",
            task.priority === "high"
              ? "text-accent-glow"
              : task.priority === "medium"
                ? "text-amber-400"
                : "text-text-muted"
          )}
        >
          {task.priority === "high"
            ? "Haute"
            : task.priority === "medium"
              ? "Moyenne"
              : "Basse"}
        </span>
        {task.projectRef && (
          <span className="text-[10px] text-text-muted font-mono truncate max-w-[100px]">
            {task.projectRef}
          </span>
        )}
      </div>

      <h4 className="text-xs font-bold text-text-primary mb-2 leading-snug">
        {task.title}
      </h4>

      {task.description && (
        <p className="text-[11px] text-text-muted mb-2 line-clamp-2">
          {task.description}
        </p>
      )}

      {/* Progress bar */}
      {task.progress > 0 && task.progress < 100 && (
        <div className="w-full h-1 bg-surface-4 rounded-full mb-2">
          <div
            className="h-1 bg-accent-primary rounded-full"
            style={{ width: `${task.progress}%` }}
          />
        </div>
      )}

      <div className="flex items-center justify-between pt-2 border-t border-border-subtle">
        <span className="text-[10px] text-text-muted truncate max-w-[120px]">
          {task.projectName}
        </span>
        <div className="flex items-center gap-2">
          {task.dueDate && (
            <div className="flex items-center gap-1 text-[10px] text-text-muted font-mono">
              <Calendar className="w-2.5 h-2.5" />
              {new Date(task.dueDate).toLocaleDateString("fr-FR", {
                day: "numeric",
                month: "short",
              })}
            </div>
          )}
          {/* Status cycle button */}
          {onUpdateStatus && task.status !== "done" && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onUpdateStatus(
                  task.id,
                  task.status === "todo" ? 50 : 100
                );
              }}
              className="text-text-muted hover:text-accent-glow transition-colors"
              title={
                task.status === "todo"
                  ? "Passer en cours"
                  : "Marquer termine"
              }
            >
              <CircleDot className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
