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
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json?.error || "Erreur lors de la creation du projet");
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
    <FormModal open={open} onClose={onClose} title="Nouveau projet">
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
