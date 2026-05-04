// Bloc 6D — types abonnements partagés API/UI/finance.

export const SUBSCRIPTION_CATEGORIES = [
  "ai_collaborator",
  "maintenance",
  "hosting",
  "support",
  "crm",
  "whatsapp",
  "voice",
  "tokens_package",
  "other",
] as const;

export const SUBSCRIPTION_STATUSES = [
  "active",
  "paused",
  "setup",
  "cancelled",
  "to_configure",
] as const;

export const BILLING_PERIODS = ["monthly", "quarterly", "yearly"] as const;

// Bloc 6E — modes de facturation tokens.
export const TOKEN_BILLING_MODES = [
  "included",
  "included_plus_overage",
  "pay_as_you_go",
  "manual",
] as const;

export type SubscriptionCategory = (typeof SUBSCRIPTION_CATEGORIES)[number];
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];
export type BillingPeriod = (typeof BILLING_PERIODS)[number];
export type TokenBillingMode = (typeof TOKEN_BILLING_MODES)[number];

export interface Subscription {
  id: string;
  tenantId: string;
  tenantSlug?: string;
  clientName: string;
  clientRef: string | null;
  label: string;
  category: SubscriptionCategory;
  status: SubscriptionStatus;
  monthlyAmount: number;
  currency: string;
  startDate: string | null;
  endDate: string | null;
  billingPeriod: BillingPeriod;
  notes: string | null;
  // Bloc 6E — package tokens (optionnels, surtout pour category=tokens_package)
  includedMonthlyTokens: number | null;
  overagePricePer1000Tokens: number | null;
  tokenBillingMode: TokenBillingMode | null;
  createdAt: string;
  updatedAt: string;
}

// Catégorie → libellé humain (UI).
export const CATEGORY_LABEL: Record<SubscriptionCategory, string> = {
  ai_collaborator: "Collaborateur IA",
  maintenance: "Maintenance",
  hosting: "Hébergement",
  support: "Support",
  crm: "CRM",
  whatsapp: "WhatsApp",
  voice: "Voice",
  tokens_package: "Package tokens",
  other: "Autre",
};

export const STATUS_LABEL: Record<SubscriptionStatus, string> = {
  active: "Actif",
  paused: "En pause",
  setup: "Setup",
  cancelled: "Annulé",
  to_configure: "À configurer",
};

export const TOKEN_BILLING_MODE_LABEL: Record<TokenBillingMode, string> = {
  included: "Inclus uniquement",
  included_plus_overage: "Inclus + dépassement",
  pay_as_you_go: "Pay-as-you-go",
  manual: "Manuel",
};
