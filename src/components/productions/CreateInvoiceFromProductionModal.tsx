"use client";

// V1.1.D Phase 2 — Modale "Créer facture" depuis la fiche production.
//
// Pré-remplit les lignes depuis la production :
//   - 1 ligne "Prestation initiale" si production.oneshot_amount_ht > 0
//   - 1 ligne par subscription active (label = subscription.label,
//     qty=1, unit_price=monthly_amount HT)
// Lignes éditables (ajout/suppression). TVA défaut 20% (pas de branding
// tenant-scopé côté app à ce jour).
//
// POST /api/invoices avec productionId injecté → mappé en projectId par
// le proxy app (cf. src/app/api/invoices/route.ts).
//
// Doctrine "JAMAIS de mock" (feedback_jamais_de_mock) :
//   - si production sans données financières (oneshot=0 ET aucune sub),
//     on n'impose pas une ligne factice : empty-state explicite +
//     bouton "Ajouter une ligne" pour saisie manuelle.

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Trash2, AlertTriangle } from "lucide-react";

import {
  FormModal,
  FormField,
  inputClass,
  btnPrimary,
  btnSecondary,
} from "@/components/shared/FormModal";
import { toast } from "@/components/shared/Toast";

type SubscriptionLike = {
  id: string;
  label: string | null;
  status: string;
  monthly_amount: string;
  billing_period: string;
  end_date: string | null;
};

type InvoiceLine = {
  key: string;
  label: string;
  qty: string; // string pour permettre la saisie libre
  unitPriceHt: string;
  vatRate: string;
};

const DEFAULT_VAT = "20";

const todayIso = () => new Date().toISOString().slice(0, 10);

const plus30 = () => {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().slice(0, 10);
};

function fmtMoney(n: number) {
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  });
}

function safeNumber(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = parseFloat(v.replace(",", "."));
    return Number.isNaN(n) ? 0 : n;
  }
  return 0;
}

