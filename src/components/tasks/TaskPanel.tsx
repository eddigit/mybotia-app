"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { Calendar, CircleDot, Loader2, Trash2, X } from "lucide-react";
import type { TaskItem } from "@/hooks/use-api";
import { HumanAvatar } from "@/components/shared/HumanAvatar";

export function TaskPanel({
  tasks,
  onUpdateStatus,
  onOpenTask,
  onDeleteTasks,
}: {
  tasks: TaskItem[];
  onUpdateStatus?: (id: string, progress: number) => void;
  onOpenTask?: (task: TaskItem) => void;
  onDeleteTasks?: (tasks: TaskItem[]) => Promise<void> | void;
}) {
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkDeleteError, setBulkDeleteError] = useState<string | null>(null);
  const selectedTasks = useMemo(
    () => tasks.filter((task) => selectedTaskIds.has(task.id)),
    [selectedTaskIds, tasks],
  );
  const selectedCount = selectedTasks.length;

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

  function toggleTaskSelection(taskId: string, checked: boolean) {
    setBulkDeleteError(null);
    setSelectedTaskIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(taskId);
      else next.delete(taskId);
      return next;
    });
  }

  async function handleDeleteSelectedTasks() {
    if (!onDeleteTasks || selectedTasks.length === 0) return;
    const count = selectedTasks.length;
    const plural = count > 1 ? "s" : "";
    if (
      !confirm(
        `Supprimer définitivement ${count} tâche${plural} sélectionnée${plural} ?\n\nAction irréversible.`,
      )
    ) {
      return;
    }

    setBulkDeleting(true);
    setBulkDeleteError(null);
    try {
      await onDeleteTasks(selectedTasks);
      setSelectedTaskIds(new Set());
    } catch (error) {
      setBulkDeleteError(
        error instanceof Error ? error.message : "Erreur suppression",
      );
    } finally {
      setBulkDeleting(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      {selectedCount > 0 && (
        <div className="flex shrink-0 items-center justify-between border border-border-subtle bg-surface-2 px-3 py-2">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-widest text-text-primary">
              {selectedCount} sélectionnée{selectedCount > 1 ? "s" : ""}
            </span>
            {bulkDeleteError && (
              <span className="text-[11px] text-status-danger">
                {bulkDeleteError}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setSelectedTaskIds(new Set());
                setBulkDeleteError(null);
              }}
              className="inline-flex h-8 w-8 items-center justify-center border border-border-subtle text-text-muted hover:text-text-primary"
              title="Annuler la sélection"
              aria-label="Annuler la sélection"
              disabled={bulkDeleting}
            >
              <X className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={handleDeleteSelectedTasks}
              disabled={bulkDeleting || !onDeleteTasks}
              className="inline-flex h-8 w-8 items-center justify-center border border-status-danger/30 bg-status-danger/10 text-status-danger hover:bg-status-danger/20 disabled:cursor-not-allowed disabled:opacity-50"
              title="Supprimer les tâches sélectionnées"
              aria-label="Supprimer les tâches sélectionnées"
            >
              {bulkDeleting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
        </div>
      )}

      <div className="grid min-h-0 flex-1 grid-cols-3 gap-4">
        {columns.map((col) => (
          <div key={col.id} className="flex min-h-0 flex-col">
            <div className="mb-3 flex shrink-0 items-center justify-between border-b border-border-subtle pb-3">
              <div className="flex items-center gap-2">
                <span className="font-headline text-xs font-bold uppercase text-text-primary">
                  {col.label}
                </span>
                <span className="flex h-5 min-w-[20px] items-center justify-center bg-surface-4 px-1.5 text-[10px] font-bold text-text-muted">
                  {col.tasks.length}
                </span>
              </div>
            </div>

            <div className="flex-1 space-y-2 overflow-y-auto">
              {col.tasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  selected={selectedTaskIds.has(task.id)}
                  onToggleSelection={
                    onDeleteTasks
                      ? (checked) => toggleTaskSelection(task.id, checked)
                      : undefined
                  }
                  onUpdateStatus={onUpdateStatus}
                  onOpenTask={onOpenTask}
                />
              ))}
              {col.tasks.length === 0 && (
                <div className="flex h-24 items-center justify-center border border-dashed border-border-subtle">
                  <span className="micro-label text-text-muted">Vide</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TaskCard({
  task,
  selected,
  onToggleSelection,
  onUpdateStatus,
  onOpenTask,
}: {
  task: TaskItem;
  selected: boolean;
  onToggleSelection?: (checked: boolean) => void;
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
        "group p-4 transition-all",
        clickable && "cursor-pointer hover:bg-surface-3/40",
        task.priority === "high"
          ? "bg-surface-2 border-l-4 border-l-accent-primary border-t border-r border-b border-border-subtle"
          : "bg-surface-2 border border-border-subtle",
        selected && "bg-accent-primary/5 ring-1 ring-accent-primary/50",
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex min-w-0 items-center gap-2">
          {onToggleSelection && (
            <input
              type="checkbox"
              checked={selected}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
              onChange={(e) => onToggleSelection(e.target.checked)}
              className="h-3.5 w-3.5 shrink-0 accent-accent-primary"
              aria-label={`Sélectionner ${task.title}`}
            />
          )}
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
        </div>
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
        <div className="flex items-center gap-2 min-w-0">
          {(task.assigneeName || task.assigneeEmail) && (
            <HumanAvatar
              email={task.assigneeEmail}
              name={task.assigneeName}
              fallbackLabel="Responsable"
              size={22}
            />
          )}
          <span className="text-[10px] text-text-muted truncate max-w-[120px]">
            {task.projectName}
          </span>
        </div>
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
