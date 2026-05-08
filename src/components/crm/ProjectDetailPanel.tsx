"use client";

// V1.1.B Phase 3C — Projects Command Center.
// Panel latéral drill-down d'un projet (pattern DealDetailPanel adapté projets).
//
// Charge GET /api/projects/[id] pour récupérer description + proposals + invoices
// + flag deleteAllowed. Charge GET /api/tasks puis filtre côté client par
// projectId pour la section tâches (pas d'endpoint dédié côté Platform).
//
// Actions :
//   - Modifier projet → réutilise EditProjectModal existant
//   - Créer tâche liée → CreateTaskModal (projet pré-selectionné via setter local)
//   - Voir toutes les tâches → /tasks?projectId={id}
//   - Supprimer (uniquement si deleteAllowed)

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  X,
  Loader2,
  Code,
  ExternalLink,
  Globe,
  FlaskConical,
  Calendar,
  Sparkles,
  CheckSquare,
  FileText,
  Receipt,
  Pencil,
  Plus,
  ListChecks,
  Trash2,
  ShieldAlert,
  AlertCircle,
  Building2,
  Tag,
  Flag,
} from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { EditProjectModal } from "@/components/shared/EditProjectModal";
import { CreateTaskModal } from "@/components/tasks/CreateTaskModal";
import type { Project } from "@/types";
import type { TaskItem } from "@/hooks/use-api";

interface ProjectDetail {
  description: string;
  proposals: Array<{ id: string; ref: string; total: number; status: string; date: string | number | null }>;
  invoices: Array<{ id: string; ref: string; total: number; status: string; paye: string; date: string | number | null }>;
  deleteAllowed: boolean;
  deleteBlockedReason: string | null;
  isTestProject: boolean;
}

const STATUS_LABEL: Record<string, string> = {
  active: "Actif",
  paused: "En pause",
  completed: "Terminé",
};

const STATUS_BADGE_CLASS: Record<string, string> = {
  active: "bg-emerald-400/15 text-emerald-300 border-emerald-400/30",
  paused: "bg-amber-400/15 text-amber-300 border-amber-400/30",
  completed: "bg-surface-3/60 text-text-muted border-border-subtle",
};

const PRIORITY_LABEL: Record<string, string> = {
  vip: "VIP",
  haute: "Haute",
  normale: "Normale",
};

const PRIORITY_BADGE_CLASS: Record<string, string> = {
  vip: "bg-amber-400/15 text-amber-300 border-amber-400/30",
  haute: "bg-rose-400/15 text-rose-300 border-rose-400/30",
  normale: "bg-surface-3/60 text-text-muted border-border-subtle",
};

const TASK_STATUS_BADGE: Record<string, string> = {
  todo: "bg-surface-3 text-text-muted border-border-subtle",
  in_progress: "bg-accent-primary/15 text-accent-glow border-accent-primary/30",
  done: "bg-emerald-400/15 text-emerald-300 border-emerald-400/30",
  blocked: "bg-rose-400/15 text-rose-300 border-rose-400/30",
};

const TASK_STATUS_LABEL: Record<string, string> = {
  todo: "À faire",
  in_progress: "En cours",
  done: "Terminée",
  blocked: "Bloquée",
};

