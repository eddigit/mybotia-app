"use client";

// V1.1.B Phase 2 A4 — Modal d'édition projet.
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
    <FormModal open={open} onClose={onClose} title="Modifier le projet">
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
