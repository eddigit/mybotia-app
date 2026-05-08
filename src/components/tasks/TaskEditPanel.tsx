"use client";

// Bloc 5D — TaskDetailDrawer (anciennement TaskEditPanel).
// Drawer complet : titre, description, statut, priorité, échéance,
// projet (éditable), client (lecture seule), bouton Marquer terminé,
// bouton Supprimer, bouton Enregistrer.
//
// Toutes les écritures passent par PATCH/DELETE /api/tasks/[id] avec
// tenant_slug propagé pour ACL serveur.

import { useEffect, useMemo, useState } from "react";
import { Loader2, X, Save, Trash2, CheckCircle2, User, Briefcase } from "lucide-react";
import { useScopedProjects, type TaskItem } from "@/hooks/use-api";
// Bloc 5G-bis : projets scopés via hostname côté serveur, plus de slug forcé client.

const STATUS_LABEL: Record<string, string> = {
  todo: "À faire",
  in_progress: "En cours",
  done: "Terminée",
};

const PRIORITY_LABEL: Record<string, string> = {
  low: "Basse",
  medium: "Moyenne",
  high: "Haute",
};

// UI priority → Dolibarr priority field (string "0".."2")
const PRIORITY_TO_DOLIBARR: Record<string, string> = {
  low: "0",
  medium: "1",
  high: "2",
};

