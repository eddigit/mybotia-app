// Bloc 7B — types catalogue produits/services partagés API/UI.

export const CATALOG_ITEM_TYPES = [
  "product",
  "service",
  "subscription",
  "token_package",
  "setup",
  "maintenance",
  "custom",
] as const;

export const CATALOG_ITEM_UNITS = [
  "unit",
  "hour",
  "day",
  "month",
  "year",
  "package",
  "piece",
  "kg",
  "box",
  "container",
] as const;

export type CatalogItemType = (typeof CATALOG_ITEM_TYPES)[number];
export type CatalogItemUnit = (typeof CATALOG_ITEM_UNITS)[number];

export interface CatalogItem {
  id: string;
  tenantId: string;
  tenantSlug?: string;
  sku: string | null;
  name: string;
  description: string | null;
  category: string | null;
  type: CatalogItemType;
  unit: CatalogItemUnit;
  priceHt: number;
  vatRate: number;
  currency: string;
  active: boolean;
  visibleInQuotes: boolean;
  visibleToAi: boolean;
  requiresAdminValidation: boolean;
  dolibarrProductId: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export const TYPE_LABEL: Record<CatalogItemType, string> = {
  product: "Produit",
  service: "Service",
  subscription: "Abonnement",
  token_package: "Package tokens",
  setup: "Setup / mise en place",
  maintenance: "Maintenance",
  custom: "Custom",
};

export const UNIT_LABEL: Record<CatalogItemUnit, string> = {
  unit: "unité",
  hour: "heure",
  day: "jour",
  month: "mois",
  year: "année",
  package: "package",
  piece: "pièce",
  kg: "kg",
  box: "boîte",
  container: "container",
};
