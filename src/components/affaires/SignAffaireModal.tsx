"use client";

// V1.1.D Phase 2 — Modal "Marquer comme signée".
//
// Doctrine revenus mixtes natifs (doctrine_production_revenus_mixtes.md) :
//   - billingMode = one_shot | recurring | mixed (mixed = défaut quand
//     l'affaire porte un MRR et un one-shot).
//   - Plusieurs abonnements récurrents possibles (label libre + MRR HT +
//     billing_cycle + date début).
//
// POST /api/affaires/[id]/sign (proxy → business). Sur succès :
//   toast + redirect /productions/[id] (l'id reste le même, lifecycle change).
// Idempotence : 409 already_signed → toast "Cette affaire est déjà signée".

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
import { toast } from "@/components/shared/Toast";
import { useQuotesByClient, type QuoteRow } from "@/hooks/use-api";

type BillingMode = "one_shot" | "recurring" | "mixed";
type BillingCycle = "monthly" | "quarterly" | "yearly";

const BILLING_LABEL: Record<BillingMode, string> = {
  one_shot: "One-shot",
  recurring: "Récurrent (abonnement)",
  mixed: "Mixte (one-shot + récurrent)",
};

const CYCLE_LABEL: Record<BillingCycle, string> = {
  monthly: "Mensuel",
  quarterly: "Trimestriel",
  yearly: "Annuel",
};

type SubLine = {
  key: string;
  label: string;
  mrrHt: string;
  billingCycle: BillingCycle;
  startedAt: string;
};

const moneyRegex = /^-?\d+(\.\d{1,2})?$/;
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

const subSchema = z.object({
  label: z.string().trim().min(1, "Libellé requis").max(255),
  mrrHt: z.string().regex(moneyRegex, "Montant invalide"),
  billingCycle: z.enum(["monthly", "quarterly", "yearly"]),
  startedAt: z.string().regex(dateRegex, "Date invalide"),
});

const formSchema = z
  .object({
    acceptedQuoteId: z.string().uuid("Sélectionnez un devis accepté"),
    billingMode: z.enum(["one_shot", "recurring", "mixed"]),
    oneshotAmountHt: z.string().regex(moneyRegex, "Montant invalide").optional().or(z.literal("")),
    signedAt: z.string().regex(dateRegex, "Date invalide"),
    subs: z.array(subSchema),
  })
  .superRefine((val, ctx) => {
    if (
      (val.billingMode === "one_shot" || val.billingMode === "mixed") &&
      (!val.oneshotAmountHt || val.oneshotAmountHt === "")
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["oneshotAmountHt"],
        message: "Montant one-shot requis pour ce mode",
      });
    }
    if (
      (val.billingMode === "recurring" || val.billingMode === "mixed") &&
      val.subs.length === 0
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["subs"],
        message: "Ajoutez au moins une ligne d'abonnement",
      });
    }
  });

const todayIso = () => new Date().toISOString().slice(0, 10);

function fmtMoney(value: string | number) {
  const n = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });
}

