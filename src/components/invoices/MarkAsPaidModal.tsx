"use client";

// V1.1.F — Modale "Marquer comme payée".
//
// Inputs : date paiement (par défaut aujourd'hui), référence (optionnelle),
// montant (par défaut total TTC, info uniquement). Le serveur biz pose
// paid_at = now() automatiquement quand status='paid'. La date saisie ici
// est conservée dans `notes` (concat préfixe "Paiement reçu le …") pour
// traçabilité, sans nouvelle DDL.

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import {
  FormModal,
  FormField,
  inputClass,
  btnPrimary,
  btnSecondary,
} from "@/components/shared/FormModal";
import {
  updateInvoiceApi,
  useInvoice,
} from "@/hooks/use-api";
import { toast } from "@/components/shared/Toast";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function safeNumber(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = parseFloat(v);
    return Number.isNaN(n) ? 0 : n;
  }
  return 0;
}

export function MarkAsPaidModal({
  open,
  invoiceId,
  onClose,
  onMarked,
}: {
  open: boolean;
  invoiceId: string;
  onClose: () => void;
  onMarked?: () => void;
}) {
  const { data: invoice, loading: invoiceLoading } = useInvoice(
    open ? invoiceId : null,
  );
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setErr(null);
      setSubmitting(false);
    }
  }, [open]);

  const totalTtc = safeNumber(invoice?.totalTtc ?? invoice?.total_ttc ?? 0);
  const existingNotes = invoice?.notes ?? null;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr(null);
    setSubmitting(true);
    try {
      const fd = new FormData(e.currentTarget);
      const paidAt = String(fd.get("paidAt") || "").trim();
      const reference = String(fd.get("reference") || "").trim();
      const amount = String(fd.get("amount") || "").trim();

      const trace = [
        `Paiement reçu${paidAt ? ` le ${paidAt}` : ""}`,
        reference ? `réf. ${reference}` : null,
        amount ? `${amount} € TTC` : null,
      ]
        .filter(Boolean)
        .join(" — ");

      const newNotes = existingNotes
        ? `${existingNotes}\n${trace}`
        : trace;

      await updateInvoiceApi(invoiceId, {
        status: "paid",
        notes: newNotes,
      });
      toast.success("Facture marquée payée.");
      onMarked?.();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erreur paiement";
      setErr(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <FormModal open={open} onClose={onClose} title="Marquer comme payée">
      {invoiceLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-accent-glow" />
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          <FormField label="Date de paiement">
            <input
              type="date"
              name="paidAt"
              defaultValue={todayIso()}
              required
              className={inputClass}
            />
          </FormField>

          <FormField label="Référence (optionnelle)">
            <input
              type="text"
              name="reference"
              placeholder="Virement, chèque n°…"
              className={inputClass}
              maxLength={100}
            />
          </FormField>

          <FormField label="Montant payé (TTC)">
            <input
              type="text"
              name="amount"
              defaultValue={
                totalTtc > 0
                  ? totalTtc.toLocaleString("fr-FR", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })
                  : ""
              }
              className={inputClass}
              inputMode="decimal"
            />
          </FormField>

          {err && (
            <p className="text-[11px] text-rose-300 mb-3">
              {err}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className={btnSecondary}
              disabled={submitting}
            >
              Annuler
            </button>
            <button
              type="submit"
              className={btnPrimary}
              disabled={submitting}
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Confirmer
            </button>
          </div>
        </form>
      )}
    </FormModal>
  );
}
