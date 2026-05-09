"use client";

// V1.1.F — Modal "Nouveau devis" (cockpit app.mybotia.com).
//
// Doctrine "app.mybotia = parité CRM" : création complète côté app, sans
// passer par crm.mybotia.com. POST /api/quotes (proxy → mybotia-business).
//
// Champs :
//   - clientId (required, sélecteur scope cockpit)
//   - projectId (optionnel, lié à une affaire/production du client)
//   - subject (optionnel)
//   - validUntil (optionnel, date FR)
//   - status (default "draft")
//   - notes (optionnel)
//   - items[] (au moins 1, label/qty/unitPriceHt/vatRate)
//
// Calcul totaux LIVE côté front via `lib/quotes/totals.ts` (mirror serveur).
// Le serveur recalcule de toute façon : c'est purement informatif.
// V1.1.H.1 P0-UX-2 — anti-perte de saisie : draft localStorage.

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, RotateCcw, Trash2, X } from "lucide-react";
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
  useAffaires,
  createQuoteApi,
  type AffaireItem,
} from "@/hooks/use-api";
import { toast } from "@/components/shared/Toast";
import {
  computeQuoteTotals,
  type QuoteItemInput,
} from "@/lib/quotes/totals";
import { formatMoneyFR } from "@/lib/format";
import { useFormDraft } from "@/hooks/use-form-draft";

const STATUS_OPTIONS = [
  { value: "draft", label: "Brouillon" },
  { value: "sent", label: "Envoyé" },
  { value: "accepted", label: "Accepté" },
  { value: "refused", label: "Refusé" },
  { value: "cancelled", label: "Annulé" },
] as const;

const itemSchema = z.object({
  label: z.string().trim().min(1, "Libellé requis").max(500),
  description: z.string().nullish(),
  qty: z.number().min(0),
  unitPriceHt: z.number(),
  vatRate: z.number().min(0).max(100),
});

const formSchema = z.object({
  clientId: z.string().uuid("Client requis"),
  projectId: z.string().uuid().optional().or(z.literal("")),
  subject: z.string().optional(),
  status: z.enum(["draft", "sent", "accepted", "refused", "cancelled"]),
  validUntil: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide")
    .optional()
    .or(z.literal("")),
  notes: z.string().optional(),
  items: z.array(itemSchema).min(1, "Au moins une ligne est requise"),
});

const DRAFT_KEY = "draft:create-quote";

type LineDraft = {
  key: string;
  label: string;
  description: string;
  qty: string;
  unitPriceHt: string;
  vatRate: string;
};

type QuoteDraft = {
  clientId: string;
  projectId: string;
  subject: string;
  status: "draft" | "sent" | "accepted" | "refused" | "cancelled";
  validUntil: string;
  notes: string;
  lines: LineDraft[];
};

function emptyLine(vat = "20"): LineDraft {
  return {
    key: Math.random().toString(36).slice(2),
    label: "",
    description: "",
    qty: "1",
    unitPriceHt: "",
    vatRate: vat,
  };
}