function formatDate(iso?: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

export function ProjectDetailPanel({
  project,
  onClose,
  onSaved,
}: {
  project: Project | null;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const [detail, setDetail] = useState<ProjectDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(true);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [tasksReloadKey, setTasksReloadKey] = useState(0);
  const [showEdit, setShowEdit] = useState(false);
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTyped, setDeleteTyped] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const expectedConfirm = project ? `SUPPRIMER ${project.name.slice(0, 30).toUpperCase()}` : "";

  // Reset state quand on change de projet
  useEffect(() => {
    setDetail(null);
    setTasks([]);
    setShowEdit(false);
    setShowCreateTask(false);
    setShowDeleteConfirm(false);
    setDeleteTyped("");
    setError(null);
  }, [project?.id]);

  // Charge détail enrichi du projet
  useEffect(() => {
    let cancelled = false;
    if (!project?.id) {
      setLoadingDetail(false);
      return;
    }
    setLoadingDetail(true);
    fetch(`/api/projects/${encodeURIComponent(project.id)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((data) => {
        if (cancelled) return;
        setDetail({
          description: data.description || "",
          proposals: data.proposals || [],
          invoices: data.invoices || [],
          deleteAllowed: !!data.deleteAllowed,
          deleteBlockedReason: data.deleteBlockedReason || null,
          isTestProject: !!data.isTestProject,
        });
      })
      .catch(() => {
        if (!cancelled) {
          setDetail({
            description: project.description || "",
            proposals: [],
            invoices: [],
            deleteAllowed: false,
            deleteBlockedReason: "Détail projet indisponible.",
            isTestProject: false,
          });
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingDetail(false);
      });
    return () => {
      cancelled = true;
    };
  }, [project?.id, project?.description]);

  // Charge tâches du projet (filtre côté client)
  useEffect(() => {
    let cancelled = false;
    if (!project?.id) {
      setLoadingTasks(false);
      return;
    }
    setLoadingTasks(true);
    fetch("/api/tasks")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((data: TaskItem[]) => {
        if (cancelled) return;
        const filtered = (Array.isArray(data) ? data : []).filter(
          (t) => t.projectId === project.id,
        );
        setTasks(filtered);
      })
      .catch(() => {
        if (!cancelled) setTasks([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingTasks(false);
      });
    return () => {
      cancelled = true;
    };
  }, [project?.id, tasksReloadKey]);

  const links = useMemo(() => {
    if (!project) return [];
    const out: Array<{ url: string; icon: React.ComponentType<{ className?: string }>; title: string }> = [];
    if (project.repoGithubUrl) out.push({ url: project.repoGithubUrl, icon: Code, title: "GitHub" });
    if (project.vercelProjectUrl) out.push({ url: project.vercelProjectUrl, icon: ExternalLink, title: "Vercel" });
    if (project.productionUrl) out.push({ url: project.productionUrl, icon: Globe, title: "Production" });
    if (project.stagingUrl) out.push({ url: project.stagingUrl, icon: FlaskConical, title: "Staging" });
    if (project.domain) out.push({ url: `https://${project.domain.replace(/^https?:\/\//, "")}`, icon: Globe, title: project.domain });
    return out;
  }, [project]);

  async function handleDelete() {
    if (!project?.id) return;
    if (deleteTyped.trim() !== expectedConfirm) {
      setError(`Tape exactement : ${expectedConfirm}`);
      return;
    }
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(project.id)}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: deleteTyped }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.reason || data?.error || `Erreur (${res.status})`);
        return;
      }
      if (onSaved) onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur réseau");
    } finally {
      setDeleting(false);
    }
  }

  if (!project) return null;

  const dueLabel = formatDate(project.dueDate);
  const priorityKey = project.priority?.toLowerCase();

  return (
    <>
      <div className="fixed inset-0 z-[80] bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <aside className="fixed top-0 right-0 z-[81] w-full max-w-lg h-full bg-surface-1 border-l border-border-default shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-6 py-5 border-b border-border-subtle shrink-0">
          <div className="min-w-0 flex-1">
            <span className="text-[10px] uppercase tracking-wider text-text-muted font-semibold">
              Projet
            </span>
            <h2 className="text-base font-bold text-text-primary leading-tight mt-0.5 break-words">
              {project.name}
            </h2>
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              <span className={cn(
                "px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-tight border",
                STATUS_BADGE_CLASS[project.status] || STATUS_BADGE_CLASS.active,
              )}>
                {STATUS_LABEL[project.status] || project.status}
              </span>
              {priorityKey && PRIORITY_LABEL[priorityKey] && (
                <span className={cn(
                  "px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-tight border",
                  PRIORITY_BADGE_CLASS[priorityKey],
                )}>
                  {PRIORITY_LABEL[priorityKey]}
                </span>
              )}
              {project.projectType && (
                <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-tight border bg-surface-3/60 text-text-muted border-border-subtle">
                  {project.projectType.replace(/_/g, " ")}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex items-center justify-center w-7 h-7 bg-surface-3 hover:bg-surface-2 text-text-muted hover:text-text-primary transition-all"
            title="Fermer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Section client */}
          {project.clientName && (
            <div className="space-y-1">
              <div className="text-[10px] uppercase tracking-wider text-text-muted font-semibold flex items-center gap-1">
                <Building2 className="w-3 h-3" /> Client
              </div>
              {project.clientId ? (
                <Link
                  href={`/crm/${encodeURIComponent(project.clientId)}`}
                  className="inline-flex items-center gap-1 text-sm text-accent-glow hover:underline"
                >
                  {project.clientName}
                  <ExternalLink className="w-3 h-3" />
                </Link>
              ) : (
                <span className="text-sm text-text-primary">{project.clientName}</span>
              )}
            </div>
          )}

          {/* Section meta */}
          <div className="grid grid-cols-2 gap-3 text-[11px]">
            {project.nextAction && (
              <div className="col-span-2">
                <div className="text-[10px] uppercase tracking-wider text-text-muted font-semibold flex items-center gap-1 mb-1">
                  <Sparkles className="w-3 h-3" /> Prochaine action
                </div>
                <div className="text-text-primary leading-snug">{project.nextAction}</div>
              </div>
            )}

            {dueLabel && (
              <div>
                <div className="text-[10px] uppercase tracking-wider text-text-muted font-semibold flex items-center gap-1 mb-1">
                  <Calendar className="w-3 h-3" /> Échéance
                </div>
                <div className="text-text-primary">{dueLabel}</div>
              </div>
            )}

            {project.projectType && (
              <div>
                <div className="text-[10px] uppercase tracking-wider text-text-muted font-semibold flex items-center gap-1 mb-1">
                  <Tag className="w-3 h-3" /> Type
                </div>
                <div className="text-text-primary capitalize">{project.projectType.replace(/_/g, " ")}</div>
              </div>
            )}

            {priorityKey && PRIORITY_LABEL[priorityKey] && (
              <div>
                <div className="text-[10px] uppercase tracking-wider text-text-muted font-semibold flex items-center gap-1 mb-1">
                  <Flag className="w-3 h-3" /> Priorité
                </div>
                <div className="text-text-primary">{PRIORITY_LABEL[priorityKey]}</div>
              </div>
            )}
          </div>

          {/* Section liens externes */}
          {links.length > 0 && (
            <div className="space-y-2 pt-3 border-t border-border-subtle">
              <div className="text-[10px] uppercase tracking-wider text-text-muted font-semibold">
                Liens externes
              </div>
              <div className="flex flex-wrap gap-2">
                {links.map(({ url, icon: Icon, title }) => (
                  <a
                    key={`${title}-${url}`}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-tight bg-accent-primary/10 hover:bg-accent-primary/20 border border-accent-primary/30 text-accent-glow"
                  >
                    <Icon className="w-3 h-3" />
                    {title}
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Section description */}
          {!loadingDetail && detail?.description && (
            <div className="space-y-1 pt-3 border-t border-border-subtle">
              <div className="text-[10px] uppercase tracking-wider text-text-muted font-semibold">
                Description
              </div>
              <p className="text-[12px] text-text-secondary whitespace-pre-wrap leading-relaxed">
                {detail.description}
              </p>
            </div>
          )}

          {/* Section tâches */}
          <div className="space-y-2 pt-3 border-t border-border-subtle">
            <div className="flex items-center justify-between">
              <div className="text-[10px] uppercase tracking-wider text-text-muted font-semibold flex items-center gap-1">
                <CheckSquare className="w-3 h-3" />
                Tâches ({tasks.length})
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setShowCreateTask(true)}
                  className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-bold uppercase tracking-tight bg-accent-primary/10 hover:bg-accent-primary/20 border border-accent-primary/30 text-accent-glow"
                >
                  <Plus className="w-3 h-3" />
                  Créer
                </button>
                <Link
                  href={`/tasks?projectId=${encodeURIComponent(project.id)}`}
                  className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-bold uppercase tracking-tight bg-surface-3/60 hover:bg-surface-3 border border-border-subtle text-text-secondary hover:text-text-primary"
                >
                  <ListChecks className="w-3 h-3" />
                  Voir tout
                </Link>
              </div>
            </div>

            {loadingTasks ? (
              <div className="flex items-center gap-2 text-[11px] text-text-muted py-2">
                <Loader2 className="w-3 h-3 animate-spin" /> Chargement…
              </div>
            ) : tasks.length === 0 ? (
              <div className="text-[11px] text-text-muted py-2 italic">
                Aucune tâche pour ce projet.
              </div>
            ) : (
              <div className="space-y-1">
                {tasks.slice(0, 10).map((t) => {
                  const sBadge = TASK_STATUS_BADGE[t.status] || TASK_STATUS_BADGE.todo;
                  const sLabel = TASK_STATUS_LABEL[t.status] || t.status;
                  return (
                    <div
                      key={t.id}
                      className="flex items-start justify-between gap-2 py-1.5 px-2 bg-surface-2/40 border border-border-subtle text-[11px]"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-text-primary truncate font-medium">{t.title}</div>
                        {(t as TaskItem & { assignedTo?: string }).assignedTo && (
                          <div className="text-[10px] text-text-muted">
                            {(t as TaskItem & { assignedTo?: string }).assignedTo}
                          </div>
                        )}
                      </div>
                      <span className={cn(
                        "shrink-0 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-tight border whitespace-nowrap",
                        sBadge,
                      )}>
                        {sLabel}
                      </span>
                    </div>
                  );
                })}
                {tasks.length > 10 && (
                  <Link
                    href={`/tasks?projectId=${encodeURIComponent(project.id)}`}
                    className="block text-center text-[10px] text-text-muted hover:text-accent-glow underline-offset-2 hover:underline pt-1"
                  >
                    +{tasks.length - 10} autres tâches…
                  </Link>
                )}
              </div>
            )}
          </div>

          {/* Documents liés (devis/factures) */}
          {detail && (detail.proposals.length > 0 || detail.invoices.length > 0) && (
            <div className="space-y-2 pt-3 border-t border-border-subtle">
              <div className="text-[10px] uppercase tracking-wider text-text-muted font-semibold">
                Documents liés
              </div>
              {detail.proposals.length > 0 && (
                <div className="space-y-1">
                  {detail.proposals.map((p) => (
                    <div
                      key={`prop-${p.id}`}
                      className="flex items-center justify-between gap-2 text-[11px] py-1.5 px-2 bg-surface-2/50 border border-border-subtle"
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <FileText className="w-3 h-3 text-text-muted shrink-0" />
                        <span className="font-mono text-text-primary truncate">{p.ref}</span>
                        <span className="text-text-muted">devis</span>
                      </div>
                      <span className="text-text-secondary font-semibold shrink-0">
                        {formatCurrency(p.total)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {detail.invoices.length > 0 && (
                <div className="space-y-1">
                  {detail.invoices.map((inv) => (
                    <div
                      key={`inv-${inv.id}`}
                      className="flex items-center justify-between gap-2 text-[11px] py-1.5 px-2 bg-surface-2/50 border border-border-subtle"
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Receipt className="w-3 h-3 text-text-muted shrink-0" />
                        <span className="font-mono text-text-primary truncate">{inv.ref}</span>
                        <span className={cn(
                          "uppercase",
                          inv.paye === "1" ? "text-emerald-300" : "text-text-muted",
                        )}>
                          {inv.paye === "1" ? "payée" : "facture"}
                        </span>
                      </div>
                      <span className="text-text-secondary font-semibold shrink-0">
                        {formatCurrency(inv.total)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Bandeau garde-fous suppression */}
          {detail && !detail.deleteAllowed && detail.deleteBlockedReason && (
            <div className="flex items-start gap-1.5 text-[11px] text-amber-300 bg-amber-400/10 border border-amber-400/30 px-2 py-1.5">
              <ShieldAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>
                <span className="font-bold uppercase tracking-wider">Suppression interdite</span>
                {" — "}
                {detail.deleteBlockedReason}
              </span>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex flex-col gap-2 px-6 py-4 border-t border-border-subtle bg-surface-0/50 shrink-0">
          {error && (
            <div className="flex items-start gap-1.5 text-[11px] text-status-danger">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {showDeleteConfirm && (
            <div className="flex flex-col gap-2 p-2 border border-status-danger/30 bg-status-danger/5">
              <div className="flex items-start gap-1.5 text-[11px] text-status-danger">
                <ShieldAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>
                  Pour confirmer, tape exactement :
                  <span className="font-mono font-bold ml-1">{expectedConfirm}</span>
                </span>
              </div>
              <input
                type="text"
                value={deleteTyped}
                onChange={(e) => setDeleteTyped(e.target.value)}
                placeholder={expectedConfirm}
                className="w-full bg-surface-2 border border-status-danger/30 text-sm text-text-primary px-3 py-1.5 font-mono focus:outline-none focus:border-status-danger/60"
                autoFocus
              />
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setDeleteTyped("");
                    setError(null);
                  }}
                  className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-tight text-text-muted hover:text-text-primary"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting || deleteTyped.trim() !== expectedConfirm}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-tight transition-all border",
                    deleteTyped.trim() === expectedConfirm && !deleting
                      ? "text-status-danger bg-status-danger/10 hover:bg-status-danger/20 border-status-danger/30"
                      : "text-text-muted bg-surface-3/50 border-border-subtle cursor-not-allowed",
                  )}
                >
                  {deleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                  Confirmer
                </button>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              {detail?.deleteAllowed && (
                <button
                  type="button"
                  onClick={() => {
                    setShowDeleteConfirm(true);
                    setError(null);
                  }}
                  disabled={showDeleteConfirm || deleting}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-[10px] font-bold uppercase tracking-tight border text-status-danger bg-status-danger/10 hover:bg-status-danger/20 border-status-danger/30 disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Suppression définitive — confirmation forte requise"
                >
                  <Trash2 className="w-3 h-3" />
                  Supprimer…
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-[11px] font-bold uppercase tracking-tight text-text-muted hover:text-text-primary"
              >
                Fermer
              </button>
              <button
                type="button"
                onClick={() => setShowEdit(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-[11px] font-bold uppercase tracking-tight transition-all border text-accent-glow bg-accent-primary/10 hover:bg-accent-primary/20 border-accent-primary/30"
              >
                <Pencil className="w-3 h-3" />
                Modifier
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Modale édition */}
      <EditProjectModal
        open={showEdit}
        onClose={() => setShowEdit(false)}
        onSaved={() => {
          setShowEdit(false);
          if (onSaved) onSaved();
        }}
        project={project}
      />

      {/* Modale création tâche liée */}
      <CreateTaskModal
        open={showCreateTask}
        onClose={() => setShowCreateTask(false)}
        onCreated={() => {
          setShowCreateTask(false);
          setTasksReloadKey((k) => k + 1);
        }}
        tenantSlug={project.tenantSlug || "mybotia"}
      />
    </>
  );
}
