"use client";

// Bloc 5D — modal de création tâche partagée /today + /tasks.
// tenant_slug forcé côté caller (default "mybotia"). Le serveur revalide.
// V1.1.H.1 P0-UX-2 — anti-perte de saisie : draft localStorage + modal session expirée.

import { useEffect, useMemo, useState } from "react";
import { Loader2, RotateCcw, X } from "lucide-react";
import {
  FormModal,
  FormField,
  inputClass,
  selectClass,
  btnPrimary,
  btnSecondary,
} from "@/components/shared/FormModal";
import { useScopedProjects } from "@/hooks/use-api";
import { useFormDraft } from "@/hooks/use-form-draft";

const DRAFT_KEY = "draft:create-task";

type TaskDraft = {
  label: string;
  fkProject: string;
  description: string;
  date_end: string;
  priority_label: string;
  assignedTo: string;
  category: string;
  workflowStep: string;
  githubIssueUrl: string;
  githubPrUrl: string;
  vercelDeploymentUrl: string;
  whatsappThreadRef: string;
};

const emptyDraft: TaskDraft = {
  label: "",
  fkProject: "",
  description: "",
  date_end: "",
  priority_label: "medium",
  assignedTo: "",
  category: "",
  workflowStep: "",
  githubIssueUrl: "",
  githubPrUrl: "",
  vercelDeploymentUrl: "",
  whatsappThreadRef: "",
};

