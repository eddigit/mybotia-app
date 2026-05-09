"use client";

// V1.1.D Phase 2 — Modale édition production.
// PATCH /api/productions/[id] (app proxy → biz /api/v1/productions/[id]).
//
// Champs métier V1.1.D :
//   - title          (mappé sur projects.name)
//   - status         (production_status : active|paused|done|cancelled|abandoned)
//   - dueDate        (livraison prévue, projects.due_date)
//   - nextAction     (prochaine action commerciale)
//
// owner_user_id : non persisté tant que la DDL ne l'expose pas (cf.
// projects-raw.ts), MAIS le contrat d'API l'accepte → on l'envoie quand même
// pour traçabilité audit_logs._intent.owner_user_id (forward-compat).

import { useState } from "react";
import { Loader2 } from "lucide-react";
import {
  FormModal,
  FormField,
  inputClass,
  selectClass,
  btnPrimary,
  btnSecondary,
} from "../shared/FormModal";

const STATUS_OPTIONS = [
  { value: "active", label: "En cours" },
  { value: "paused", label: "En pause" },
  { value: "done", label: "Livré" },
  { value: "cancelled", label: "Annulé" },
  { value: "abandoned", label: "Abandonné" },
];

export type EditableProduction = {
  id: string;
  name?: string;
  title?: string;
  status: string;
  dueDate?: string | null;
  due_date?: string | null;
  nextAction?: string | null;
  next_action?: string | null;
  ownerUserId?: string | null;
  owner_user_id?: string | null;
};

export function EditProductionModal({
  open,
  onClose,
  onSaved,
  production,
}: {
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
  production: EditableProduction | null;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!production) return null;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!production) return;
    setSaving(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    const title = String(form.get("title") || "").trim();
    if (!title) {
      setError("Le titre est requis.");
      setSaving(false);
      return;
    }
    const body: Record<string, string | null> = {
      title,
      status: String(form.get("status") || "active"),
      dueDate: String(form.get("dueDate") || "") || null,
      nextAction: String(form.get("nextAction") || "").trim() || null,
    };
    const ownerUserId = String(form.get("ownerUserId") || "").trim();
    if (ownerUserId) body.ownerUserId = ownerUserId;

    try {
      const res = await fetch(
        `/api/productions/${encodeURIComponent(production.id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
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

  const currentTitle = production.title ?? production.name ?? "";
  const currentDueDate = production.dueDate ?? production.due_date ?? "";
  const currentNextAction =
    production.nextAction ?? production.next_action ?? "";
  const currentOwner =
    production.ownerUserId ?? production.owner_user_id ?? "";

  return (
    <FormModal open={open} onClose={onClose} title="Modifier la production">
      <form onSubmit={handleSubmit}>
        <FormField label="Titre *">
          <input
            name="title"
            required
            defaultValue={currentTitle}
            className={inputClass}
          />
        </FormField>

        <div className="grid grid-cols-2 gap-4">
          <FormField label="Statut">
            <select
              name="status"
              defaultValue={production.status || "active"}
              className={selectClass}
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Livraison prévue">
            <input
              name="dueDate"
              type="date"
              defaultValue={currentDueDate ?? ""}
              className={inputClass}
            />
          </FormField>
        </div>

        <FormField label="Prochaine action">
          <textarea
            name="nextAction"
            rows={2}
            defaultValue={currentNextAction ?? ""}
            placeholder="Ex : valider le maquettage final…"
            className={inputClass}
          />
        </FormField>

        <FormField label="Owner (UUID utilisateur)">
          <input
            name="ownerUserId"
            defaultValue={currentOwner ?? ""}
            placeholder="(optionnel)"
            className={inputClass}
          />
        </FormField>

        {error ? (
          <p className="mt-2 text-sm text-red-400">{error}</p>
        ) : null}

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