function newKey(prefix = "line") {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function CreateInvoiceFromProductionModal({
  open,
  onClose,
  productionId,
  productionTitle,
  clientId,
  clientName,
  oneshotHt,
  subscriptions,
}: {
  open: boolean;
  onClose: () => void;
  productionId: string;
  productionTitle: string;
  clientId: string;
  clientName?: string;
  /** Snapshot HT one-shot venant de la fiche production (déjà calculé). */
  oneshotHt: number;
  subscriptions: SubscriptionLike[];
}) {
  const router = useRouter();

  const [issuedAt, setIssuedAt] = useState(todayIso());
  const [dueDate, setDueDate] = useState(plus30());
  const [subject, setSubject] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<InvoiceLine[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pré-remplissage à l'ouverture (snapshot — pas de live-sync ensuite).
  useEffect(() => {
    if (!open) return;
    setError(null);
    setIssuedAt(todayIso());
    setDueDate(plus30());
    setSubject(`Facturation — ${productionTitle}`.slice(0, 255));
    setNotes("");

    const seeded: InvoiceLine[] = [];
    if (oneshotHt > 0) {
      seeded.push({
        key: newKey("oneshot"),
        label: "Prestation initiale",
        qty: "1",
        unitPriceHt: oneshotHt.toFixed(2),
        vatRate: DEFAULT_VAT,
      });
    }
    for (const sub of subscriptions) {
      if (sub.status !== "active") continue;
      if (sub.end_date && new Date(sub.end_date) < new Date()) continue;
      const amount = safeNumber(sub.monthly_amount);
      if (amount <= 0) continue;
      seeded.push({
        key: newKey("sub"),
        label: sub.label || "Abonnement",
        qty: "1",
        unitPriceHt: amount.toFixed(2),
        vatRate: DEFAULT_VAT,
      });
    }
    setLines(seeded);
  }, [open, productionTitle, oneshotHt, subscriptions]);

  const totals = useMemo(() => {
    let ht = 0;
    let vat = 0;
    for (const l of lines) {
      const q = safeNumber(l.qty);
      const u = safeNumber(l.unitPriceHt);
      const r = safeNumber(l.vatRate);
      const lineHt = q * u;
      ht += lineHt;
      vat += (lineHt * r) / 100;
    }
    return {
      ht: Math.round((ht + Number.EPSILON) * 100) / 100,
      vat: Math.round((vat + Number.EPSILON) * 100) / 100,
      ttc: Math.round((ht + vat + Number.EPSILON) * 100) / 100,
    };
  }, [lines]);

  function addLine() {
    setLines((prev) => [
      ...prev,
      {
        key: newKey(),
        label: "",
        qty: "1",
        unitPriceHt: "0.00",
        vatRate: DEFAULT_VAT,
      },
    ]);
  }

  function removeLine(key: string) {
    setLines((prev) => prev.filter((l) => l.key !== key));
  }

  function updateLine(key: string, patch: Partial<InvoiceLine>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    if (!clientId) {
      setError("Production sans client_id : facturation impossible.");
      setSubmitting(false);
      return;
    }

    const items = lines
      .map((l) => ({
        label: l.label.trim(),
        qty: safeNumber(l.qty),
        unitPriceHt: safeNumber(l.unitPriceHt),
        vatRate: safeNumber(l.vatRate),
      }))
      .filter((it) => it.label.length > 0);

    if (items.length === 0) {
      setError("Ajoutez au moins une ligne avec un libellé.");
      setSubmitting(false);
      return;
    }

    try {
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          productionId,
          status: "draft",
          subject: subject.trim() || null,
          notes: notes.trim() || null,
          issuedAt: issuedAt || null,
          dueDate: dueDate || null,
          items,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        id?: string;
        error?: string;
        message?: string;
      };
      if (!res.ok || !json?.id) {
        const msg =
          json?.message || json?.error || `Erreur création facture (HTTP ${res.status})`;
        setError(msg);
        return;
      }
      toast.success("Facture créée");
      onClose();
      router.push(`/documents/facture/${encodeURIComponent(json.id)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur réseau");
    } finally {
      setSubmitting(false);
    }
  }

  const emptyFinancials = oneshotHt <= 0 && subscriptions.every((s) => s.status !== "active");

  return (
    <FormModal open={open} onClose={onClose} title="Créer une facture">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Contexte production / client (lecture seule) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField label="Client">
            <div className="text-sm text-text-primary px-3 py-2.5 bg-surface-3 border border-border-subtle truncate">
              {clientName || clientId || "—"}
            </div>
          </FormField>
          <FormField label="Production">
            <div className="text-sm text-text-primary px-3 py-2.5 bg-surface-3 border border-border-subtle truncate">
              {productionTitle}
            </div>
          </FormField>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField label="Date d'émission">
            <input
              type="date"
              value={issuedAt}
              onChange={(e) => setIssuedAt(e.target.value)}
              className={inputClass}
              required
            />
          </FormField>
          <FormField label="Date d'échéance">
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className={inputClass}
            />
          </FormField>
        </div>

        <FormField label="Objet (subject)">
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className={inputClass}
            maxLength={255}
            placeholder="Facturation — …"
          />
        </FormField>

        {/* Lignes */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="block micro-label text-text-muted">Lignes</label>
            <button
              type="button"
              onClick={addLine}
              className="inline-flex items-center gap-1.5 px-2 py-1 text-[10px] font-bold uppercase tracking-tight border border-border-subtle bg-surface-2 text-text-primary hover:bg-surface-3"
            >
              <Plus className="w-3 h-3" />
              Ajouter une ligne
            </button>
          </div>

          {emptyFinancials && lines.length === 0 ? (
            <div className="card-sharp p-3 flex items-start gap-2 text-[12px] border-amber-400/30 bg-amber-400/5 text-amber-200">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>
                Production sans données financières — saisissez manuellement
                les lignes via &laquo;&nbsp;Ajouter une ligne&nbsp;&raquo;.
              </span>
            </div>
          ) : null}

          {lines.length === 0 ? null : (
            <div className="space-y-2">
              {lines.map((line) => (
                <div
                  key={line.key}
                  className="grid grid-cols-12 gap-2 items-start"
                >
                  <input
                    type="text"
                    value={line.label}
                    onChange={(e) => updateLine(line.key, { label: e.target.value })}
                    placeholder="Libellé"
                    className={`${inputClass} col-span-12 sm:col-span-5`}
                    required
                  />
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    value={line.qty}
                    onChange={(e) => updateLine(line.key, { qty: e.target.value })}
                    placeholder="Qté"
                    className={`${inputClass} col-span-3 sm:col-span-1 tabular-nums`}
                    required
                  />
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    value={line.unitPriceHt}
                    onChange={(e) =>
                      updateLine(line.key, { unitPriceHt: e.target.value })
                    }
                    placeholder="P.U. HT"
                    className={`${inputClass} col-span-4 sm:col-span-3 tabular-nums`}
                    required
                  />
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.1"
                    min="0"
                    max="100"
                    value={line.vatRate}
                    onChange={(e) =>
                      updateLine(line.key, { vatRate: e.target.value })
                    }
                    placeholder="TVA %"
                    className={`${inputClass} col-span-3 sm:col-span-2 tabular-nums`}
                  />
                  <button
                    type="button"
                    onClick={() => removeLine(line.key)}
                    aria-label="Supprimer la ligne"
                    className="col-span-2 sm:col-span-1 inline-flex items-center justify-center px-2 py-2.5 text-rose-300 hover:text-rose-200 hover:bg-rose-500/10 border border-border-subtle"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Totaux */}
        <div className="grid grid-cols-3 gap-2 text-[12px] border-t border-border-subtle pt-3">
          <div>
            <div className="text-[9px] uppercase tracking-widest text-text-muted">
              Total HT
            </div>
            <div className="text-sm font-bold tabular-nums text-text-primary">
              {fmtMoney(totals.ht)}
            </div>
          </div>
          <div>
            <div className="text-[9px] uppercase tracking-widest text-text-muted">
              TVA
            </div>
            <div className="text-sm font-bold tabular-nums text-text-primary">
              {fmtMoney(totals.vat)}
            </div>
          </div>
          <div>
            <div className="text-[9px] uppercase tracking-widest text-text-muted">
              Total TTC
            </div>
            <div className="text-sm font-bold tabular-nums text-accent-glow">
              {fmtMoney(totals.ttc)}
            </div>
          </div>
        </div>

        <FormField label="Notes (optionnel)">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className={`${inputClass} min-h-[72px] resize-y`}
            maxLength={2000}
            placeholder="Mentions complémentaires, conditions particulières…"
          />
        </FormField>

        {error ? (
          <div className="card-sharp p-3 flex items-start gap-2 text-[12px] border-rose-400/30 bg-rose-400/5 text-rose-200">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        ) : null}

        <div className="flex items-center justify-end gap-2 pt-2">
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
            disabled={submitting || lines.length === 0}
          >
            {submitting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : null}
            Créer la facture
          </button>
        </div>
      </form>
    </FormModal>
  );
}
