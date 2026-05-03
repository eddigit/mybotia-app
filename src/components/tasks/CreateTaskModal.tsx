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
          priority: form.get("priority") || "0",
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
        <FormField label="Projet *">
          <select
            name="fk_project"
            required
            className={selectClass}
            value={fkProject}
            onChange={(e) => setFkProject(e.target.value)}
          >
            <option value="">— Choisir un projet —</option>
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
            <select name="priority" className={selectClass} defaultValue="0">
              <option value="0">Basse</option>
              <option value="1">Moyenne</option>
              <option value="2">Haute</option>
            </select>
          </FormField>
        </div>
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
