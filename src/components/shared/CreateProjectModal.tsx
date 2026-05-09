"use client";

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
import { useScopedClients } from "@/hooks/use-api";

export function CreateProjectModal({
  open,
  onClose,
  onCreated,
  defaultClientId,
  lockClient = false,
}: {
  open: boolean;
  onClose: () => void;
  onCreated?: (projectId: string) => void;
  defaultClientId?: string;
  lockClient?: boolean;
}) {
  const { data: clients } = useScopedClients();
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    const refValue = String(form.get("ref") || "").trim() || "auto";
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.get("title"),
          ref: refValue,
          socid: form.get("socid") || "",
          description: form.get("description") || "",
          date_start: form.get("date_start") || "",
          date_end: form.get("date_end") || "",
          budget_amount: form.get("budget_amount") || "",
          // V1.1.B agence digitale
          projectType: String(form.get("projectType") || "") || null,
          priority: String(form.get("priority") || "") || null,
          repoGithubUrl: String(form.get("repoGithubUrl") || "") || null,
          vercelProjectUrl: String(form.get("vercelProjectUrl") || "") || null,
          productionUrl: String(form.get("productionUrl") || "") || null,
          stagingUrl: String(form.get("stagingUrl") || "") || null,
          domain: String(form.get("domain") || "") || null,
          nextAction: String(form.get("nextAction") || "") || null,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json?.error || "Erreur lors de la creation de l'affaire");
        return;
      }
      onCreated?.(String(json.id));
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur reseau");
    } finally {
      setCreating(false);
    }
  }

  return (
    <FormModal open={open} onClose={onClose} title="Nouvelle affaire">
      <form onSubmit={handleSubmit}>
        <FormField label="Titre *">
          <input
            name="title"
            required
            className={inputClass}
            placeholder="Ex: Refonte site Cabinet Martin"
          />
        </FormField>

        <div className="grid grid-cols-2 gap-4">
          <FormField label="Reference">
            <input
              name="ref"
              className={inputClass}
              placeholder="auto"
            />
          </FormField>
          <FormField label="Client">
            {/* Fix bug 2026-05-03 (BYRON) : un <select disabled> n'est pas inclus
                dans le FormData. En mode lockClient (création depuis fiche client),
                on porte la valeur via un input hidden pour garantir socid envoyé. */}
            {lockClient && defaultClientId && (
              <input type="hidden" name="socid" value={defaultClientId} />
            )}
            <select
              name={lockClient ? "_socid_display" : "socid"}
              className={selectClass}
              defaultValue={defaultClientId ?? ""}
              disabled={lockClient}
            >
              <option value="">-- Aucun --</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.company || c.name}
                </option>
              ))}
            </select>
          </FormField>
        </div>

        <FormField label="Description">
          <textarea
            name="description"
            className={inputClass}
            rows={3}
            placeholder="Objectifs, perimetre..."
          />
        </FormField>

        <div className="grid grid-cols-2 gap-4">
          <FormField label="Date debut">
            <input name="date_start" type="date" className={inputClass} />
          </FormField>
          <FormField label="Date fin">
            <input name="date_end" type="date" className={inputClass} />
          </FormField>
        </div>

        <FormField label="Budget (EUR)">
          <input
            name="budget_amount"
            type="number"
            step="0.01"
            min="0"
            className={inputClass}
            placeholder="0"
          />
        </FormField>

        {/* V1.1.B agence digitale */}
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Type">
            <select name="projectType" defaultValue="" className={selectClass}>
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
            <select name="priority" defaultValue="" className={selectClass}>
              <option value="">—</option>
              <option value="normale">Normale</option>
              <option value="haute">Haute</option>
              <option value="vip">VIP</option>
            </select>
          </FormField>
        </div>

        <FormField label="Prochaine action">
          <input name="nextAction" placeholder="Ex: kickoff client" className={inputClass} />
        </FormField>

        <div className="grid grid-cols-2 gap-4">
          <FormField label="Repo GitHub">
            <input name="repoGithubUrl" placeholder="https://github.com/..." className={inputClass} />
          </FormField>
          <FormField label="Projet Vercel">
            <input name="vercelProjectUrl" placeholder="https://vercel.com/..." className={inputClass} />
          </FormField>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField label="URL production">
            <input name="productionUrl" placeholder="https://..." className={inputClass} />
          </FormField>
          <FormField label="URL staging">
            <input name="stagingUrl" placeholder="https://staging..." className={inputClass} />
          </FormField>
        </div>

        <FormField label="Domaine">
          <input name="domain" placeholder="exemple.com" className={inputClass} />
        </FormField>

        {error && (
          <p className="text-xs text-red-400 mb-3">{error}</p>
        )}

        <div className="flex items-center justify-end gap-3 mt-6">
          <button type="button" onClick={onClose} className={btnSecondary}>
            Annuler
          </button>
          <button type="submit" disabled={creating} className={btnPrimary}>
            {creating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Creer
          </button>
        </div>
      </form>
    </FormModal>
  );
}
