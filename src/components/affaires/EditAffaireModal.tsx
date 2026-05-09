"use client";

// V1.1.D Phase 2 — Modal "Modifier l'affaire" (cockpit app.mybotia.com).
// PATCH /api/affaires/[id]. Champs persistés côté business : title (->name),
// description, status, dueDate, projectType, priority, nextAction.
// Champs spec acceptés mais non persistés : ownerUserId, expectedCloseDate,
// oneshotAmountHt, mrrHt (cf. note V1.1.D dans projects-raw.ts).

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { z } from "zod";

import {
  FormModal,
  FormField,
  inputClass,
  selectClass,
  btnPrimary,
  btnSecondary,
} from "@/components/shared/FormModal";
import { toast } from "@/components/shared/Toast";
import type { AffaireRow } from "@/hooks/use-api";

const STAGE_OPTIONS = [
  { value: "lead", label: "Prospect" },
  { value: "qualified", label: "Qualifié" },
  { value: "won", label: "Gagné" },
  { value: "lost", label: "Perdu" },
  { value: "active", label: "En cours" },
  { value: "paused", label: "En attente" },
  { value: "abandoned", label: "Abandonné" },
] as const;

const formSchema = z.object({
  title: z.string().trim().min(1, "Titre requis").max(255),
  status: z.string(),
  description: z.string().optional(),
  expectedCloseDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide")
    .optional()
    .or(z.literal("")),
  oneshotAmountHt: z
    .string()
    .regex(/^-?\d+(\.\d{1,2})?$/, "Montant invalide")
    .optional()
    .or(z.literal("")),
  mrrHt: z
    .string()
    .regex(/^-?\d+(\.\d{1,2})?$/, "Montant invalide")
    .optional()
    .or(z.literal("")),
});

export function EditAffaireModal({
  open,
  onClose,
  affaire,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  affaire: AffaireRow | null;
  onSaved?: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    setGlobalError(null);
    setFieldErrors({});
  }, [open]);

  if (!affaire) return null;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!affaire) return;
    setSaving(true);
    setGlobalError(null);
    setFieldErrors({});

    const fd = new FormData(e.currentTarget);
    const raw = {
      title: String(fd.get("title") || "").trim(),
      status: String(fd.get("status") || ""),
      description: String(fd.get("description") || ""),
      expectedCloseDate: String(fd.get("expectedCloseDate") || ""),
      oneshotAmountHt: String(fd.get("oneshotAmountHt") || ""),
      mrrHt: String(fd.get("mrrHt") || ""),
    };

    const parsed = formSchema.safeParse(raw);
    if (!parsed.success) {
      const fe: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const k = String(issue.path[0] ?? "");
        if (k && !fe[k]) fe[k] = issue.message;
      }
      setFieldErrors(fe);
      setSaving(false);
      return;
    }

    const v = parsed.data;
    const body: Record<string, unknown> = {
      title: v.title,
      status: v.status,
      description: v.description ?? "",
    };
    if (v.expectedCloseDate) body.expectedCloseDate = v.expectedCloseDate;
    if (v.oneshotAmountHt) body.oneshotAmountHt = v.oneshotAmountHt;
    if (v.mrrHt) body.mrrHt = v.mrrHt;

    try {
      const res = await fetch(
        `/api/affaires/${encodeURIComponent(affaire.id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
        details?: { fieldErrors?: Record<string, string[]> };
      };
      if (!res.ok) {
        if (json.error === "validation_error" && json.details?.fieldErrors) {
          const fe: Record<string, string> = {};
          for (const [k, msgs] of Object.entries(json.details.fieldErrors)) {
            if (Array.isArray(msgs) && msgs[0]) fe[k] = msgs[0];
          }
          setFieldErrors(fe);
        } else {
          setGlobalError(
            json.message || json.error || `Erreur (${res.status})`,
          );
        }
        return;
      }
      toast.success("Affaire mise à jour");
      onSaved?.();
      onClose();
    } catch (err) {
      setGlobalError(err instanceof Error ? err.message : "Erreur réseau");
    } finally {
      setSaving(false);
    }
  }

  return (
    <FormModal open={open} onClose={onClose} title="Modifier l'affaire">
      <form onSubmit={handleSubmit} noValidate>
        <FormField label="Titre *">
          <input
            name="title"
            required
            defaultValue={affaire.name || ""}
            className={inputClass}
          />
          {fieldErrors.title && (
            <p className="text-xs text-rose-300 mt-1">{fieldErrors.title}</p>
          )}
        </FormField>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Stage">
            <select
              name="status"
              defaultValue={affaire.status}
              className={selectClass}
            >
              {STAGE_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Date close prévue">
            <input
              name="expectedCloseDate"
              type="date"
              defaultValue={affaire.due_date ?? ""}
              className={inputClass}
            />
            {fieldErrors.expectedCloseDate && (
              <p className="text-xs text-rose-300 mt-1">
                {fieldErrors.expectedCloseDate}
              </p>
            )}
          </FormField>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="One-shot HT (€)">
            <input
              name="oneshotAmountHt"
              type="number"
              step="0.01"
              min="0"
              className={inputClass}
              placeholder="0.00"
            />
            {fieldErrors.oneshotAmountHt && (
              <p className="text-xs text-rose-300 mt-1">
                {fieldErrors.oneshotAmountHt}
              </p>
            )}
          </FormField>
          <FormField label="MRR HT (€/mois)">
            <input
              name="mrrHt"
              type="number"
              step="0.01"
              min="0"
              className={inputClass}
              placeholder="0.00"
            />
            {fieldErrors.mrrHt && (
              <p className="text-xs text-rose-300 mt-1">{fieldErrors.mrrHt}</p>
            )}
          </FormField>
        </div>

        <FormField label="Notes">
          <textarea
            name="description"
            rows={4}
            defaultValue={affaire.description ?? ""}
            className={inputClass}
          />
        </FormField>

        {globalError && (
          <p className="text-xs text-rose-300 mt-2">{globalError}</p>
        )}

        <div className="flex items-center justify-end gap-3 mt-6">
          <button type="button" onClick={onClose} className={btnSecondary}>
            Annuler
          </button>
          <button type="submit" disabled={saving} className={btnPrimary}>
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Enregistrer
          </button>
        </div>
      </form>
    </FormModal>
  );
}