export function CreateTaskModal({
  open,
  onClose,
  onCreated,
  tenantSlug = "mybotia",
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  tenantSlug?: string;
}) {
  // Bloc 5G-bis : scope serveur via hostname. Le param tenantSlug ne sert
  // plus qu'à un filtre défensif côté frontend (ceinture+bretelles).
  const { data: projects } = useScopedProjects();

  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [draft, setDraft] = useState<TaskDraft>(emptyDraft);
  const { hasDraft, clearDraft } = useFormDraft(DRAFT_KEY, draft, setDraft);
  const [draftBannerDismissed, setDraftBannerDismissed] = useState(false);

  const fkProject = draft.fkProject;
  const setFkProject = (v: string) => setDraft((d) => ({ ...d, fkProject: v }));

  // When modal closes, reset dismiss flag so banner shows again on next open
  useEffect(() => {
    if (!open) setDraftBannerDismissed(false);
  }, [open]);

  const tenantProjects = useMemo(
    () =>
      [...projects]
        .filter((p) => p.status === "active")
        .filter((p) => p.tenantSlug === tenantSlug)
        .sort((a, b) => {
          if (a.ref === "PERSO") return -1;
          if (b.ref === "PERSO") return 1;
          return (a.ref || a.name).localeCompare(b.ref || b.name);
        }),
    [projects, tenantSlug]
  );

  const selectedProject = tenantProjects.find((p) => p.id === fkProject);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      const dueRaw = draft.date_end;
      const dueTs = dueRaw
        ? Math.floor(new Date(`${dueRaw}T23:59:59`).getTime() / 1000)
        : "";

      // Bloc 5G-bis : pas de tenant_slug body — le hostname décide.
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: draft.label,
          fk_project: draft.fkProject,
          description: draft.description || "",
          date_end: dueTs || "",
          // V1.1.B agence digitale — priority business (low/medium/high/urgent)
          priority: draft.priority_label || "medium",
          assignedTo: draft.assignedTo || null,
          category: draft.category || null,
          workflowStep: draft.workflowStep || null,
          githubIssueUrl: draft.githubIssueUrl || null,
          githubPrUrl: draft.githubPrUrl || null,
          vercelDeploymentUrl: draft.vercelDeploymentUrl || null,
          whatsappThreadRef: draft.whatsappThreadRef || null,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `HTTP ${res.status}`);
      }
      // V1.1.H.1 — submit success : nettoyer le brouillon
      clearDraft();
      setDraft(emptyDraft);
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur création");
    } finally {
      setCreating(false);
    }
  }

  return (
    <FormModal open={open} onClose={onClose} title="Nouvelle tâche">
      {/* V1.1.H.1 — ruban brouillon restauré */}
      {hasDraft && !draftBannerDismissed && (
        <div className="flex items-center justify-between gap-2 mb-3 px-3 py-2 bg-amber-400/10 border border-amber-400/30 text-amber-300 text-[11px]">
          <span className="flex items-center gap-1.5">
            <RotateCcw className="w-3 h-3" />
            Brouillon restauré
          </span>
          <button
            type="button"
            onClick={() => { clearDraft(); setDraft(emptyDraft); setDraftBannerDismissed(true); }}
            className="flex items-center gap-0.5 hover:text-amber-100"
            title="Effacer le brouillon"
          >
            <X className="w-3 h-3" /> Effacer
          </button>
        </div>
      )}
      <form onSubmit={handleSubmit}>
        <FormField label="Titre *">
          <input
            name="label"
            required
            className={inputClass}
            placeholder="Décrire la tâche..."
            value={draft.label}
            onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))}
          />
        </FormField>
        <FormField label="Affaire *">
          <select
            name="fk_project"
            required
            className={selectClass}
            value={fkProject}
            onChange={(e) => setFkProject(e.target.value)}
          >
            <option value="">— Choisir une affaire —</option>
            {tenantProjects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.ref ? `${p.ref} — ` : ""}
                {p.name}
              </option>
            ))}
          </select>
        </FormField>
        {selectedProject && (
          <p className="text-[10px] text-text-muted -mt-2 mb-3 truncate">
            Client lié : {selectedProject.clientName || "(aucun)"}
          </p>
        )}
        <FormField label="Description">
          <textarea
            name="description"
            className={inputClass}
            rows={3}
            placeholder="Détails..."
            value={draft.description}
            onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
          />
        </FormField>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Échéance">
            <input
              name="date_end"
              type="date"
              className={inputClass}
              value={draft.date_end}
              onChange={(e) => setDraft((d) => ({ ...d, date_end: e.target.value }))}
            />
          </FormField>
          <FormField label="Priorité">
            <select
              name="priority_label"
              className={selectClass}
              value={draft.priority_label}
              onChange={(e) => setDraft((d) => ({ ...d, priority_label: e.target.value }))}
            >
              <option value="low">Basse</option>
              <option value="medium">Moyenne</option>
              <option value="high">Haute</option>
              <option value="urgent">Urgent</option>
            </select>
          </FormField>
        </div>

        {/* V1.1.B agence digitale */}
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Catégorie">
            <select
              name="category"
              className={selectClass}
              value={draft.category}
              onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))}
            >
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
          </FormField>
          <FormField label="Étape workflow">
            <select
              name="workflowStep"
              className={selectClass}
              value={draft.workflowStep}
              onChange={(e) => setDraft((d) => ({ ...d, workflowStep: e.target.value }))}
            >
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
          </FormField>
        </div>

        <FormField label="Assigné à">
          <select
            name="assignedTo"
            className={selectClass}
            value={draft.assignedTo}
            onChange={(e) => setDraft((d) => ({ ...d, assignedTo: e.target.value }))}
          >
            <option value="">—</option>
            <option value="gilles">Gilles</option>
            <option value="lea">Léa</option>
            <option value="damien">Damien</option>
            <option value="client">Client</option>
            <option value="autre">Autre</option>
          </select>
        </FormField>

        <details className="mt-2 text-xs">
          <summary className="cursor-pointer text-text-muted hover:text-text-primary">Liens externes (optionnel)</summary>
          <div className="mt-2 grid grid-cols-1 gap-3">
            <FormField label="GitHub issue">
              <input
                name="githubIssueUrl"
                placeholder="https://github.com/.../issues/123"
                className={inputClass}
                value={draft.githubIssueUrl}
                onChange={(e) => setDraft((d) => ({ ...d, githubIssueUrl: e.target.value }))}
              />
            </FormField>
            <FormField label="GitHub PR">
              <input
                name="githubPrUrl"
                placeholder="https://github.com/.../pull/456"
                className={inputClass}
                value={draft.githubPrUrl}
                onChange={(e) => setDraft((d) => ({ ...d, githubPrUrl: e.target.value }))}
              />
            </FormField>
            <FormField label="Vercel deployment">
              <input
                name="vercelDeploymentUrl"
                placeholder="https://...-vercel.app"
                className={inputClass}
                value={draft.vercelDeploymentUrl}
                onChange={(e) => setDraft((d) => ({ ...d, vercelDeploymentUrl: e.target.value }))}
              />
            </FormField>
            <FormField label="Réf WhatsApp">
              <input
                name="whatsappThreadRef"
                placeholder="JID ou ID message"
                className={inputClass}
                value={draft.whatsappThreadRef}
                onChange={(e) => setDraft((d) => ({ ...d, whatsappThreadRef: e.target.value }))}
              />
            </FormField>
          </div>
        </details>

        {error && <p className="text-[11px] text-red-400 mt-2">{error}</p>}
        <div className="flex items-center justify-end gap-3 mt-6">
          <button type="button" onClick={onClose} className={btnSecondary}>
            Annuler
          </button>
          <button type="submit" disabled={creating} className={btnPrimary}>
            {creating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Créer
          </button>
        </div>
      </form>
    </FormModal>
  );
}
