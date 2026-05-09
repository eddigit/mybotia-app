"use client";

// V1.1.F — Modale "Éditer la facture".
//
// Permet de modifier objet, dates, statut, notes, lignes. Le client n'est
// PAS modifiable (volontaire : changer de client = créer une nouvelle
// facture). Le PUT côté biz remplace l'ensemble des items si on les
// fournit, sinon laisse les lignes intactes.

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
import {
  useInvoice,
  updateInvoiceApi,
  type InvoiceRow,
  type InvoiceItemRow,
} from "@/hooks/use-api";
import { toast } from "@/components/shared/Toast";

const STATUSES = [
  { value: "draft", label: "Brouillon" },
  { value: "sent", label: "Envoyée" },
  { value: "paid", label: "Payée" },
  { value: "overdue", label: "En retard" },
  { value: "cancelled", label: "Annulée" },
] as const;

const lineSchema = z.object({
  label: z.string().trim().min(1, "Libellé requis").max(500),
  description: z.string().optional().or(z.literal("")),
  qty: z.coerce.number().min(0, "≥ 0"),
  unitPriceHt: z.coerce.number(),
  vatRate: z.coerce.number().min(0).max(100),
});

const formSchema = z.object({
  subject: z.string().optional(),
  status: z.enum(["draft", "sent", "paid", "overdue", "cancelled"]),
  issuedAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide")
    .optional()
    .or(z.literal("")),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide")
    .optional()
    .or(z.literal("")),
  notes: z.string().optional(),
});

type Line = {
  label: string;
  description: string;
  qty: string;
  unitPriceHt: string;
  vatRate: string;
};

const EMPTY_LINE: Line = {
  label: "",
  description: "",
  qty: "1",
  unitPriceHt: "0",
  vatRate: "20",
};

function toLines(items: InvoiceItemRow[] | undefined): Line[] {
  if (!items || items.length === 0) return [{ ...EMPTY_LINE }];
  return items.map((it) => ({
    label: it.label ?? "",
    description: (it.description ?? "") as string,
    qty: String(it.qty ?? "1"),
    unitPriceHt: String(it.unitPriceHt ?? it.unit_price_ht ?? "0"),
    vatRate: String(it.vatRate ?? it.vat_rate ?? "20"),
  }));
}

