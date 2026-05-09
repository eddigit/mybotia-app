"use client";

// V1.1.F — Modal "Modifier devis" (cockpit app.mybotia.com).
//
// PATCH /api/quotes/[id]. Si `items` est fourni → business recalcule les
// totaux et remplace les lignes (cf. `[id]/route.ts` business côté PUT).
//
// Le formulaire pré-remplit avec QuoteDetail.items[]. On laisse l'utilisateur
// modifier qty, unitPriceHt, vatRate, label, description, status, subject,
// notes, validUntil. Le client n'est PAS éditable côté UI : changer de client
// = créer un nouveau devis (sécurité business + simplicité numérotation).

import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { z } from "zod";

import {
  FormModal,
  FormField,
  inputClass,
  selectClass,
  btnPrimary,
  btnSecondary,
} from "@/components/shared/FormModal";
import { updateQuoteApi, type QuoteDetail } from "@/hooks/use-api";
import { toast } from "@/components/shared/Toast";
import {
  computeQuoteTotals,
  type QuoteItemInput,
} from "@/lib/quotes/totals";
import { formatMoneyFR } from "@/lib/format";

const STATUS_OPTIONS = [
  { value: "draft", label: "Brouillon" },
  { value: "sent", label: "Envoyé" },
  { value: "accepted", label: "Accepté" },
  { value: "refused", label: "Refusé" },
  { value: "cancelled", label: "Annulé" },
] as const;

const itemSchema = z.object({
  label: z.string().trim().min(1).max(500),
  description: z.string().nullish(),
  qty: z.number().min(0),
  unitPriceHt: z.number(),
  vatRate: z.number().min(0).max(100),
});

const formSchema = z.object({
  subject: z.string().optional(),
  status: z.enum(["draft", "sent", "accepted", "refused", "cancelled"]),
  validUntil: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide")
    .optional()
    .or(z.literal("")),
  notes: z.string().optional(),
  items: z.array(itemSchema).min(1),
});

type LineDraft = {
  key: string;
  label: string;
  description: string;
  qty: string;
  unitPriceHt: string;
  vatRate: string;
};

