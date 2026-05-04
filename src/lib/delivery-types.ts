// Bloc 7C — types deliveries (livraisons / expéditions génériques) partagés API/UI.

export const DELIVERY_STATUSES = [
  "pending",
  "preparing",
  "in_transit",
  "delivered",
  "cancelled",
] as const;
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];

export interface Delivery {
  id: string;
  tenantId: string;
  tenantSlug?: string;
  ref: string | null;
  clientName: string | null;
  title: string;
  shipFrom: string | null;
  shipTo: string | null;
  carrier: string | null;
  status: DeliveryStatus;
  expectedDate: string | null;
  deliveredAt: string | null;
  transportCost: number | null;
  currency: string;
  trackingNumber: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export const DELIVERY_STATUS_LABEL: Record<DeliveryStatus, string> = {
  pending: "à préparer",
  preparing: "en préparation",
  in_transit: "en transit",
  delivered: "livré",
  cancelled: "annulé",
};