function asNumber(v: string): number {
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

export function CreateQuoteModal({
  open,
  onClose,
  onCreated,
  defaultClientId,
  defaultProjectId,
}: {
  open: boolean;
  onClose: () => void;
  onCreated?: (quoteId: string) => void;
  defaultClientId?: string;
  defaultProjectId?: string;
}) {
  const router = useRouter();
  const { data: clients, loading: clientsLoading } = useScopedClients();
  const { data: affaires } = useAffaires();

  // V1.1.H.1 P0-UX-2 — draft groupé
  const [quoteDraft, setQuoteDraft] = useState<QuoteDraft>({
    clientId: defaultClientId ?? "",
    projectId: defaultProjectId ?? "",
    subject: "",
    status: "draft",
    validUntil: "",
    notes: "",
    lines: [emptyLine()],
  });
  const { hasDraft, clearDraft } = useFormDraft(DRAFT_KEY, quoteDraft, setQuoteDraft);
  const [draftBannerDismissed, setDraftBannerDismissed] = useState(false);

  // Aliases pour compatibilité avec le reste du composant
  const clientId = quoteDraft.clientId;
  const projectId = quoteDraft.projectId;
  const subject = quoteDraft.subject;
  const status = quoteDraft.status;
  const validUntil = quoteDraft.validUntil;
  const notes = quoteDraft.notes;
  const lines = quoteDraft.lines;
  const setClientId = (v: string) => setQuoteDraft((d) => ({ ...d, clientId: v }));
  const setProjectId = (v: string) => setQuoteDraft((d) => ({ ...d, projectId: v }));
  const setSubject = (v: string) => setQuoteDraft((d) => ({ ...d, subject: v }));
  const setStatus = (v: "draft" | "sent" | "accepted" | "refused" | "cancelled") => setQuoteDraft((d) => ({ ...d, status: v }));
  const setValidUntil = (v: string) => setQuoteDraft((d) => ({ ...d, validUntil: v }));
  const setNotes = (v: string) => setQuoteDraft((d) => ({ ...d, notes: v }));
  const setLines = (fn: (prev: LineDraft[]) => LineDraft[]) => setQuoteDraft((d) => ({ ...d, lines: fn(d.lines) }));

  const [submitting, setSubmitting] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Reset on (re)open — ne réinitialise PAS si un brouillon est chargé
  useEffect(() => {
    if (!open) { setDraftBannerDismissed(false); return; }
    setGlobalError(null);
    setFieldErrors({});
  }, [open, defaultClientId, defaultProjectId]);

  const sortedClients = useMemo(
    () =>
      [...clients].sort((a, b) =>
        (a.company || a.name || "").localeCompare(b.company || b.name || ""),
      ),
    [clients],
  );

  // Affaires liées au client courant — UX doctrine : dropdown seulement si
  // 2+ options réelles ; sinon ligne info ou rien (ici : optionnel toujours).
  const clientAffaires = useMemo<AffaireItem[]>(() => {
    if (!clientId) return [];
    return (affaires as AffaireItem[]).filter(
      (a) =>
        ((a as Record<string, unknown>).client_id as string | undefined) ===
          clientId || a.clientId === clientId,
    );
  }, [affaires, clientId]);

  // Live totals
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
    setLines((prev) => [...prev, emptyLine(prev.at(-1)?.vatRate ?? "20")]);
  }

  function removeLine(idx: number) {
    setLines((prev) =>
      prev.length === 1 ? prev : prev.filter((_, i) => i !== idx),
    );
  }

  const emptyQuoteDraft: QuoteDraft = {
    clientId: defaultClientId ?? "",
    projectId: defaultProjectId ?? "",
    subject: "",
    status: "draft",
    validUntil: "",
    notes: "",
    lines: [emptyLine()],
  };

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setGlobalError(null);
    setFieldErrors({});

    const raw = {
      clientId,
      projectId: projectId || "",
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
    const body = {
      clientId: v.clientId,
      projectId: v.projectId ? v.projectId : null,
      subject: v.subject?.trim() || null,
      status: v.status,
      notes: v.notes?.trim() || null,
      validUntil: v.validUntil || null,
      items: v.items,
    };

    try {
      const created = await createQuoteApi(body);
      toast.success(`Devis ${created.number ?? ""} créé`);
      // V1.1.H.1 — submit success : nettoyer le brouillon
      clearDraft();
      setQuoteDraft(emptyQuoteDraft);
      onCreated?.(created.id);
      onClose();
      if (created.id) router.push(`/quotes/${created.id}`);
    } catch (err) {
      setGlobalError(err instanceof Error ? err.message : "Erreur réseau");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <FormModal open={open} onClose={onClose} title="Nouveau devis">
      {/* V1.1.H.1 — ruban brouillon restauré */}
      {hasDraft && !draftBannerDismissed && (
        <div className="flex items-center justify-between gap-2 mb-3 px-3 py-2 bg-amber-400/10 border border-amber-400/30 text-amber-300 text-[11px]">
          <span className="flex items-center gap-1.5">
            <RotateCcw className="w-3 h-3" />
            Brouillon restauré
          </span>
          <button
            type="button"
            onClick={() => { clearDraft(); setQuoteDraft(emptyQuoteDraft); setDraftBannerDismissed(true); }}
            className="flex items-center gap-0.5 hover:text-amber-100"
            title="Effacer le brouillon"
          >
            <X className="w-3 h-3" /> Effacer
          </button>
        </div>
      )}
      <form onSubmit={handleSubmit} noValidate>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Client *">
            <select
              className={selectClass}
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              disabled={clientsLoading}
              required
            >
              <option value="">
                {clientsLoading ? "Chargement…" : "-- Sélectionner --"}
              </option>
              {sortedClients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.company || c.name}
                </option>
              ))}
            </select>
            {fieldErrors.clientId && (
              <p className="text-xs text-rose-300 mt-1">
                {fieldErrors.clientId}
              </p>
            )}
          </FormField>

          {/* UX doctrine — dropdown affaires UNIQUEMENT si 2+ options. Sinon
              info read-only ou rien (champ optionnel). */}
          {clientAffaires.length >= 2 ? (
            <FormField label="Affaire associée">
              <select
                className={selectClass}
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
              >
                <option value="">— Aucune —</option>
                {clientAffaires.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.title || a.name || "(sans titre)"}
                  </option>
                ))}
              </select>
            </FormField>
          ) : clientAffaires.length === 1 ? (
            <FormField label="Affaire associée">
              <label className="flex items-center gap-2 px-3 py-2.5 text-sm bg-surface-2 border border-border-subtle cursor-pointer">
                <input
                  type="checkbox"
                  checked={projectId === clientAffaires[0].id}
                  onChange={(e) =>
                    setProjectId(e.target.checked ? clientAffaires[0].id : "")
                  }
                />
                <span className="text-text-primary truncate">
                  {clientAffaires[0].title ||
                    clientAffaires[0].name ||
                    "(sans titre)"}
                </span>
              </label>
            </FormField>
          ) : null}
        </div>

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
            onChange={(e) =>
              setStatus(e.target.value as typeof status)
            }
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </FormField>

        {/* Lignes */}
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
                  {fieldErrors[`items.${idx}.label`] && (
                    <p className="text-xs text-rose-300 mt-1">
                      {fieldErrors[`items.${idx}.label`]}
                    </p>
                  )}
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
                    onChange={(e) =>
                      setLine(idx, { vatRate: e.target.value })
                    }
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
        {fieldErrors.items && (
          <p className="text-xs text-rose-300 mt-1">{fieldErrors.items}</p>
        )}

        {/* Totaux live */}
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
            Créer le devis
          </button>
        </div>
      </form>
    </FormModal>
  );
}
