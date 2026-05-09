"use client";

// V1.1.D Phase 2 — Modal "Nouvelle affaire" (cockpit app.mybotia.com).
//
// Doctrine "app.mybotia = parité CRM" : toute fonction biz exposée côté
// cockpit. Cible /api/affaires (proxy → mybotia-business /api/v1/affaires).
//
// Champs spec V1.1.D :
//   - title (required), clientId (required), stage (lead par défaut),
//     ownerUserId (optionnel), expectedCloseDate, oneshotAmountHt, mrrHt,
//     description.
//
// Validation : Zod côté client + erreurs serveur (`validation_error` et
// codes biz comme `feature_disabled` / `crm_provider_not_business`).
// V1.1.H.1 P0-UX-2 — anti-perte de saisie : draft localStorage.

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RotateCcw, X } from "lucide-react";
import { z } from "zod";

import {
  FormModal,
  FormField,
  inputClass,
  selectClass,
  btnPrimary,
  btnSecondary,
} from "@/components/shared/FormModal";
import { useScopedClients } from "@/hooks/use-api";
import { toast } from "@/components/shared/Toast";
import { useFormDraft } from "@/hooks/use-form-draft";

const DRAFT_KEY = "draft:create-affaire";

type AffaireDraft = {
  title: string;
  clientId: string;
  stage: string;
  ownerUserId: string;
  expectedCloseDate: string;
  oneshotAmountHt: string;
  mrrHt: string;
  description: string;
};

const emptyAffaireDraft: AffaireDraft = {
  title: "",
  clientId: "",
  stage: "lead",
  ownerUserId: "",
  expectedCloseDate: "",
  oneshotAmountHt: "",
  mrrHt: "",
  description: "",
};

const STAGE_OPTIONS = [
  { value: "lead", label: "Prospect" },
  { value: "qualified", label: "Qualifié" },
  { value: "quoted", label: "Devis envoyé" },
  { value: "negotiating", label: "En négo" },
] as const;

// Mapping stages UI -> business : business N'accepte que lead/qualified dans
// son enum côté API (cf. STAGE_ENUM dans /api/v1/affaires/route.ts qui couvre
// le superset). On laisse l'enum complète mais on valide ici.
const ALLOWED_BIZ_STAGES = [
  "lead",
  "qualified",
  "won",
  "lost",
  "active",
  "paused",
  "done",
  "cancelled",
  "abandoned",
] as const;