export function SignAffaireModal({
  open,
  onClose,
  affaireId,
  clientId,
  defaultOneshotHt,
  defaultMrrHt,
}: {
  open: boolean;
  onClose: () => void;
  affaireId: string;
  clientId: string;
  defaultOneshotHt?: string | null;
  defaultMrrHt?: string | null;
}) {
  const router = useRouter();

  const { data: quotes, loading: quotesLoading } = useQuotesByClient(
    open ? clientId : null,
  );

  // Devis acceptés liés à cette affaire OU à ce client. La FK quotes.deal_id
  // (= projectId business) est livrée DDL file 08 ; on filtre côté client
  // avec fallback sur tous les devis acceptés du client.
  const acceptedQuotes = useMemo<QuoteRow[]>(() => {
    const dealLinked = quotes.filter(
      (q) => q.status === "accepted" && q.projectId === affaireId,
    );
    if (dealLinked.length > 0) return dealLinked;
    return quotes.filter((q) => q.status === "accepted");
  }, [quotes, affaireId]);

  const [billingMode, setBillingMode] = useState<BillingMode>("mixed");
  const [acceptedQuoteId, setAcceptedQuoteId] = useState<string>("");
  const [oneshotAmountHt, setOneshotAmountHt] = useState<string>("");
  const [signedAt, setSignedAt] = useState<string>(todayIso());
  const [subs, setSubs] = useState<SubLine[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [subErrors, setSubErrors] = useState<
    Array<Partial<Record<keyof SubLine, string>>>
  >([]);

  // Reset on open
  useEffect(() => {
    if (!open) return;
    setGlobalError(null);
    setFieldErrors({});
    setSubErrors([]);
    setSignedAt(todayIso());
    const oneshot = defaultOneshotHt ?? "";
    const mrr = defaultMrrHt ?? "";
    const oneshotN = Number(oneshot);
    const mrrN = Number(mrr);
    const inferred: BillingMode =
      mrrN > 0 && oneshotN > 0
        ? "mixed"
        : mrrN > 0
          ? "recurring"
          : "one_shot";
    setBillingMode(inferred);
    setOneshotAmountHt(oneshot && oneshotN > 0 ? oneshot : "");
    if (mrrN > 0) {
      setSubs([
        {
          key: `seed-${Date.now()}`,
          label: "Abonnement principal",
          mrrHt: mrr,
          billingCycle: "monthly",
          startedAt: todayIso(),
        },
      ]);
    } else {
      setSubs([]);
    }
  }, [open, defaultMrrHt, defaultOneshotHt]);

  // Auto-snapshot one-shot depuis le devis sélectionné si vide
  useEffect(() => {
    if (!acceptedQuoteId) return;
    const q = acceptedQuotes.find((x) => x.id === acceptedQuoteId);
    if (q && !oneshotAmountHt) {
      setOneshotAmountHt(q.subtotalHt);
    }
  }, [acceptedQuoteId, acceptedQuotes, oneshotAmountHt]);

  // Pré-sélection du devis si une seule option et acceptedQuoteId vide
  useEffect(() => {
    if (!acceptedQuoteId && acceptedQuotes.length === 1) {
      setAcceptedQuoteId(acceptedQuotes[0].id);
    }
  }, [acceptedQuoteId, acceptedQuotes]);

  function addSub() {
    setSubs((prev) => [
      ...prev,
      {
        key: `sub-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        label: "",
        mrrHt: "",
        billingCycle: "monthly",
        startedAt: todayIso(),
      },
    ]);
  }

  function removeSub(key: string) {
    setSubs((prev) => prev.filter((s) => s.key !== key));
  }

  function updateSub(key: string, patch: Partial<SubLine>) {
    setSubs((prev) => prev.map((s) => (s.key === key ? { ...s, ...patch } : s)));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setGlobalError(null);
    setFieldErrors({});
    setSubErrors([]);

    const payload = {
      acceptedQuoteId,
      billingMode,
      oneshotAmountHt,
      signedAt,
      subs: subs.map((s) => ({
        label: s.label.trim(),
        mrrHt: s.mrrHt,
        billingCycle: s.billingCycle,
        startedAt: s.startedAt,
      })),
    };

    const parsed = formSchema.safeParse(payload);
    if (!parsed.success) {
      const fe: Record<string, string> = {};
      const subErrs: Array<Partial<Record<keyof SubLine, string>>> = subs.map(
        () => ({}),
      );
      for (const issue of parsed.error.issues) {
        const [head, idx, key] = issue.path;
        if (head === "subs" && typeof idx === "number" && typeof key === "string") {
          subErrs[idx] = {
            ...(subErrs[idx] ?? {}),
            [key as keyof SubLine]: issue.message,
          };
        } else if (typeof head === "string") {
          if (!fe[head]) fe[head] = issue.message;
        }
      }
      setFieldErrors(fe);
      setSubErrors(subErrs);
      setSubmitting(false);
      return;
    }

    // Build body camelCase exact attendu par business sign route
    const body: Record<string, unknown> = {
      acceptedQuoteId: parsed.data.acceptedQuoteId,
      billingMode: parsed.data.billingMode,
      recurringSubscriptions:
        parsed.data.billingMode === "one_shot"
          ? []
          : parsed.data.subs.map((s) => ({
              label: s.label,
              mrrHt: s.mrrHt,
              billingCycle: s.billingCycle,
              startedAt: s.startedAt,
            })),
    };
    if (parsed.data.oneshotAmountHt) {
      body.oneshotAmountHt = parsed.data.oneshotAmountHt;
    }

    try {
      const res = await fetch(
        `/api/affaires/${encodeURIComponent(affaireId)}/sign`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const json = (await res.json().catch(() => ({}))) as {
        production?: { id: string };
        data?: { production?: { id: string } };
        error?: string;
        message?: string;
        details?: { fieldErrors?: Record<string, string[]> };
      };

      if (res.status === 409 || json.error === "already_signed") {
        toast.info("Cette affaire est déjà signée");
        onClose();
        router.push(`/productions/${affaireId}`);
        return;
      }

      if (!res.ok) {
        if (json.error === "validation_error" && json.details?.fieldErrors) {
          const fe: Record<string, string> = {};
          for (const [k, msgs] of Object.entries(json.details.fieldErrors)) {
            if (Array.isArray(msgs) && msgs[0]) fe[k] = msgs[0];
          }
          setFieldErrors(fe);
          setGlobalError("Validation serveur en échec.");
        } else if (json.error === "module_disabled") {
          setGlobalError("Module Pipeline non activé pour ce tenant.");
        } else if (json.error === "insufficient_scope") {
          setGlobalError("Droits insuffisants pour signer une affaire.");
        } else if (res.status === 401) {
          setGlobalError("Authentification requise — reconnectez-vous.");
        } else {
          setGlobalError(
            json.message || json.error || `Erreur serveur (HTTP ${res.status})`,
          );
        }
        return;
      }

      const productionId =
        json.production?.id ?? json.data?.production?.id ?? affaireId;
      toast.success("Affaire signée → Production créée");
      onClose();
      router.push(`/productions/${productionId}`);
    } catch (err) {
      setGlobalError(err instanceof Error ? err.message : "Erreur réseau");
    } finally {
      setSubmitting(false);
    }
  }

  const noAccepted = !quotesLoading && acceptedQuotes.length === 0;
  const showOneshot = billingMode === "one_shot" || billingMode === "mixed";
  const showSubs = billingMode === "recurring" || billingMode === "mixed";

  return (
    <FormModal
      open={open}
      onClose={onClose}
      title="Marquer l'affaire comme signée"
    >
      <form onSubmit={handleSubmit} noValidate>
        <FormField label="Devis accepté *">
          {quotesLoading ? (
            <p className="text-xs text-text-muted">Chargement des devis…</p>
          ) : noAccepted ? (
            <div className="text-xs text-amber-200 bg-amber-400/10 border border-amber-400/30 px-3 py-2">
              Acceptez d&apos;abord un devis avant de signer cette affaire.
            </div>
          ) : (
            <select
              value={acceptedQuoteId}
              onChange={(e) => setAcceptedQuoteId(e.target.value)}
              className={selectClass}
              required
            >
              <option value="">-- Sélectionner --</option>
              {acceptedQuotes.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.number} — {fmtMoney(q.subtotalHt)} HT
                </option>
              ))}
            </select>
          )}
          {fieldErrors.acceptedQuoteId && (
            <p className="text-xs text-rose-300 mt-1">
              {fieldErrors.acceptedQuoteId}
            </p>
          )}
        </FormField>

        <FormField label="Mode de facturation">
          <select
            value={billingMode}
            onChange={(e) => setBillingMode(e.target.value as BillingMode)}
            className={selectClass}
          >
            {(Object.keys(BILLING_LABEL) as BillingMode[]).map((m) => (
              <option key={m} value={m}>
                {BILLING_LABEL[m]}
              </option>
            ))}
          </select>
        </FormField>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {showOneshot && (
            <FormField label="Montant one-shot HT (€)">
              <input
                type="number"
                step="0.01"
                min="0"
                value={oneshotAmountHt}
                onChange={(e) => setOneshotAmountHt(e.target.value)}
                className={inputClass}
                placeholder="0.00"
                required={showOneshot}
              />
              {fieldErrors.oneshotAmountHt && (
                <p className="text-xs text-rose-300 mt-1">
                  {fieldErrors.oneshotAmountHt}
                </p>
              )}
            </FormField>
          )}
          <FormField label="Date de signature *">
            <input
              type="date"
              value={signedAt}
              onChange={(e) => setSignedAt(e.target.value)}
              className={inputClass}
              required
            />
            {fieldErrors.signedAt && (
              <p className="text-xs text-rose-300 mt-1">
                {fieldErrors.signedAt}
              </p>
            )}
          </FormField>
        </div>

        {showSubs && (
          <div className="mt-4 border border-border-subtle bg-surface-2 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-text-primary">
                Abonnements récurrents
              </h3>
              <button
                type="button"
                onClick={addSub}
                className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-tight text-accent-glow hover:text-text-primary"
              >
                <Plus className="w-3.5 h-3.5" />
                Ajouter
              </button>
            </div>
            {subs.length === 0 && (
              <p className="text-xs text-text-muted italic">
                Aucun abonnement. Cliquez sur « Ajouter ».
              </p>
            )}
            {fieldErrors.subs && (
              <p className="text-xs text-rose-300 mb-2">{fieldErrors.subs}</p>
            )}
            <ul className="space-y-3">
              {subs.map((s, i) => {
                const errs = subErrors[i] ?? {};
                return (
                  <li
                    key={s.key}
                    className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-start"
                  >
                    <div className="sm:col-span-4">
                      <input
                        value={s.label}
                        onChange={(e) =>
                          updateSub(s.key, { label: e.target.value })
                        }
                        className={inputClass}
                        placeholder="Ex : Maintenance, Tokens"
                      />
                      {errs.label && (
                        <p className="text-xs text-rose-300 mt-1">
                          {errs.label}
                        </p>
                      )}
                    </div>
                    <div className="sm:col-span-3">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={s.mrrHt}
                        onChange={(e) =>
                          updateSub(s.key, { mrrHt: e.target.value })
                        }
                        className={inputClass}
                        placeholder="MRR HT"
                      />
                      {errs.mrrHt && (
                        <p className="text-xs text-rose-300 mt-1">
                          {errs.mrrHt}
                        </p>
                      )}
                    </div>
                    <div className="sm:col-span-2">
                      <select
                        value={s.billingCycle}
                        onChange={(e) =>
                          updateSub(s.key, {
                            billingCycle: e.target.value as BillingCycle,
                          })
                        }
                        className={selectClass}
                      >
                        {(Object.keys(CYCLE_LABEL) as BillingCycle[]).map(
                          (c) => (
                            <option key={c} value={c}>
                              {CYCLE_LABEL[c]}
                            </option>
                          ),
                        )}
                      </select>
                    </div>
                    <div className="sm:col-span-2">
                      <input
                        type="date"
                        value={s.startedAt}
                        onChange={(e) =>
                          updateSub(s.key, { startedAt: e.target.value })
                        }
                        className={inputClass}
                      />
                      {errs.startedAt && (
                        <p className="text-xs text-rose-300 mt-1">
                          {errs.startedAt}
                        </p>
                      )}
                    </div>
                    <div className="sm:col-span-1 flex justify-end">
                      <button
                        type="button"
                        onClick={() => removeSub(s.key)}
                        className="p-2 text-text-muted hover:text-rose-300"
                        aria-label="Supprimer cet abonnement"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {globalError && (
          <p className="text-xs text-rose-300 mt-3">{globalError}</p>
        )}

        <div className="flex items-center justify-end gap-3 mt-6">
          <button type="button" onClick={onClose} className={btnSecondary}>
            Annuler
          </button>
          <button
            type="submit"
            disabled={submitting || noAccepted}
            className={btnPrimary}
          >
            {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Confirmer la signature
          </button>
        </div>
      </form>
    </FormModal>
  );
}
