"use client";

// Bloc 5D — modal de création tâche partagée /today + /tasks.
// tenant_slug forcé côté caller (default "mybotia"). Le serveur revalide.

import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  FormModal,
  FormField,
  inputClass,
  selectClass,
  btnPrimary,
  btnSecondary,
} from "@/components/shared/FormModal";
import { useScopedProjects } from "@/hooks/use-api";

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
  const [fkProject, setFkProject] = useState<string>("");

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
    const form = new FormData(e.currentTarget);
    try {
      const dueRaw = (form.get("date_end") as string) || "";
      const dueTs = dueRaw
        ? Math.floor(new Date(`${dueRaw}T23:59:59`).getTime() / 1000)
        : "";

      // Bloc 5G-bis : pas de tenant_slug body — le hostname décide.
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: form.get("label"),
          fk_project: form.get("fk_project"),
          description: form.get("description") || "",
          date_end: dueTs || "",
          // V1.1.B agence digitale — priority business (low/medium/high/urgent)
          priority: String(form.get("priority_label") || "medium"),
          assignedTo: String(form.get("assignedTo") || "") || null,
          category: String(form.get("category") || "") || null,
          workflowStep: String(form.get("workflowStep") || "") || null,
          githubIssueUrl: String(form.get("githubIssueUrl") || "") || null,
          githubPrUrl: String(form.get("githubPrUrl") || "") || null,
          vercelDeploymentUrl: String(form.get("vercelDeploymentUrl") || "") || null,
          whatsappThreadRef: String(form.get("whatsappThreadRef") || "") || null,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `HTTP ${res.status}`);
      }
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
      <form onSubmit={handleSubmit}>
        <FormField label="Titre *">
          <input
            name="label"
            required
            className={inputClass}
            placeholder="Décrire la tâche..."
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
          />
        </FormField>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Échéance">
            <input name="date_end" type="date" className={inputClass} />
          </FormField>
          <FormField label="Priorité">
            <select name="priority_label" className={selectClass} defaultValue="medium">
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
            <select name="category" className={selectClass} defaultValue="">
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
            <select name="workflowStep" className={selectClass} defaultValue="">
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
          <select name="assignedTo" className={selectClass} defaultValue="">
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
              <input name="githubIssueUrl" placeholder="https://github.com/.../issues/123" className={inputClass} />
            </FormField>
            <FormField label="GitHub PR">
              <input name="githubPrUrl" placeholder="https://github.com/.../pull/456" className={inputClass} />
            </FormField>
            <FormField label="Vercel deployment">
              <input name="vercelDeploymentUrl" placeholder="https://...-vercel.app" className={inputClass} />
            </FormField>
            <FormField label="Réf WhatsApp">
              <input name="whatsappThreadRef" placeholder="JID ou ID message" className={inputClass} />
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
