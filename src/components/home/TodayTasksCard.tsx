"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, ChevronRight, Plus, X, AlertTriangle, Loader2 } from "lucide-react";
import { useTodayTasks, useScopedProjects, type TaskItem } from "@/hooks/use-api";
import { cn } from "@/lib/utils";
import { TaskEditPanel } from "@/components/tasks/TaskEditPanel";

function todayAt2359(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}T23:59`;
}

export function TodayTasksCard() {
  const { data: tasks, loading, error, refetch } = useTodayTasks();
  const { data: projects } = useScopedProjects();

  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [projectId, setProjectId] = useState("");
  const [dueLocal, setDueLocal] = useState(todayAt2359());
  const [submitting, setSubmitting] = useState(false);
  const [completingIds, setCompletingIds] = useState<Set<string>>(new Set());
  const [editingTask, setEditingTask] = useState<TaskItem | null>(null);

  const activeProjects = projects.filter((p) => p.status === "active");
  const sortedProjects = [...activeProjects].sort((a, b) => {
    if (a.ref === "PERSO") return -1;
    if (b.ref === "PERSO") return 1;
    return (a.ref || a.name).localeCompare(b.ref || b.name);
  });
  const persoProject = activeProjects.find((p) => p.ref === "PERSO");

  // Preselect "Tâches personnelles" when the form opens and projects are loaded
  useEffect(() => {
    if (adding && !projectId && persoProject) {
      setProjectId(persoProject.id);
    }
  }, [adding, projectId, persoProject]);

  const pending = tasks.filter((t) => t.status !== "done");

  async function markDone(task: TaskItem) {
    setCompletingIds((s) => new Set(s).add(task.id));
    try {
      const res = await fetch(`/api/tasks/${encodeURIComponent(task.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ progress: "100" }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      refetch();
    } catch {
      setCompletingIds((s) => {
        const n = new Set(s);
        n.delete(task.id);
        return n;
      });
    }
  }

  async function quickAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !projectId) return;
    setSubmitting(true);
    try {
      const epoch = dueLocal
        ? Math.floor(new Date(dueLocal).getTime() / 1000)
        : Math.floor(new Date(todayAt2359()).getTime() / 1000);
      // Bloc 5G-bis : tenant via hostname côté serveur.
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: title.trim(),
          fk_project: projectId,
          date_end: epoch,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setTitle("");
      setProjectId(persoProject?.id || "");
      setDueLocal(todayAt2359());
      setAdding(false);
      refetch();
    } catch {
      // silent — user can retry
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="card-sharp-high p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h3 className="section-title">Aujourd&apos;hui</h3>
          {pending.length > 0 && (
            <span className="flex items-center justify-center min-w-[20px] h-5 px-1.5 bg-accent-primary text-white text-[10px] font-bold">
              {pending.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setAdding((v) => !v)}
            className="micro-label text-accent-glow hover:underline flex items-center gap-0.5"
            aria-label={adding ? "Fermer" : "Ajouter une tâche"}
          >
            {adding ? <X className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
            {adding ? "Fermer" : "Ajouter"}
          </button>
          <Link
            href="/tasks"
            className="micro-label text-accent-glow hover:underline flex items-center gap-0.5"
          >
            Tout voir <ChevronRight className="w-3 h-3" />
          </Link>
        </div>
      </div>

      {adding && (
        <form
          onSubmit={quickAdd}
          className="mb-4 bg-surface-1 p-3 space-y-2 border border-border-subtle"
        >
          <input
            autoFocus
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Titre de la tâche…"
            required
            className="w-full bg-surface-2 px-3 py-2 text-xs text-text-primary placeholder:text-text-muted border border-border-subtle focus:outline-none focus:border-accent-glow"
          />
          <div className="grid grid-cols-2 gap-2">
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              required
              className="bg-surface-2 px-3 py-2 text-xs text-text-primary border border-border-subtle focus:outline-none focus:border-accent-glow"
            >
              {sortedProjects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.ref ? `${p.ref} — ${p.name}` : p.name}
                </option>
              ))}
            </select>
            <input
              type="datetime-local"
              value={dueLocal}
              onChange={(e) => setDueLocal(e.target.value)}
              className="bg-surface-2 px-3 py-2 text-xs text-text-primary border border-border-subtle focus:outline-none focus:border-accent-glow"
            />
          </div>
          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setAdding(false)}
              className="micro-label text-text-muted hover:text-text-secondary"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={submitting || !title.trim() || !projectId}
              className="px-3 py-1.5 bg-accent-primary hover:bg-accent-primary/80 disabled:opacity-50 disabled:cursor-not-allowed text-white text-[11px] font-bold uppercase tracking-widest transition-colors flex items-center gap-1.5"
            >
              {submitting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
              Ajouter
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-20">
          <Loader2 className="w-4 h-4 animate-spin text-text-muted" />
        </div>
      ) : error ? (
        <div className="text-[11px] text-red-400">Erreur : {error}</div>
      ) : pending.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-20 border border-dashed border-border-subtle">
          <span className="micro-label text-text-muted">Rien aujourd&apos;hui</span>
          {!adding && (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="micro-label text-accent-glow hover:underline mt-1"
            >
              Ajouter une tâche
            </button>
          )}
        </div>
      ) : (
        <ul className="space-y-1">
          {pending.map((t) => {
            const completing = completingIds.has(t.id);
            return (
              <li
                key={t.id}
                className={cn(
                  "flex items-start gap-3 p-2 bg-surface-1 hover:bg-surface-3/50 transition-colors group",
                  completing && "opacity-40"
                )}
              >
                <button
                  type="button"
                  onClick={() => markDone(t)}
                  disabled={completing}
                  className="mt-0.5 w-4 h-4 border border-border-subtle hover:border-accent-glow flex items-center justify-center text-text-muted hover:text-accent-glow transition-colors shrink-0 disabled:cursor-not-allowed"
                  aria-label="Marquer terminée"
                  title="Terminer"
                >
                  {completing ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Check className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                  )}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingTask(t)}
                      className="text-xs font-medium text-text-primary truncate text-left hover:text-accent-glow transition-colors"
                      title="Modifier"
                    >
                      {t.title}
                    </button>
                    {t.overdue && (
                      <span className="flex items-center gap-0.5 text-[9px] font-bold text-red-400 uppercase tracking-wider shrink-0">
                        <AlertTriangle className="w-2.5 h-2.5" /> Retard
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-text-muted">
                    {t.projectRef && <span className="font-mono">{t.projectRef}</span>}
                    {t.dueDate && (
                      <span className="font-mono">
                        {new Date(t.dueDate).toLocaleDateString("fr-FR", {
                          day: "numeric",
                          month: "short",
                        })}
                      </span>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <TaskEditPanel
        task={editingTask}
        onClose={() => setEditingTask(null)}
        onSaved={refetch}
      />
    </div>
  );
}
