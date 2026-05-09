/**
 * Labels FR partagés — affaires, deals (pipeline cockpit), devis, factures.
 *
 * Source unique pour tous les écrans cockpit : Today, Affaires, Pipeline, etc.
 * Doctrine produit (V1.1) : aucun stage / statut affiché en anglais brut côté UI.
 *
 * Deux familles de stages cohabitent :
 *   - `AffaireStatus` (lead/qualified/active/...) → modèle business
 *     (`projects.lifecycle_stage='affaire'` ou status projet).
 *   - `DealStage` (discovery/proposal/negotiation/closing/won/lost) → modèle
 *     pipeline historique (`Deal` côté dashboard cockpit).
 *
 * Les deux maps sont exposées séparément pour éviter les collisions sémantiques
 * et permettre des couleurs distinctes par cycle.
 */

// ─── Affaire status (modèle business) ──────────────────────────────────────

export const AFFAIRE_STATUS_LABEL: Record<string, string> = {
  lead: "Prospect",
  qualified: "Qualifié",
  won: "Gagné",
  lost: "Perdu",
  active: "En cours",
  paused: "En attente",
  done: "Livré",
  cancelled: "Annulé",
  abandoned: "Abandonné",
};

export const AFFAIRE_STATUS_COLOR: Record<string, string> = {
  lead: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  qualified: "bg-violet-500/15 text-violet-300 border-violet-500/30",
  won: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  lost: "bg-rose-500/15 text-rose-300 border-rose-500/30",
  active: "bg-accent-primary/15 text-accent-glow border-accent-primary/30",
  paused: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  done: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  cancelled: "bg-rose-500/15 text-rose-300 border-rose-500/30",
  abandoned: "bg-zinc-500/15 text-zinc-300 border-zinc-500/30",
};

// Aliases pour compatibilité avec l'ancien import dans /affaires.
export const STAGE_LABEL = AFFAIRE_STATUS_LABEL;
export const STAGE_COLOR = AFFAIRE_STATUS_COLOR;

// ─── Deal stage (modèle pipeline cockpit dashboard) ────────────────────────

/**
 * Stages du pipeline cockpit (`type DealStage` dans `@/types`).
 * Source : `/api/dashboard` → `Deal.stage`.
 */
export const DEAL_STAGE_LABEL: Record<string, string> = {
  discovery: "Découverte",
  proposal: "Proposition",
  negotiation: "Négociation",
  closing: "Closing",
  won: "Gagné",
  lost: "Perdu",
};

export const DEAL_STAGE_COLOR: Record<string, string> = {
  discovery: "text-blue-300",
  proposal: "text-violet-300",
  negotiation: "text-amber-300",
  closing: "text-accent-glow",
  won: "text-emerald-300",
  lost: "text-rose-300",
};

// ─── Statuts devis ─────────────────────────────────────────────────────────

/**
 * Statuts devis cockpit (`DashboardProposal.status`).
 * Aligné sur le mapping Dolibarr : draft/validated/signed/refused/billed.
 */
export const PROPOSAL_STATUS_LABEL: Record<string, string> = {
  draft: "Brouillon",
  validated: "Envoyé",
  sent: "Envoyé",
  signed: "Signé",
  accepted: "Accepté",
  refused: "Refusé",
  billed: "Facturé",
};

export const PROPOSAL_STATUS_COLOR: Record<string, string> = {
  draft: "text-text-muted",
  validated: "text-blue-300",
  sent: "text-blue-300",
  signed: "text-emerald-300",
  accepted: "text-emerald-300",
  refused: "text-rose-300",
  billed: "text-accent-glow",
};

// ─── Statuts factures ──────────────────────────────────────────────────────

export const INVOICE_STATUS_LABEL: Record<string, string> = {
  draft: "Brouillon",
  sent: "Envoyée",
  paid: "Payée",
  late: "En retard",
};

export const INVOICE_STATUS_COLOR: Record<string, string> = {
  draft: "text-text-muted",
  sent: "text-blue-300",
  paid: "text-emerald-300",
  late: "text-status-danger",
};

// ─── Helpers ───────────────────────────────────────────────────────────────

export function affaireStatusLabel(status: string | undefined | null): string {
  if (!status) return "—";
  return AFFAIRE_STATUS_LABEL[status] ?? status;
}

export function dealStageLabel(stage: string | undefined | null): string {
  if (!stage) return "—";
  return DEAL_STAGE_LABEL[stage] ?? stage;
}

export function proposalStatusLabel(status: string | undefined | null): string {
  if (!status) return "—";
  return PROPOSAL_STATUS_LABEL[status] ?? status;
}

export function invoiceStatusLabel(status: string | undefined | null): string {
  if (!status) return "—";
  return INVOICE_STATUS_LABEL[status] ?? status;
}
