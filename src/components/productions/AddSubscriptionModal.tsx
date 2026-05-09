"use client";

// V1.1.D Phase 2 — Modale création subscription standalone (post-signature).
// POST /api/productions/[id]/subscriptions  (app proxy → biz endpoint dédié).
//
// Doctrine : doctrine_v3_usage_billing.md (source unique core.subscriptions).
// Permet d'ajouter un abonnement après signature (upsell, maintenance, etc.)
// sans repasser par le flow signature d'affaire.

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

const CYCLE_OPTIONS = [
  { value: "monthly", label: "Mensuel" },
  { value: "quarterly", label: "Trimestriel" },
  { value: "yearly", label: "Annuel" },
];

export function AddSubscriptionModal({
  open,
  onClose,
  onSaved,
  productionId,
}: {
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
  productionId: string;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    const label = String(form.get("label") || "").trim();
    const mrrRaw = String(form.get("mrrHt") || "").trim();
    const mrrNum = Number(mrrRaw.replace(",", "."));
    const billingCycle = String(form.get("billingCycle") || "monthly");
    const startedAt = String(form.get("startedAt") || "").trim();
    const endDate = String(form.get("endDate") || "").trim();

    if (!label) {
      setError("Le libellé est requis.");
      setSaving(false);
      return;
    }
    if (!mrrRaw || !Number.isFinite(mrrNum) || mrrNum < 0) {
      setError("MRR HT invalide (nombre positif requis).");
      setSaving(false);
      return;
    }
    // Le biz Zod attend un string `^-?\d+(\.\d{1,2})?$`.
    const mrrHt = mrrNum.toFixed(2);

    const body: Record<string, string> = { label, mrrHt, billingCycle };
    if (startedAt) body.startedAt = startedAt;
    if (endDate) body.endDate = endDate;

    try {
      const res = await fetch(
        `/api/productions/${encodeURIComponent(productionId)}/subscriptions`,
        {
          method: "POST",
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

  const today = new Date().toISOString().slice(0, 10);

  return (
    <FormModal open={open} onClose={onClose} title="Nouvel abonnement">
      <form onSubmit={handleSubmit}>
        <FormField label="Libellé *">
          <input
            name="label"
            required
            placeholder="Ex : Maintenance mensuelle, Abonnement tokens…"
            className={inputClass}
          />
        </FormField>

        <div className="grid grid-cols-2 gap-4">
          <FormField label="MRR HT *">
            <input
              name="mrrHt"
              required
              type="number"
              min="0"
              step="0.01"
              placeholder="Ex : 290.00"
              className={inputClass}
            />
          </FormField>
          <FormField label="Cycle de facturation">
            <select
              name="billingCycle"
              defaultValue="monthly"
              className={selectClass}
            >
              {CYCLE_OPTIONS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </FormField>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField label="Date de début">
            <input
              name="startedAt"
              type="date"
              defaultValue={today}
              className={inputClass}
            />
          </FormField>
          <FormField label="Date de fin (optionnelle)">
            <input name="endDate" type="date" className={inputClass} />
          </FormField>
        </div>

        {error ? (
          <p className="mt-2 text-sm text-red-400">{error}</p>
        ) : null}

        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onClose} className={btnSecondary}>
            Annuler
          </button>
          <button type="submit" disabled={saving} className={btnPrimary}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Créer l&apos;abonnement
          </button>
        </div>
      </form>
    </FormModal>
  );
}
