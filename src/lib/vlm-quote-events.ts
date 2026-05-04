// Bloc 7J — Helpers audit log + workflow transitions devis VLM.

import { adminQuery } from "./admin-db";
import type { VlmQuoteStatus } from "./vlm-quote-types";

export const VLM_QUOTE_EVENT_TYPES = [
  "quote_created",
  "quote_created_from_deal",
  "quote_updated",
  "quote_status_changed",
  "line_added",
  "line_updated",
  "line_deleted",
  "pdf_downloaded",
  "quote_cancelled",
] as const;
export type VlmQuoteEventType = (typeof VLM_QUOTE_EVENT_TYPES)[number];

export interface VlmQuoteEvent {
  id: string;
  tenantId: string;
  quoteId: string;
  actorEmail: string | null;
  eventType: VlmQuoteEventType;
  beforeJsonb: Record<string, unknown> | null;
  afterJsonb: Record<string, unknown> | null;
  createdAt: string;
}

// ===================================================================
// Workflow : transitions de statut autorisées
// ===================================================================
// draft     → sent       (envoi commercial)
// draft     → cancelled  (abandon avant envoi)
// sent      → accepted   (validation client)
// sent      → refused    (refus client)
// sent      → cancelled  (rétractation côté VLM)
// accepted  → (terminal — aucune transition)
// refused   → (terminal — aucune transition)
// cancelled → (terminal — aucune transition)

const TRANSITIONS: Record<VlmQuoteStatus, VlmQuoteStatus[]> = {
  draft: ["sent", "cancelled"],
  sent: ["accepted", "refused", "cancelled"],
  accepted: [],
  refused: [],
  cancelled: [],
};

export function isAllowedTransition(from: VlmQuoteStatus, to: VlmQuoteStatus): boolean {
  if (from === to) return true; // no-op safe
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function isQuoteEditable(status: VlmQuoteStatus): boolean {
  return status === "draft";
}

// ===================================================================
// Insert event (best-effort, n'interrompt jamais une mutation principale)
// ===================================================================

interface LogEventArgs {
  tenantId: string;
  quoteId: string;
  actorEmail: string | null;
  eventType: VlmQuoteEventType;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
}

export async function logVlmQuoteEvent(args: LogEventArgs): Promise<void> {
  try {
    await adminQuery(
      `INSERT INTO core.vlm_quote_events
         (tenant_id, quote_id, actor_email, event_type, before_jsonb, after_jsonb)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [
        args.tenantId,
        args.quoteId,
        args.actorEmail,
        args.eventType,
        args.before ? JSON.stringify(args.before) : null,
        args.after ? JSON.stringify(args.after) : null,
      ]
    );
  } catch (e) {
    // Audit log best-effort : on ne casse jamais une mutation à cause du log
    console.error("[7J] logVlmQuoteEvent failed:", e instanceof Error ? e.message : String(e));
  }
}

// ===================================================================
// Liste events d'un devis
// ===================================================================

interface EventRow {
  id: string;
  tenant_id: string;
  quote_id: string;
  actor_email: string | null;
  event_type: VlmQuoteEventType;
  before_jsonb: Record<string, unknown> | null;
  after_jsonb: Record<string, unknown> | null;
  created_at: string;
}

function mapEvent(r: EventRow): VlmQuoteEvent {
  return {
    id: r.id,
    tenantId: r.tenant_id,
    quoteId: r.quote_id,
    actorEmail: r.actor_email,
    eventType: r.event_type,
    beforeJsonb: r.before_jsonb,
    afterJsonb: r.after_jsonb,
    createdAt: r.created_at,
  };
}

export async function listVlmQuoteEvents(quoteId: string): Promise<VlmQuoteEvent[]> {
  const rows = await adminQuery<EventRow>(
    `SELECT id, tenant_id, quote_id, actor_email, event_type,
            before_jsonb, after_jsonb,
            to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at
       FROM core.vlm_quote_events
      WHERE quote_id = $1
      ORDER BY created_at DESC`,
    [quoteId]
  );
  return rows.map(mapEvent);
}

// ===================================================================
// Sanitize : retirer toute clé suspecte avant log (défense en profondeur)
// ===================================================================
const FORBIDDEN_KEYS = /token|secret|password|cookie|authorization|bearer/i;

export function sanitizeForLog<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (FORBIDDEN_KEYS.test(k)) continue;
    out[k] = v;
  }
  return out;
}

export const VLM_QUOTE_EVENT_LABEL: Record<VlmQuoteEventType, string> = {
  quote_created: "création devis",
  quote_created_from_deal: "création depuis deal",
  quote_updated: "modification devis",
  quote_status_changed: "changement de statut",
  line_added: "ajout ligne",
  line_updated: "modification ligne",
  line_deleted: "suppression ligne",
  pdf_downloaded: "téléchargement PDF",
  quote_cancelled: "annulation",
};
