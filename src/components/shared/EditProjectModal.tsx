"use client";

// V1.1.B Phase 2 A4 — Modal d'édition affaire (UI). Code = "project".
// PATCH /api/projects/[id] (Platform → crm-router → mybotia-business).
// Champs business V1 : name (titre), description, status, dueDate.

import { useState } from "react";
import { Loader2 } from "lucide-react";
import {
  FormModal,
  FormField,
  inputClass,
  selectClass,
  btnPrimary,
  btnSecondary,
} from "./FormModal";
import type { Project } from "@/types";

const STATUS_OPTIONS = [
  { value: "active", label: "Actif" },
  { value: "paused", label: "En pause" },
  { value: "completed", label: "Terminé" },
];

export function EditProjectModal({
  open,
  onClose,
  onSaved,
  project,
}: {
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
  project: Project | null;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!project) return null;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!project) return;
    setSaving(true);
    setError(null);
    const form = new FormData(e.currentTarget);

    // Mapping UI Platform → shape attendu côté business via mapInputProjectFromUi.
    // On envoie `title` (ce que mapInputProjectFromUi accepte comme alias de name)
    // pour rester cohérent avec CreateProjectModal et DealDetailPanel.
    const titleVal = String(form.get("title") || "").trim();
    const statusUi = String(form.get("status") || "active");
    // Project.status UI : active/paused/completed → business : active/paused/done
    const statusBusiness =
      statusUi === "completed" ? "done" : statusUi;
    const dueRaw = String(form.get("dueDate") || "").trim();

    const body: Record<string, unknown> = {};
    if (titleVal) body.title = titleVal;
    body.description = String(form.get("description") || "");
    body.status = statusBusiness;
    if (dueRaw) body.dueDate = dueRaw;

    // V1.1.B agence digitale
    const projectType = String(form.get("projectType") || "").trim();
    if (projectType) body.projectType = projectType;
    else body.projectType = null;

    const priority = String(form.get("priority") || "").trim();
    body.priority = priority || null;

    body.repoGithubUrl = String(form.get("repoGithubUrl") || "").trim() || null;
    body.vercelProjectUrl = String(form.get("vercelProjectUrl") || "").trim() || null;
    body.productionUrl = String(form.get("productionUrl") || "").trim() || null;
    body.stagingUrl = String(form.get("stagingUrl") || "").trim() || null;
    body.domain = String(form.get("domain") || "").trim() || null;
    body.nextAction = String(form.get("nextAction") || "").trim() || null;

    if (!titleVal) {
      setError("Le titre est requis.");
      setSaving(false);
      return;
    }

    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(project.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json?.error || `Erreur (${res.status})`);
        return;
      }
      onSaved?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur réseau");
    } finally {
      setSaving(false);
    }
  }

  return (
    <FormModal open={open} onClose={onClose} title="Modifier l'affaire">
      <form onSubmit={handleSubmit}>
        <FormField label="Titre *">
          <input
            name="title"
            required
            defaultValue={project.name || ""}
            className={inputClass}
          />
        </FormField>

        <FormField label="Description">
          <textarea
            name="description"
            rows={3}
            defaultValue={project.description || ""}
            className={inputClass}
          />
        </FormField>

        <div className="grid grid-cols-2 gap-4">
          <FormField label="Statut">
            <select
              name="status"
              defaultValue={project.status || "active"}
              className={selectClass}
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Échéance">
            <input
              name="dueDate"
              type="date"
              defaultValue={project.dueDate || ""}
              className={inputClass}
            />
          </FormField>
        </div>

        {/* V1.1.B agence digitale */}
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Type d'affaire">
            <select name="projectType" defaultValue={project.projectType ?? ""} className={selectClass}>
              <option value="">—</option>
              <option value="site_web">Site web</option>
              <option value="app_web">App web</option>
              <option value="collaborateur_ia">Collaborateur IA</option>
              <option value="automatisation">Automatisation</option>
              <option value="maintenance">Maintenance</option>
              <option value="audit">Audit</option>
            </select>
          </FormField>
          <FormField label="Priorité">
            <select name="priority" defaultValue={project.priority ?? ""} className={selectClass}>
              <option value="">—</option>
              <option value="normale">Normale</option>
              <option value="haute">Haute</option>
              <option value="vip">VIP</option>
            </select>
          </FormField>
        </div>

        <FormField label="Prochaine action">
          <input
            name="nextAction"
            defaultValue={project.nextAction ?? ""}
            placeholder="Ex: relancer client devis, déployer staging…"
            className={inputClass}
          />
        </FormField>

        <div className="grid grid-cols-2 gap-4">
          <FormField label="Repo GitHub">
            <input name="repoGithubUrl" defaultValue={project.repoGithubUrl ?? ""} placeholder="https://github.com/eddigit/..." className={inputClass} />
          </FormField>
          <FormField label="Projet Vercel">
            <input name="vercelProjectUrl" defaultValue={project.vercelProjectUrl ?? ""} placeholder="https://vercel.com/..." className={inputClass} />
          </FormField>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField label="URL production">
            <input name="productionUrl" defaultValue={project.productionUrl ?? ""} placeholder="https://exemple.com" className={inputClass} />
          </FormField>
          <FormField label="URL staging">
            <input name="stagingUrl" defaultValue={project.stagingUrl ?? ""} placeholder="https://staging.exemple.com" className={inputClass} />
          </FormField>
        </div>

        <FormField label="Domaine">
          <input name="domain" defaultValue={project.domain ?? ""} placeholder="exemple.com" className={inputClass} />
        </FormField>

        {error ? <p className="mt-2 text-sm text-red-400">{error}</p> : null}

        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onClose} className={btnSecondary}>
            Annuler
          </button>
          <button type="submit" disabled={saving} className={btnPrimary}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Enregistrer
          </button>
        </div>
      </form>
    </FormModal>
  );
}