const formSchema = z.object({
  title: z.string().trim().min(1, "Le titre est requis").max(255),
  clientId: z.string().uuid("Client requis"),
  stage: z.enum(ALLOWED_BIZ_STAGES),
  ownerUserId: z.string().uuid().optional().or(z.literal("")),
  expectedCloseDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide")
    .optional()
    .or(z.literal("")),
  description: z.string().optional(),
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

export function CreateAffaireModal({
  open,
  onClose,
  onCreated,
  defaultClientId,
  lockClient = false,
}: {
  open: boolean;
  onClose: () => void;
  onCreated?: (affaireId: string) => void;
  defaultClientId?: string;
  lockClient?: boolean;
}) {
  const router = useRouter();
  const { data: clients, loading: clientsLoading } = useScopedClients();

  const [creating, setCreating] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // V1.1.H.1 P0-UX-2 — draft
  const [affaireDraft, setAffaireDraft] = useState<AffaireDraft>({
    ...emptyAffaireDraft,
    clientId: defaultClientId ?? "",
  });
  const { hasDraft, clearDraft } = useFormDraft(DRAFT_KEY, affaireDraft, setAffaireDraft);
  const [draftBannerDismissed, setDraftBannerDismissed] = useState(false);

  // Reset state when (re)opening
  useEffect(() => {
    if (!open) return;
    setGlobalError(null);
    setFieldErrors({});
    setDraftBannerDismissed(false);
  }, [open]);

  const sortedClients = useMemo(
    () =>
      [...clients].sort((a, b) =>
        (a.company || a.name || "").localeCompare(b.company || b.name || ""),
      ),
    [clients],
  );

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setCreating(true);
    setGlobalError(null);
    setFieldErrors({});

    const raw = {
      title: affaireDraft.title.trim(),
      clientId: lockClient && defaultClientId ? defaultClientId : affaireDraft.clientId,
      stage: affaireDraft.stage || "lead",
      ownerUserId: affaireDraft.ownerUserId,
      expectedCloseDate: affaireDraft.expectedCloseDate,
      description: affaireDraft.description,
      oneshotAmountHt: affaireDraft.oneshotAmountHt,
      mrrHt: affaireDraft.mrrHt,
    };

    const parsed = formSchema.safeParse(raw);
    if (!parsed.success) {
      const fe: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const k = String(issue.path[0] ?? "");
        if (k && !fe[k]) fe[k] = issue.message;
      }
      setFieldErrors(fe);
      setCreating(false);
      return;
    }

    const v = parsed.data;
    const body: Record<string, unknown> = {
      title: v.title,
      clientId: v.clientId,
      status: v.stage,
    };
    if (v.ownerUserId) body.ownerUserId = v.ownerUserId;
    if (v.expectedCloseDate) body.expectedCloseDate = v.expectedCloseDate;
    if (v.oneshotAmountHt) body.oneshotAmountHt = v.oneshotAmountHt;
    if (v.mrrHt) body.mrrHt = v.mrrHt;
    if (v.description) body.description = v.description;

    try {
      const res = await fetch("/api/affaires", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json().catch(() => ({}))) as {
        id?: string;
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
          setGlobalError("Validation serveur en échec.");
        } else if (json.error === "feature_disabled") {
          setGlobalError(
            "Module Pipeline non activé pour ce tenant. Contactez votre admin.",
          );
        } else if (json.error === "crm_provider_not_business") {
          setGlobalError(
            "Ce tenant n'est pas câblé sur mybotia_business. Création d'affaire impossible.",
          );
        } else if (res.status === 401 || res.status === 403) {
          setGlobalError("Authentification requise — reconnectez-vous.");
        } else {
          setGlobalError(
            json.message || json.error || `Erreur serveur (HTTP ${res.status})`,
          );
        }
        return;
      }

      const newId = String(json.id ?? "");
      toast.success("Affaire créée");
      // V1.1.H.1 — submit success : nettoyer le brouillon
      clearDraft();
      setAffaireDraft(emptyAffaireDraft);
      onCreated?.(newId);
      onClose();
      if (newId) router.push(`/affaires/${newId}`);
    } catch (err) {
      setGlobalError(err instanceof Error ? err.message : "Erreur réseau");
    } finally {
      setCreating(false);
    }
  }

  return (
    <FormModal open={open} onClose={onClose} title="Nouvelle affaire">
      {/* V1.1.H.1 — ruban brouillon restauré */}
      {hasDraft && !draftBannerDismissed && (
        <div className="flex items-center justify-between gap-2 mb-3 px-3 py-2 bg-amber-400/10 border border-amber-400/30 text-amber-300 text-[11px]">
          <span className="flex items-center gap-1.5">
            <RotateCcw className="w-3 h-3" />
            Brouillon restauré
          </span>
          <button
            type="button"
            onClick={() => { clearDraft(); setAffaireDraft(emptyAffaireDraft); setDraftBannerDismissed(true); }}
            className="flex items-center gap-0.5 hover:text-amber-100"
            title="Effacer le brouillon"
          >
            <X className="w-3 h-3" /> Effacer
          </button>
        </div>
      )}
      <form onSubmit={handleSubmit} noValidate>
        <FormField label="Titre *">
          <input
            name="title"
            required
            autoFocus
            className={inputClass}
            placeholder="Ex : Refonte site Cabinet Martin"
            value={affaireDraft.title}
            onChange={(e) => setAffaireDraft((d) => ({ ...d, title: e.target.value }))}
          />
          {fieldErrors.title && (
            <p className="text-xs text-rose-300 mt-1">{fieldErrors.title}</p>
          )}
        </FormField>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Client *">
            {lockClient && defaultClientId && (
              <input type="hidden" name="clientId" value={defaultClientId} />
            )}
            <select
              name={lockClient ? "_clientId_display" : "clientId"}
              className={selectClass}
              value={lockClient ? (defaultClientId ?? "") : affaireDraft.clientId}
              onChange={(e) => !lockClient && setAffaireDraft((d) => ({ ...d, clientId: e.target.value }))}
              disabled={lockClient || clientsLoading}
              required={!lockClient}
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

          <FormField label="Stage">
            <select
              name="stage"
              className={selectClass}
              value={affaireDraft.stage}
              onChange={(e) => setAffaireDraft((d) => ({ ...d, stage: e.target.value }))}
            >
              {STAGE_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </FormField>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Propriétaire (UUID utilisateur)">
            <input
              name="ownerUserId"
              className={inputClass}
              placeholder="Optionnel"
              value={affaireDraft.ownerUserId}
              onChange={(e) => setAffaireDraft((d) => ({ ...d, ownerUserId: e.target.value }))}
            />
            {fieldErrors.ownerUserId && (
              <p className="text-xs text-rose-300 mt-1">
                {fieldErrors.ownerUserId}
              </p>
            )}
          </FormField>
          <FormField label="Date close prévue">
            <input
              name="expectedCloseDate"
              type="date"
              className={inputClass}
              value={affaireDraft.expectedCloseDate}
              onChange={(e) => setAffaireDraft((d) => ({ ...d, expectedCloseDate: e.target.value }))}
            />
            {fieldErrors.expectedCloseDate && (
              <p className="text-xs text-rose-300 mt-1">
                {fieldErrors.expectedCloseDate}
              </p>
            )}
          </FormField>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Montant potentiel one-shot HT (€)">
            <input
              name="oneshotAmountHt"
              type="number"
              step="0.01"
              min="0"
              className={inputClass}
              placeholder="0.00"
              value={affaireDraft.oneshotAmountHt}
              onChange={(e) => setAffaireDraft((d) => ({ ...d, oneshotAmountHt: e.target.value }))}
            />
            {fieldErrors.oneshotAmountHt && (
              <p className="text-xs text-rose-300 mt-1">
                {fieldErrors.oneshotAmountHt}
              </p>
            )}
          </FormField>
          <FormField label="MRR potentiel HT (€/mois)">
            <input
              name="mrrHt"
              type="number"
              step="0.01"
              min="0"
              className={inputClass}
              placeholder="0.00"
              value={affaireDraft.mrrHt}
              onChange={(e) => setAffaireDraft((d) => ({ ...d, mrrHt: e.target.value }))}
            />
            {fieldErrors.mrrHt && (
              <p className="text-xs text-rose-300 mt-1">{fieldErrors.mrrHt}</p>
            )}
          </FormField>
        </div>

        <FormField label="Notes">
          <textarea
            name="description"
            rows={3}
            className={inputClass}
            placeholder="Objectifs, périmètre, contexte…"
            value={affaireDraft.description}
            onChange={(e) => setAffaireDraft((d) => ({ ...d, description: e.target.value }))}
          />
        </FormField>

        {globalError && (
          <p className="text-xs text-rose-300 mt-2">{globalError}</p>
        )}

        <div className="flex items-center justify-end gap-3 mt-6">
          <button type="button" onClick={onClose} className={btnSecondary}>
            Annuler
          </button>
          <button type="submit" disabled={creating} className={btnPrimary}>
            {creating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Créer
          </button>
        </div>
      </form>
    </FormModal>
  );
}