function fmtMoney(n: number): string {
  return n.toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function EditInvoiceModal({
  open,
  invoiceId,
  onClose,
  onUpdated,
}: {
  open: boolean;
  invoiceId: string;
  onClose: () => void;
  onUpdated?: (invoice: InvoiceRow) => void;
}) {
  const { data: invoice, loading: invLoading } = useInvoice(
    open ? invoiceId : null,
  );

  const [lines, setLines] = useState<Line[]>([{ ...EMPTY_LINE }]);
  const [submitting, setSubmitting] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) {
      setGlobalError(null);
      setFieldErrors({});
      return;
    }
    setLines(toLines(invoice?.items));
  }, [open, invoice?.id, invoice?.items]);

  const totals = useMemo(() => {
    let subtotalHt = 0;
    let vatTotal = 0;
    for (const l of lines) {
      const qty = parseFloat(l.qty) || 0;
      const unit = parseFloat(l.unitPriceHt) || 0;
      const vat = parseFloat(l.vatRate) || 0;
      const lineHt = qty * unit;
      subtotalHt += lineHt;
      vatTotal += (lineHt * vat) / 100;
    }
    return {
      subtotalHt,
      vatTotal,
      totalTtc: subtotalHt + vatTotal,
    };
  }, [lines]);

  function updateLine(idx: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }
  function addLine() {
    setLines((prev) => [...prev, { ...EMPTY_LINE }]);
  }
  function removeLine(idx: number) {
    setLines((prev) =>
      prev.length === 1 ? prev : prev.filter((_, i) => i !== idx),
    );
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setGlobalError(null);
    setFieldErrors({});

    const fd = new FormData(e.currentTarget);
    const raw = {
      subject: String(fd.get("subject") || ""),
      status: String(fd.get("status") || "draft"),
      issuedAt: String(fd.get("issuedAt") || ""),
      dueDate: String(fd.get("dueDate") || ""),
      notes: String(fd.get("notes") || ""),
    };

    const parsed = formSchema.safeParse(raw);
    if (!parsed.success) {
      const fe: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const k = String(issue.path[0] ?? "");
        if (k && !fe[k]) fe[k] = issue.message;
      }
      setFieldErrors(fe);
      setSubmitting(false);
      return;
    }

    const itemsParsed: Array<z.infer<typeof lineSchema>> = [];
    for (let i = 0; i < lines.length; i++) {
      const r = lineSchema.safeParse(lines[i]);
      if (!r.success) {
        setGlobalError(`Ligne ${i + 1} : ${r.error.issues[0]?.message ?? "invalide"}`);
        setSubmitting(false);
        return;
      }
      itemsParsed.push(r.data);
    }
    if (itemsParsed.length === 0) {
      setGlobalError("Au moins une ligne est requise.");
      setSubmitting(false);
      return;
    }

    const v = parsed.data;
    const body = {
      subject: v.subject || null,
      status: v.status,
      notes: v.notes || null,
      issuedAt: v.issuedAt || null,
      dueDate: v.dueDate || null,
      items: itemsParsed.map((it) => ({
        label: it.label,
        description: it.description || null,
        qty: it.qty,
        unitPriceHt: it.unitPriceHt,
        vatRate: it.vatRate,
      })),
    };

    try {
      const updated = await updateInvoiceApi(invoiceId, body);
      toast.success("Facture mise à jour.");
      onUpdated?.(updated);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erreur édition";
      setGlobalError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <FormModal open={open} onClose={onClose} title="Éditer la facture">
      {invLoading || !invoice ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-accent-glow" />
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          <FormField label="Objet">
            <input
              type="text"
              name="subject"
              maxLength={255}
              defaultValue={invoice.subject ?? ""}
              className={inputClass}
            />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Date d'émission">
              <input
                type="date"
                name="issuedAt"
                defaultValue={
                  (invoice.issuedAt ?? invoice.issued_at ?? "")?.toString().slice(0, 10) || ""
                }
                className={inputClass}
              />
              {fieldErrors.issuedAt && (
                <p className="text-[11px] text-rose-300 mt-1">{fieldErrors.issuedAt}</p>
              )}
            </FormField>
            <FormField label="Échéance">
              <input
                type="date"
                name="dueDate"
                defaultValue={
                  (invoice.dueDate ?? invoice.due_date ?? "")?.toString().slice(0, 10) || ""
                }
                className={inputClass}
              />
              {fieldErrors.dueDate && (
                <p className="text-[11px] text-rose-300 mt-1">{fieldErrors.dueDate}</p>
              )}
            </FormField>
          </div>

          <FormField label="Statut">
            <select
              name="status"
              defaultValue={invoice.status}
              className={selectClass}
            >
              {STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </FormField>

          <div className="mt-2 mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="micro-label text-text-muted">Lignes</span>
              <button
                type="button"
                onClick={addLine}
                className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-tight text-accent-glow hover:underline"
              >
                <Plus className="w-3 h-3" />
                Ajouter
              </button>
            </div>
            <div className="space-y-2">
              {lines.map((l, i) => (
                <div
                  key={i}
                  className="border border-border-subtle p-3 space-y-2 bg-surface-2/40"
                >
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Libellé *"
                      value={l.label}
                      onChange={(e) => updateLine(i, { label: e.target.value })}
                      required
                      className={inputClass}
                    />
                    {lines.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeLine(i)}
                        className="px-2 text-text-muted hover:text-rose-300"
                        aria-label="Supprimer la ligne"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    placeholder="Description (optionnelle)"
                    value={l.description}
                    onChange={(e) =>
                      updateLine(i, { description: e.target.value })
                    }
                    className={inputClass}
                  />
                  <div className="grid grid-cols-3 gap-2">
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="Qté"
                      value={l.qty}
                      onChange={(e) => updateLine(i, { qty: e.target.value })}
                      className={inputClass}
                    />
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="PU HT"
                      value={l.unitPriceHt}
                      onChange={(e) =>
                        updateLine(i, { unitPriceHt: e.target.value })
                      }
                      className={inputClass}
                    />
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="TVA %"
                      value={l.vatRate}
                      onChange={(e) =>
                        updateLine(i, { vatRate: e.target.value })
                      }
                      className={inputClass}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <FormField label="Notes">
            <textarea
              name="notes"
              rows={2}
              defaultValue={invoice.notes ?? ""}
              className={inputClass}
            />
          </FormField>

          <div className="border-t border-border-subtle pt-3 mb-4 space-y-1 text-sm">
            <div className="flex justify-between text-text-secondary">
              <span>Total HT</span>
              <span className="tabular-nums">{fmtMoney(totals.subtotalHt)}</span>
            </div>
            <div className="flex justify-between text-text-secondary">
              <span>TVA</span>
              <span className="tabular-nums">{fmtMoney(totals.vatTotal)}</span>
            </div>
            <div className="flex justify-between font-bold text-text-primary">
              <span>Total TTC</span>
              <span className="tabular-nums">{fmtMoney(totals.totalTtc)}</span>
            </div>
          </div>

          {globalError && (
            <p className="text-[11px] text-rose-300 mb-3">{globalError}</p>
          )}

          <div className="flex justify-end gap-2">
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
              Enregistrer
            </button>
          </div>
        </form>
      )}
    </FormModal>
  );
}
