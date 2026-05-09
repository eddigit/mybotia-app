"use client";

// V1.1.F — Modale "Nouvelle facture".
//
// Deux modes :
//   1) Vierge → user choisit client, ajoute lignes manuellement.
//   2) Depuis un devis → POST /api/invoices/from-quote/[quoteId] (snapshot
//      complet, pas de saisie ligne).
//   3) Pré-remplie depuis production → client + projectId verrouillés,
//      lignes manuelles (snapshot du montant production).
//
// Doctrine : aucun mock, dropdown caché si 1 seul choix utilisable
// (cf. feedback_ux_dropdown_si_choix_reel).

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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
  useScopedClients,
  createInvoiceApi,
  convertQuoteToInvoiceApi,
} from "@/hooks/use-api";
import { toast } from "@/components/shared/Toast";

const lineSchema = z.object({
  label: z.string().trim().min(1, "Libellé requis").max(500),
  description: z.string().optional().or(z.literal("")),
  qty: z.coerce.number().min(0, "≥ 0"),
  unitPriceHt: z.coerce.number(),
  vatRate: z.coerce.number().min(0).max(100),
});

const formSchema = z.object({
  clientId: z.string().uuid("Client requis"),
  projectId: z.string().uuid().optional().or(z.literal("")),
  subject: z.string().optional(),
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

function fmtMoney(n: number): string {
  return n.toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function plusDaysIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function CreateInvoiceModal({
  open,
  onClose,
  onCreated,
  defaultClientId,
  defaultProjectId,
  defaultQuoteId,
  lockClient = false,
}: {
  open: boolean;
  onClose: () => void;
  onCreated?: (invoiceId: string) => void;
  defaultClientId?: string;
  defaultProjectId?: string;
  /**
   * Si fourni : la modale propose la conversion devis→facture en un clic.
   * Le user voit toujours un bouton "Convertir le devis" et un bouton
   * "Saisie manuelle" (pour reprendre la main).
   */
  defaultQuoteId?: string;
  lockClient?: boolean;
}) {
  const router = useRouter();
  const { data: clients, loading: clientsLoading } = useScopedClients();

  const [mode, setMode] = useState<"manual" | "from_quote">(
    defaultQuoteId ? "from_quote" : "manual",
  );
  const [lines, setLines] = useState<Line[]>([{ ...EMPTY_LINE }]);
  const [submitting, setSubmitting] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    setMode(defaultQuoteId ? "from_quote" : "manual");
    setLines([{ ...EMPTY_LINE }]);
    setGlobalError(null);
    setFieldErrors({});
  }, [open, defaultQuoteId]);

  const sortedClients = useMemo(
    () =>
      [...clients].sort((a, b) =>
        (a.company || a.name || "").localeCompare(b.company || b.name || ""),
      ),
    [clients],
  );

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

  async function handleConvertQuote() {
    if (!defaultQuoteId) return;
    setSubmitting(true);
    setGlobalError(null);
    try {
      const created = await convertQuoteToInvoiceApi(defaultQuoteId);
      toast.success("Devis converti en facture.");
      onCreated?.(created.id);
      router.push(`/invoices/${created.id}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erreur conversion";
      setGlobalError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setGlobalError(null);
    setFieldErrors({});

    const fd = new FormData(e.currentTarget);
    const raw = {
      clientId: String(fd.get("clientId") || ""),
      projectId: String(fd.get("projectId") || ""),
      subject: String(fd.get("subject") || ""),
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
      const r = lineSchema.safeParse({
        label: lines[i].label,
        description: lines[i].description,
        qty: lines[i].qty,
        unitPriceHt: lines[i].unitPriceHt,
        vatRate: lines[i].vatRate,
      });
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
      clientId: v.clientId,
      projectId: v.projectId || null,
      subject: v.subject || null,
      status: "draft" as const,
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
      const created = await createInvoiceApi(body);
      toast.success("Facture créée.");
      onCreated?.(created.id);
      router.push(`/invoices/${created.id}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erreur création";
      setGlobalError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <FormModal open={open} onClose={onClose} title="Nouvelle facture">
      {/* Mode switcher : visible UNIQUEMENT si défaultQuoteId fourni
          (sinon il n'y a qu'un mode utilisable, pas de dropdown). */}
      {defaultQuoteId && (
        <div className="flex gap-2 mb-4 border-b border-border-subtle pb-3">
          <button
            type="button"
            onClick={() => setMode("from_quote")}
            className={`flex-1 px-3 py-2 text-[11px] font-bold uppercase tracking-tight border ${
              mode === "from_quote"
                ? "bg-accent-primary/15 text-accent-glow border-accent-primary/40"
                : "border-border-subtle text-text-muted hover:text-text-primary"
            }`}
          >
            Convertir le devis
          </button>
          <button
            type="button"
            onClick={() => setMode("manual")}
            className={`flex-1 px-3 py-2 text-[11px] font-bold uppercase tracking-tight border ${
              mode === "manual"
                ? "bg-accent-primary/15 text-accent-glow border-accent-primary/40"
                : "border-border-subtle text-text-muted hover:text-text-primary"
            }`}
          >
            Saisie manuelle
          </button>
        </div>
      )}

      {mode === "from_quote" && defaultQuoteId ? (
        <div className="space-y-4">
          <p className="text-[12px] text-text-secondary">
            Une nouvelle facture sera créée à partir du devis sélectionné. Les
            lignes, le client et la production seront copiés tels quels.
          </p>
          {globalError && (
            <p className="text-[11px] text-rose-300">{globalError}</p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className={btnSecondary} disabled={submitting}>
              Annuler
            </button>
            <button
              type="button"
              onClick={handleConvertQuote}
              className={btnPrimary}
              disabled={submitting}
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Convertir
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          <FormField label="Client *">
            <select
              name="clientId"
              defaultValue={defaultClientId || ""}
              disabled={lockClient || clientsLoading}
              required
              className={selectClass}
            >
              <option value="" disabled>
                {clientsLoading ? "Chargement…" : "Choisir un client"}
              </option>
              {sortedClients.map((c) => (
                <option key={c.id} value={String(c.id)}>
                  {c.company || c.name}
                </option>
              ))}
            </select>
            {fieldErrors.clientId && (
              <p className="text-[11px] text-rose-300 mt-1">{fieldErrors.clientId}</p>
            )}
          </FormField>

          {defaultProjectId && (
            <input type="hidden" name="projectId" value={defaultProjectId} />
          )}

          <FormField label="Objet">
            <input
              type="text"
              name="subject"
              maxLength={255}
              placeholder="Prestation, mission…"
              className={inputClass}
            />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Date d'émission">
              <input
                type="date"
                name="issuedAt"
                defaultValue={todayIso()}
                className={inputClass}
              />
              {fieldErrors.issuedAt && (
                <p className="text-[11px] text-rose-300 mt-1">{fieldErrors.issuedAt}</p>
              )}
            </FormField>
            <FormField label="Échéance (J+30)">
              <input
                type="date"
                name="dueDate"
                defaultValue={plusDaysIso(30)}
                className={inputClass}
              />
              {fieldErrors.dueDate && (
                <p className="text-[11px] text-rose-300 mt-1">{fieldErrors.dueDate}</p>
              )}
            </FormField>
          </div>

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

          <FormField label="Notes (optionnelles)">
            <textarea
              name="notes"
              rows={2}
              placeholder="Conditions particulières…"
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
              Créer la facture
            </button>
          </div>
        </form>
      )}
    </FormModal>
  );
}
