// Bloc 7C — types stock items partagés API/UI.

export const STOCK_STATUSES = ["active", "inactive", "archived"] as const;
export type StockStatus = (typeof STOCK_STATUSES)[number];

export interface StockItem {
  id: string;
  tenantId: string;
  tenantSlug?: string;
  catalogItemId: string | null;
  label: string;
  sku: string | null;
  warehouse: string | null;
  location: string | null;
  quantity: number;
  minQuantity: number;
  unit: string | null;
  status: StockStatus;
  lastInventoryAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export const STOCK_STATUS_LABEL: Record<StockStatus, string> = {
  active: "actif",
  inactive: "inactif",
  archived: "archivé",
};
