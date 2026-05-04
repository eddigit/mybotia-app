// Bloc 7H — helpers DB pour devis VL Medical.

import { adminQuery } from "./admin-db";
import { VLM_SLUG } from "./vlm-access";
import type {
  VlmQuote,
  VlmQuoteLine,
  VlmQuoteStatus,
} from "./vlm-quote-types";

interface QuoteRow {
  id: string;
  tenant_id: string;
  tenant_slug: string;
  deal_id: string | null;
  deal_ref: string | null;
  ref: string;
  client_name: string;
  client_email: string | null;
  client_address: string | null;
  title: string;
  status: VlmQuoteStatus;
  currency: string;
  valid_until: string | null;
  notes: string | null;
  terms: string | null;
  total_ht: string;
  total_vat: string;
  total_ttc: string;
  created_at: string;
  updated_at: string;
}

interface LineRow {
  id: string;
  tenant_id: string;
  quote_id: string;
  catalog_item_id: string | null;
  label: string;
  description: string | null;
  quantity: string;
  unit: string | null;
  unit_price_ht: string;
  vat_rate: string;
  line_total_ht: string;
  line_total_vat: string;
  line_total_ttc: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

const QUOTE_COLS = `q.id, q.tenant_id, t.slug AS tenant_slug,
  q.deal_id, cd.ref AS deal_ref,
  q.ref, q.client_name, q.client_email, q.client_address,
  q.title, q.status, q.currency,
  to_char(q.valid_until, 'YYYY-MM-DD') AS valid_until,
  q.notes, q.terms,
  q.total_ht, q.total_vat, q.total_ttc,
  to_char(q.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at,
  to_char(q.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS updated_at`;

const QUOTE_FROM = `core.vlm_quotes q
  JOIN core.tenant t ON t.id = q.tenant_id
  LEFT JOIN core.vlm_container_deals cd ON cd.id = q.deal_id`;

const LINE_COLS = `l.id, l.tenant_id, l.quote_id, l.catalog_item_id,
  l.label, l.description, l.quantity, l.unit,
  l.unit_price_ht, l.vat_rate,
  l.line_total_ht, l.line_total_vat, l.line_total_ttc, l.sort_order,
  to_char(l.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at,
  to_char(l.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS updated_at`;

function num(v: string | null): number {
  return v === null ? 0 : parseFloat(v) || 0;
}

export function mapQuote(r: QuoteRow): VlmQuote {
  return {
    id: r.id,
    tenantId: r.tenant_id,
    tenantSlug: r.tenant_slug,
    dealId: r.deal_id,
    dealRef: r.deal_ref,
    ref: r.ref,
    clientName: r.client_name,
    clientEmail: r.client_email,
    clientAddress: r.client_address,
    title: r.title,
    status: r.status,
    currency: r.currency,
    validUntil: r.valid_until,
    notes: r.notes,
    terms: r.terms,
    totalHt: num(r.total_ht),
    totalVat: num(r.total_vat),
    totalTtc: num(r.total_ttc),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function mapLine(r: LineRow): VlmQuoteLine {
  return {
    id: r.id,
    tenantId: r.tenant_id,
    quoteId: r.quote_id,
    catalogItemId: r.catalog_item_id,
    label: r.label,
    description: r.description,
    quantity: num(r.quantity),
    unit: r.unit,
    unitPriceHt: num(r.unit_price_ht),
    vatRate: num(r.vat_rate),
    lineTotalHt: num(r.line_total_ht),
    lineTotalVat: num(r.line_total_vat),
    lineTotalTtc: num(r.line_total_ttc),
    sortOrder: r.sort_order,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function listVlmQuotes(): Promise<VlmQuote[]> {
  const rows = await adminQuery<QuoteRow>(
    `SELECT ${QUOTE_COLS}
       FROM ${QUOTE_FROM}
      WHERE t.slug = $1
      ORDER BY q.created_at DESC`,
    [VLM_SLUG]
  );
  return rows.map(mapQuote);
}

export async function getVlmQuote(id: string): Promise<VlmQuote | null> {
  const rows = await adminQuery<QuoteRow>(
    `SELECT ${QUOTE_COLS}
       FROM ${QUOTE_FROM}
      WHERE t.slug = $1 AND q.id = $2`,
    [VLM_SLUG, id]
  );
  if (!rows[0]) return null;
  const quote = mapQuote(rows[0]);
  const lineRows = await adminQuery<LineRow>(
    `SELECT ${LINE_COLS} FROM core.vlm_quote_lines l
      WHERE l.quote_id = $1
      ORDER BY l.sort_order, l.created_at`,
    [id]
  );
  quote.lines = lineRows.map(mapLine);
  return quote;
}

export async function getVlmQuoteRow(id: string): Promise<QuoteRow | null> {
  const rows = await adminQuery<QuoteRow>(
    `SELECT ${QUOTE_COLS}
       FROM ${QUOTE_FROM}
      WHERE t.slug = $1 AND q.id = $2`,
    [VLM_SLUG, id]
  );
  return rows[0] || null;
}

export async function getVlmQuoteLineRow(quoteId: string, lineId: string): Promise<LineRow | null> {
  const rows = await adminQuery<LineRow>(
    `SELECT ${LINE_COLS} FROM core.vlm_quote_lines l
      WHERE l.id = $1 AND l.quote_id = $2`,
    [lineId, quoteId]
  );
  return rows[0] || null;
}

export { QUOTE_COLS, LINE_COLS };