function asNumber(v: string): number {
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function toLineDraft(it: QuoteDetail["items"][number]): LineDraft {
  return {
    key: it.id ?? Math.random().toString(36).slice(2),
    label: it.label,
    description: it.description ?? "",
    qty: String(it.qty ?? "1"),
    unitPriceHt: String(it.unitPriceHt ?? "0"),
    vatRate: String(it.vatRate ?? "20"),
  };
}

export function EditQuoteModal({
  open,
  onClose,
  quote,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  quote: QuoteDetail | null;
  onSaved?: () => void;
}) {
  const [subject, setSubject] = useState("");
  const [status, setStatus] = useState<
    "draft" | "sent" | "accepted" | "refused" | "cancelled"
  >("draft");
  const [validUntil, setValidUntil] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<LineDraft[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open || !quote) return;
    setSubject(quote.subject ?? "");
    setStatus(quote.status);
    setValidUntil(quote.validUntil ?? "");
    setNotes(quote.notes ?? "");
    setLines(
      quote.items && quote.items.length > 0
        ? quote.items.map(toLineDraft)
        : [
            {
              key: Math.random().toString(36).slice(2),
              label: "",
              description: "",
              qty: "1",
              unitPriceHt: "",
              vatRate: "20",
            },
          ],
    );
    setGlobalError(null);
    setFieldErrors({});
  }, [open, quote]);

  const liveItems = useMemo<QuoteItemInput[]>(
    () =>
      lines.map((l) => ({
        label: l.label,
        description: l.description || null,
        qty: asNumber(l.qty),
        unitPriceHt: asNumber(l.unitPriceHt),
        vatRate: asNumber(l.vatRate),
      })),
    [lines],
  );
  const totals = useMemo(() => computeQuoteTotals(liveItems), [liveItems]);

  function setLine(idx: number, patch: Partial<LineDraft>) {
    setLines((prev) =>
      prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)),
    );
  }
  function addLine() {
    setLines((prev) => [
      ...prev,
      {
        key: Math.random().toString(36).slice(2),
        label: "",
        description: "",
        qty: "1",
        unitPriceHt: "",
        vatRate: prev.at(-1)?.vatRate ?? "20",
      },
    ]);
  }
  function removeLine(idx: number) {
    setLines((prev) =>
      prev.length === 1 ? prev : prev.filter((_, i) => i !== idx),
    );
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!quote) return;
    setSubmitting(true);
    setGlobalError(null);
    setFieldErrors({});

    const raw = {
      subject,
      status,
      validUntil,
      notes,
      items: liveItems.map((it) => ({
        label: it.label.trim(),
        description: it.description ?? null,
        qty: it.qty,
        unitPriceHt: it.unitPriceHt,
        vatRate: it.vatRate,
      })),
    };

    const parsed = formSchema.safeParse(raw);
    if (!parsed.success) {
      const fe: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const k = issue.path.join(".") || "form";
        if (!fe[k]) fe[k] = issue.message;
      }
      setFieldErrors(fe);
      setSubmitting(false);
      setGlobalError("Formulaire invalide.");
      return;
    }

    const v = parsed.data;
    try {
      await updateQuoteApi(quote.id, {
        subject: v.subject?.trim() || null,
        status: v.status,
        notes: v.notes?.trim() || null,
        validUntil: v.validUntil || null,
        items: v.items,
      });
      toast.success("Devis mis à jour");
      onSaved?.();
      onClose();
    } catch (err) {
      setGlobalError(err instanceof Error ? err.message : "Erreur réseau");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <FormModal
      open={open}
      onClose={onClose}
      title={quote ? `Modifier devis ${quote.number}` : "Modifier devis"}
    >
      <form onSubmit={handleSubmit} noValidate>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Objet">
            <input
              className={inputClass}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Ex : Refonte site vitrine"
            />
          </FormField>
          <FormField label="Validité">
            <input
              type="date"
              className={inputClass}
              value={validUntil}
              onChange={(e) => setValidUntil(e.target.value)}
            />
            {fieldErrors.validUntil && (
              <p className="text-xs text-rose-300 mt-1">
                {fieldErrors.validUntil}
              </p>
            )}
          </FormField>
        </div>

        <FormField label="Statut">
          <select
            className={selectClass}
            value={status}
            onChange={(e) => setStatus(e.target.value as typeof status)}
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </FormField>

        <div className="mt-2 mb-1 flex items-center justify-between">
          <span className="micro-label text-text-muted">Lignes</span>
          <button
            type="button"
            onClick={addLine}
            className="inline-flex items-center gap-1 px-2 py-1 text-[10px] uppercase tracking-tight border border-border-subtle text-text-muted hover:text-text-primary"
          >
            <Plus className="w-3 h-3" />
            Ajouter
          </button>
        </div>
        <div className="space-y-2">
          {lines.map((l, idx) => (
            <div
              key={l.key}
              className="border border-border-subtle bg-surface-2 p-2.5 space-y-2"
            >
              <div className="grid grid-cols-12 gap-2 items-start">
                <div className="col-span-12 sm:col-span-6">
                  <input
                    className={inputClass}
                    value={l.label}
                    onChange={(e) => setLine(idx, { label: e.target.value })}
                    placeholder="Libellé"
                  />
                </div>
                <div className="col-span-3 sm:col-span-2">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className={inputClass}
                    value={l.qty}
                    onChange={(e) => setLine(idx, { qty: e.target.value })}
                    placeholder="Qté"
                    aria-label="Quantité"
                  />
                </div>
                <div className="col-span-5 sm:col-span-2">
                  <input
                    type="number"
                    step="0.01"
                    className={inputClass}
                    value={l.unitPriceHt}
                    onChange={(e) =>
                      setLine(idx, { unitPriceHt: e.target.value })
                    }
                    placeholder="P.U. HT"
                    aria-label="Prix unitaire HT"
                  />
                </div>
                <div className="col-span-3 sm:col-span-1">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    className={inputClass}
                    value={l.vatRate}
                    onChange={(e) => setLine(idx, { vatRate: e.target.value })}
                    placeholder="TVA %"
                    aria-label="TVA %"
                  />
                </div>
                <div className="col-span-1 flex items-center justify-end pt-1">
                  <button
                    type="button"
                    onClick={() => removeLine(idx)}
                    disabled={lines.length === 1}
                    className="text-text-muted hover:text-rose-300 disabled:opacity-30"
                    aria-label="Supprimer la ligne"
                    title="Supprimer la ligne"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <input
                className={inputClass}
                value={l.description}
                onChange={(e) =>
                  setLine(idx, { description: e.target.value })
                }
                placeholder="Description (optionnel)"
              />
              <div className="text-[10px] text-text-muted text-right tabular-nums">
                Ligne HT : {formatMoneyFR(totals.items[idx]?.lineHt ?? 0)} ·
                TVA {formatMoneyFR(totals.items[idx]?.lineVat ?? 0)} ·
                TTC {formatMoneyFR(totals.items[idx]?.lineTtc ?? 0)}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-3 border border-border-subtle bg-surface-2 px-3 py-2 grid grid-cols-3 gap-2 text-sm">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-text-muted">
              Sous-total HT
            </div>
            <div className="tabular-nums font-bold text-text-primary">
              {formatMoneyFR(totals.subtotalHt)}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-text-muted">
              TVA
            </div>
            <div className="tabular-nums text-text-primary">
              {formatMoneyFR(totals.vatTotal)}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-text-muted">
              Total TTC
            </div>
            <div className="tabular-nums font-bold text-accent-glow">
              {formatMoneyFR(totals.totalTtc)}
            </div>
          </div>
        </div>

        <FormField label="Notes">
          <textarea
            rows={3}
            className={inputClass}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Conditions, remarques internes…"
          />
        </FormField>

        {globalError && (
          <p className="text-xs text-rose-300 mt-2">{globalError}</p>
        )}

        <div className="flex items-center justify-end gap-3 mt-6">
          <button type="button" onClick={onClose} className={btnSecondary}>
            Annuler
          </button>
          <button type="submit" disabled={submitting} className={btnPrimary}>
            {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Enregistrer
          </button>
        </div>
      </form>
    </FormModal>
  );
}
