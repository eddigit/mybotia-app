// Bloc 7C — types transport_legs (étapes de transport) partagés API/UI.

export const TRANSPORT_STATUSES = [
  "planned",
  "in_progress",
  "completed",
  "cancelled",
] as const;
export type TransportStatus = (typeof TRANSPORT_STATUSES)[number];

export const TRANSPORT_MODES = ["road", "sea", "air", "rail", "other"] as const;
export type TransportMode = (typeof TRANSPORT_MODES)[number];

export interface TransportLeg {
  id: string;
  tenantId: string;
  tenantSlug?: string;
  deliveryId: string | null;
  title: string;
  origin: string | null;
  destination: string | null;
  carrier: string | null;
  mode: TransportMode;
  status: TransportStatus;
  cost: number | null;
  currency: string;
  eta: string | null;
  completedAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export const TRANSPORT_MODE_LABEL: Record<TransportMode, string> = {
  road: "route",
  sea: "mer",
  air: "air",
  rail: "rail",
  other: "autre",
};

export const TRANSPORT_STATUS_LABEL: Record<TransportStatus, string> = {
  planned: "planifié",
  in_progress: "en cours",
  completed: "terminé",
  cancelled: "annulé",
};
