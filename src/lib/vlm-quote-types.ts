// Bloc 7H — types Devis VL Medical (vlm_quotes / vlm_quote_lines).

export const VLM_QUOTE_STATUSES = [
  "draft",
  "sent",
  "accepted",
  "refused",
  "cancelled",
] as const;
export type VlmQuoteStatus = (typeof VLM_QUOTE_STATUSES)[number];

export const VLM_QUOTE_STATUS_LABEL: Record<VlmQuoteStatus, string> = {
  draft: "brouillon",
  sent: "envoyé",
  accepted: "accepté",
  refused: "refusé",
  cancelled: "annulé",
};

export interface VlmQuoteLine {
  id: string;
  tenantId: string;
  quoteId: string;
  catalogItemId: string | null;
  label: string;
  description: string | null;
  quantity: number;
  unit: string | null;
  unitPriceHt: number;
  vatRate: number;
  lineTotalHt: number;
  lineTotalVat: number;
  lineTotalTtc: number;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface VlmQuote {
  id: string;
  tenantId: string;
  tenantSlug?: string;
  dealId: string | null;
  ref: string;
  clientName: string;
  clientEmail: string | null;
  clientAddress: string | null;
  title: string;
  status: VlmQuoteStatus;
  currency: string;
  validUntil: string | null;
  notes: string | null;
  terms: string | null;
  totalHt: number;
  totalVat: number;
  totalTtc: number;
  createdAt: string;
  updatedAt: string;
  lines?: VlmQuoteLine[];
}
