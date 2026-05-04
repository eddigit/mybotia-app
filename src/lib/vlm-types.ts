// Bloc 7D — types VL Medical custom vertical (import/export, containers, réglementation).
// Module facturable, non standard MyBotIA. Strict tenant=vlmedical côté API.

// ----- Stock extra (extension 1:1 de core.stock_items) -----

export interface VlmStockExtra {
  id: string;
  tenantId: string;
  tenantSlug?: string;
  stockItemId: string;
  lotNumber: string | null;
  expiryDate: string | null;
  medicalCategory: string | null;
  conditioning: string | null;
  sterile: boolean | null;
  ceMarking: string | null;
  supplierName: string | null;
  originCountry: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

// ----- Regulatory -----

export const VLM_DEVICE_CLASSES = ["I", "IIa", "IIb", "III", "other", "unknown"] as const;
export type VlmDeviceClass = (typeof VLM_DEVICE_CLASSES)[number];

export const VLM_REGULATORY_STATUSES = [
  "compliant",
  "pending",
  "expired",
  "to_configure",
  "not_applicable",
] as const;
export type VlmRegulatoryStatus = (typeof VLM_REGULATORY_STATUSES)[number];

export const VLM_REGULATORY_STATUS_LABEL: Record<VlmRegulatoryStatus, string> = {
  compliant: "conforme",
  pending: "en cours",
  expired: "expiré",
  to_configure: "à configurer",
  not_applicable: "non applicable",
};

export interface VlmRegulatory {
  id: string;
  tenantId: string;
  tenantSlug?: string;
  catalogItemId: string | null;
  stockItemId: string | null;
  ansmFileNumber: string | null;
  ceCertificateNumber: string | null;
  deviceClass: VlmDeviceClass | null;
  regulatoryStatus: VlmRegulatoryStatus;
  complianceNotes: string | null;
  documentUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

// ----- Container deals -----

export const VLM_DEAL_STATUSES = [
  "draft",
  "quoted",
  "ordered",
  "in_transit",
  "delivered",
  "billed",
  "cancelled",
] as const;
export type VlmDealStatus = (typeof VLM_DEAL_STATUSES)[number];

export const VLM_DEAL_STATUS_LABEL: Record<VlmDealStatus, string> = {
  draft: "brouillon",
  quoted: "devis",
  ordered: "commandé",
  in_transit: "en transit",
  delivered: "livré",
  billed: "facturé",
  cancelled: "annulé",
};

export interface VlmContainerDeal {
  id: string;
  tenantId: string;
  tenantSlug?: string;
  deliveryId: string | null;
  ref: string | null;
  title: string;
  supplierName: string | null;
  originCountry: string | null;
  destinationCountry: string | null;
  containerType: string | null;
  purchaseAmount: number | null;
  transportCost: number | null;
  customsCost: number | null;
  insuranceCost: number | null;
  conditioningCost: number | null;
  otherCost: number | null;
  saleAmount: number | null;
  currency: string;
  status: VlmDealStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

// ----- Margin computations (single source of truth) -----

export interface VlmDealMargin {
  totalCost: number;
  grossMargin: number | null;
  marginRate: number | null;
}

export function computeVlmDealMargin(d: VlmContainerDeal): VlmDealMargin {
  const totalCost =
    (d.purchaseAmount ?? 0) +
    (d.transportCost ?? 0) +
    (d.customsCost ?? 0) +
    (d.insuranceCost ?? 0) +
    (d.conditioningCost ?? 0) +
    (d.otherCost ?? 0);
  if (d.saleAmount === null) {
    return { totalCost, grossMargin: null, marginRate: null };
  }
  const grossMargin = d.saleAmount - totalCost;
  const marginRate = d.saleAmount > 0 ? grossMargin / d.saleAmount : null;
  return { totalCost, grossMargin, marginRate };
}