// UI status → Dolibarr progress (target value)
function statusToProgress(status: string, currentProgress: number): number | null {
  if (status === "todo") return 0;
  if (status === "done") return 100;
  if (status === "in_progress") {
    // si déjà entre 1 et 99, on garde le progress courant; sinon 50.
    if (currentProgress > 0 && currentProgress < 100) return null;
    return 50;
  }
  return null;
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
  const { data: projects } = useScopedProjects();

  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");
  const [fkProject, setFkProject] = useState("");
  const [dueDate, setDueDate] = useState(""); // YYYY-MM-DD
  const [priority, setPriority] = useState<"low" | "medium" | "high" | "urgent">("medium");
  const [status, setStatus] = useState<"todo" | "in_progress" | "done">("todo");
  // V1.1.B agence digitale
  const [category, setCategory] = useState("");
  const [workflowStep, setWorkflowStep] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [githubIssueUrl, setGithubIssueUrl] = useState("");
  const [githubPrUrl, setGithubPrUrl] = useState("");
  const [vercelDeploymentUrl, setVercelDeploymentUrl] = useState("");
  const [whatsappThreadRef, setWhatsappThreadRef] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!task) return;
    setLabel(task.title || "");
    setDescription(task.description || "");
    setFkProject(task.projectId || "");
    setDueDate(task.dueDate || "");
    setPriority((task.priority as "low" | "medium" | "high" | "urgent") || "medium");
    setStatus((task.status as "todo" | "in_progress" | "done") || "todo");
    // V1.1.B agence digitale
    const t = task as TaskItem & {
      category?: string;
      workflowStep?: string;
      assignedTo?: string;
      githubIssueUrl?: string;
      githubPrUrl?: string;
      vercelDeploymentUrl?: string;
      whatsappThreadRef?: string;
    };
    setCategory(t.category ?? "");
    setWorkflowStep(t.workflowStep ?? "");
    setAssignedTo(t.assignedTo ?? "");
    setGithubIssueUrl(t.githubIssueUrl ?? "");
    setGithubPrUrl(t.githubPrUrl ?? "");
    setVercelDeploymentUrl(t.vercelDeploymentUrl ?? "");
    setWhatsappThreadRef(t.whatsappThreadRef ?? "");
    setError(null);
  }, [task?.id]);

  const projectInfo = useMemo(() => {
    if (!task) return null;
    return projects.find((p) => p.id === task.projectId) || null;
  }, [projects, task?.projectId]);

  if (!task) return null;

  const sortedProjects = [...projects]
    .filter((p) => p.status === "active")
    .sort((a, b) => {
      if (a.ref === "PERSO") return -1;
      if (b.ref === "PERSO") return 1;
      return (a.ref || a.name).localeCompare(b.ref || b.name);
    });

  // Bloc 5G-bis : le serveur résout le tenant via hostname. Plus de query.
  function buildTenantQuery(): string {
    return "";
  }

  async function handleDelete() {
    if (!task) return;
    if (!confirm(`Supprimer définitivement la tâche "${task.title}" ?\n\nAction irréversible.`)) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/tasks/${encodeURIComponent(task.id)}${buildTenantQuery()}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `HTTP ${res.status}`);
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur suppression");
    } finally {
      setDeleting(false);
    }
  }

  async function handleMarkDone() {
    if (!task) return;
    setCompleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/tasks/${encodeURIComponent(task.id)}${buildTenantQuery()}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ progress: "100" }),
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
      setCompleting(false);
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim() || !fkProject) return;
    setSaving(true);
    setError(null);
    try {
      const patch: Record<string, unknown> = {
        label: label.trim(),
        description,
        fk_project: fkProject,
        // V1.1.B agence digitale : on envoie priority business directement
        // (mapInputTaskFromUi accepte low/medium/high/urgent).
        priority,
      };
      if (dueDate) {
        // Dolibarr accepte timestamp Unix (sec) — fin de journée locale.
        patch.date_end = Math.floor(new Date(`${dueDate}T23:59:59`).getTime() / 1000);
      }
      const targetProgress = statusToProgress(status, task!.progress);
      if (targetProgress !== null) {
        patch.progress = String(targetProgress);
      }
      // V1.1.B agence digitale — champs additionnels (lus via state)
      patch.assignedTo = assignedTo || null;
      patch.category = category || null;
      patch.workflowStep = workflowStep || null;
      patch.githubIssueUrl = githubIssueUrl || null;
      patch.githubPrUrl = githubPrUrl || null;
      patch.vercelDeploymentUrl = vercelDeploymentUrl || null;
      patch.whatsappThreadRef = whatsappThreadRef || null;

      const res = await fetch(`/api/tasks/${encodeURIComponent(task!.id)}${buildTenantQuery()}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
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

  const busy = saving || deleting || completing;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <aside className="relative w-full max-w-md h-full bg-surface-1 border-l border-border-subtle shadow-2xl overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-subtle">
          <div>
            <h2 className="text-sm font-bold font-headline uppercase tracking-wider text-text-primary">
              Détail tâche
            </h2>
            {task.tenantSlug && (
              <p className="text-[10px] text-text-muted font-mono mt-0.5">
                {task.tenantSlug} · #{task.id}
              </p>
            )}
          </div>
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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block micro-label text-text-muted mb-1.5">Statut</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as "todo" | "in_progress" | "done")}
                className="w-full bg-surface-2 border border-border-subtle text-sm py-2.5 px-3 text-text-primary focus:outline-none focus:border-accent-glow"
              >
                <option value="todo">{STATUS_LABEL.todo}</option>
                <option value="in_progress">{STATUS_LABEL.in_progress}</option>
                <option value="done">{STATUS_LABEL.done}</option>
              </select>
            </div>
            <div>
              <label className="block micro-label text-text-muted mb-1.5">Priorité</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as "low" | "medium" | "high" | "urgent")}
                className="w-full bg-surface-2 border border-border-subtle text-sm py-2.5 px-3 text-text-primary focus:outline-none focus:border-accent-glow"
              >
                <option value="low">{PRIORITY_LABEL.low}</option>
                <option value="medium">{PRIORITY_LABEL.medium}</option>
                <option value="high">{PRIORITY_LABEL.high}</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>

          {/* V1.1.B agence digitale */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block micro-label text-text-muted mb-1.5">Catégorie</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full bg-surface-2 border border-border-subtle text-sm py-2.5 px-3 text-text-primary focus:outline-none focus:border-accent-glow">
                <option value="">—</option>
                <option value="dev">Dev</option>
                <option value="design">Design</option>
                <option value="contenu">Contenu</option>
                <option value="client">Client</option>
                <option value="admin">Admin</option>
                <option value="devis">Devis</option>
                <option value="facture">Facture</option>
                <option value="déploiement">Déploiement</option>
                <option value="bug">Bug</option>
                <option value="ia">IA</option>
              </select>
            </div>
            <div>
              <label className="block micro-label text-text-muted mb-1.5">Étape</label>
              <select value={workflowStep} onChange={(e) => setWorkflowStep(e.target.value)} className="w-full bg-surface-2 border border-border-subtle text-sm py-2.5 px-3 text-text-primary focus:outline-none focus:border-accent-glow">
                <option value="">—</option>
                <option value="brief">Brief</option>
                <option value="devis">Devis</option>
                <option value="acompte">Acompte</option>
                <option value="architecture">Architecture</option>
                <option value="maquette">Maquette</option>
                <option value="dev">Dev</option>
                <option value="recette">Recette</option>
                <option value="déploiement">Déploiement</option>
                <option value="livraison">Livraison</option>
                <option value="maintenance">Maintenance</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block micro-label text-text-muted mb-1.5">Assigné à</label>
            <select value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} className="w-full bg-surface-2 border border-border-subtle text-sm py-2.5 px-3 text-text-primary focus:outline-none focus:border-accent-glow">
              <option value="">—</option>
              <option value="gilles">Gilles</option>
              <option value="lea">Léa</option>
              <option value="damien">Damien</option>
              <option value="client">Client</option>
              <option value="autre">Autre</option>
            </select>
          </div>

          <details>
            <summary className="cursor-pointer micro-label text-text-muted hover:text-text-primary">Liens externes (optionnel)</summary>
            <div className="mt-2 space-y-2">
              <input value={githubIssueUrl} onChange={(e) => setGithubIssueUrl(e.target.value)} placeholder="GitHub issue URL" className="w-full bg-surface-2 border border-border-subtle text-sm py-2 px-3 text-text-primary focus:outline-none focus:border-accent-glow" />
              <input value={githubPrUrl} onChange={(e) => setGithubPrUrl(e.target.value)} placeholder="GitHub PR URL" className="w-full bg-surface-2 border border-border-subtle text-sm py-2 px-3 text-text-primary focus:outline-none focus:border-accent-glow" />
              <input value={vercelDeploymentUrl} onChange={(e) => setVercelDeploymentUrl(e.target.value)} placeholder="Vercel deployment URL" className="w-full bg-surface-2 border border-border-subtle text-sm py-2 px-3 text-text-primary focus:outline-none focus:border-accent-glow" />
              <input value={whatsappThreadRef} onChange={(e) => setWhatsappThreadRef(e.target.value)} placeholder="Réf WhatsApp (JID/msgId)" className="w-full bg-surface-2 border border-border-subtle text-sm py-2 px-3 text-text-primary focus:outline-none focus:border-accent-glow" />
            </div>
          </details>

          <div>
            <label className="block micro-label text-text-muted mb-1.5">Échéance</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full bg-surface-2 border border-border-subtle text-sm py-2.5 px-3 text-text-primary focus:outline-none focus:border-accent-glow"
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

          {/* Client (lecture seule — résolu via projet) */}
          <div className="rounded-sm border border-border-subtle bg-surface-2/50 p-3 space-y-1">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-text-muted">
              <User className="w-3 h-3" />
              <span>Client lié</span>
            </div>
            <p className="text-xs text-text-primary truncate">
              {projectInfo?.clientName || "(aucun client rattaché au projet)"}
            </p>
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-text-muted pt-1">
              <Briefcase className="w-3 h-3" />
              <span>Projet</span>
            </div>
            <p className="text-xs text-text-secondary truncate font-mono">
              {projectInfo?.ref || task.projectRef || "—"}
            </p>
          </div>

          {error && <div className="text-[11px] text-red-400">{error}</div>}

          <div className="flex items-center justify-between gap-2 pt-2">
            <button
              type="button"
              onClick={handleDelete}
              disabled={busy}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-[10px] font-bold uppercase tracking-widest border text-status-danger bg-status-danger/10 hover:bg-status-danger/20 border-status-danger/30 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Supprimer définitivement cette tâche"
            >
              {deleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
              Supprimer
            </button>
            <div className="flex items-center gap-2">
              {task.status !== "done" && (
                <button
                  type="button"
                  onClick={handleMarkDone}
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-[10px] font-bold uppercase tracking-widest border text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Marquer cette tâche terminée"
                >
                  {completing ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                  Terminer
                </button>
              )}
              <button
                type="submit"
                disabled={busy || !label.trim() || !fkProject}
                className="px-4 py-2 bg-accent-primary hover:bg-accent-primary/80 disabled:opacity-50 disabled:cursor-not-allowed text-white text-[11px] font-bold uppercase tracking-widest transition-colors flex items-center gap-1.5"
              >
                {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                Enregistrer
              </button>
            </div>
          </div>
        </form>
      </aside>
    </div>
  );
}
