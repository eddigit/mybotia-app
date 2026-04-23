"use client";

import { useEffect, useState } from "react";
import { Loader2, X, Save } from "lucide-react";
import { useProjects, type TaskItem } from "@/hooks/use-api";

function toDatetimeLocal(dueDate?: string): string {
  if (!dueDate) return "";
  // dueDate is YYYY-MM-DD; default to 23:59 local time for convenience
  return `${dueDate}T23:59`;
}

export function TaskEditPanel({
  task,
  onClose,
  onSaved,
}: {
  task: TaskItem | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { data: projects } = useProjects();

  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");
  const [fkProject, setFkProject] = useState("");
  const [dueLocal, setDueLocal] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!task) return;
    setLabel(task.title || "");
    setDescription(task.description || "");
    setFkProject(task.projectId || "");
    setDueLocal(toDatetimeLocal(task.dueDate));
    setError(null);
  }, [task?.id]);

  if (!task) return null;

  const sortedProjects = [...projects]
    .filter((p) => p.status === "active")
    .sort((a, b) => {
      if (a.ref === "PERSO") return -1;
      if (b.ref === "PERSO") return 1;
      return (a.ref || a.name).localeCompare(b.ref || b.name);
    });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim() || !fkProject) return;
    setSaving(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        id: task!.id,
        label: label.trim(),
        description,
        fk_project: fkProject,
      };
      if (dueLocal) {
        payload.date_end = Math.floor(new Date(dueLocal).getTime() / 1000);
      }
      const res = await fetch("/api/tasks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `HTTP ${res.status}`);
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <aside className="relative w-full max-w-md h-full bg-surface-1 border-l border-border-subtle shadow-2xl overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-subtle">
          <h2 className="text-sm font-bold font-headline uppercase tracking-wider text-text-primary">
            Modifier la tâche
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-text-muted hover:text-text-primary transition-colors"
            aria-label="Fermer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={save} className="p-5 space-y-4">
          <div>
            <label className="block micro-label text-text-muted mb-1.5">Titre</label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              required
              className="w-full bg-surface-2 border border-border-subtle text-sm py-2.5 px-3 text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-glow"
            />
          </div>

          <div>
            <label className="block micro-label text-text-muted mb-1.5">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full bg-surface-2 border border-border-subtle text-sm py-2.5 px-3 text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-glow resize-none"
            />
          </div>

          <div>
            <label className="block micro-label text-text-muted mb-1.5">Projet</label>
            <select
              value={fkProject}
              onChange={(e) => setFkProject(e.target.value)}
              required
              className="w-full bg-surface-2 border border-border-subtle text-sm py-2.5 px-3 text-text-primary focus:outline-none focus:border-accent-glow"
            >
              {sortedProjects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.ref ? `${p.ref} — ${p.name}` : p.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block micro-label text-text-muted mb-1.5">
              Échéance (date &amp; heure — optionnel)
            </label>
            <input
              type="datetime-local"
              value={dueLocal}
              onChange={(e) => setDueLocal(e.target.value)}
              className="w-full bg-surface-2 border border-border-subtle text-sm py-2.5 px-3 text-text-primary focus:outline-none focus:border-accent-glow"
            />
          </div>

          {error && <div className="text-[11px] text-red-400">{error}</div>}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-text-muted hover:text-text-secondary text-[11px] font-bold uppercase tracking-widest"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={saving || !label.trim() || !fkProject}
              className="px-4 py-2 bg-accent-primary hover:bg-accent-primary/80 disabled:opacity-50 disabled:cursor-not-allowed text-white text-[11px] font-bold uppercase tracking-widest transition-colors flex items-center gap-1.5"
            >
              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
              Enregistrer
            </button>
          </div>
        </form>
      </aside>
    </div>
  );
}
