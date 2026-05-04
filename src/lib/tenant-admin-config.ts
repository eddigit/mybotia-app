// Bloc 6A — types partagés admin tenants.
// Pas de données hardcodées : la source de vérité est `mybotia_core` DB.

export const FEATURE_KEYS = [
  "crm",
  "pipeline",
  "tasks",
  "documents",
  "finance",
  "agenda",
  "voice",
  "whatsapp",
  "delivery",
  "transport",
  "stock",
  "penylane",
  "pipedrive",
  "advancedGed",
  "adminTools",
  "pdf",
  "memory",
] as const;

export type FeatureKey = (typeof FEATURE_KEYS)[number];

export type TenantFeatures = Partial<Record<FeatureKey, boolean>>;

export interface TenantBusinessModel {
  hasOneShot?: boolean;
  hasRecurring?: boolean;
  hasTokenBilling?: boolean;
  hasMaintenance?: boolean;
  setupDailyRate?: number;
  monthlyMaintenance?: number;
  tokenBillingMode?: "included" | "included_plus_overage" | "metered" | string;
  currency?: "EUR" | string;
  kpiStatus?: "configured" | "to_configure" | "unknown" | string;
  [key: string]: unknown;
}

// ============================================================================
// Bloc 7A — Architecture du tenant
// ============================================================================

export const INTERFACE_MODES = [
  "standard",
  "vertical",
  "external_mvp",
  "hybrid",
] as const;
export type InterfaceMode = (typeof INTERFACE_MODES)[number];

export const PRIMARY_APP_TYPES = [
  "mybotia_app",
  "external_url",
  "embedded",
] as const;
export type PrimaryAppType = (typeof PRIMARY_APP_TYPES)[number];

export const STANDARD_MODULE_KEYS = [
  "crm",
  "catalog",
  "stock",
  "delivery",
  "transport",
  "finance",
  "documents",
] as const;
export type StandardModuleKey = (typeof STANDARD_MODULE_KEYS)[number];

export const VERTICAL_MODULE_KEYS = [
  "importExport",
  "medicalDistribution",
  "healthcareEstablishments",
  "legalCabinet",
  "realEstate",
] as const;
export type VerticalModuleKey = (typeof VERTICAL_MODULE_KEYS)[number];

export interface TenantArchitectureConfig {
  interfaceMode: InterfaceMode;
  primaryApp: {
    type: PrimaryAppType;
    label: string;
    url: string | null;
  };
  standardModules: Partial<Record<StandardModuleKey, boolean>>;
  verticalModules: Partial<Record<VerticalModuleKey, boolean>>;
  customModules: {
    enabled: boolean;
    key: string | null;
    label: string | null;
    billable: boolean;
    notes: string | null;
  };
}

export const INTERFACE_MODE_LABEL: Record<InterfaceMode, string> = {
  standard: "Cockpit standard",
  vertical: "Cockpit vertical métier",
  external_mvp: "MVP externe",
  hybrid: "Hybride",
};

export const PRIMARY_APP_TYPE_LABEL: Record<PrimaryAppType, string> = {
  mybotia_app: "mybotia-app",
  external_url: "URL externe",
  embedded: "Application embarquée",
};

export const STANDARD_MODULE_LABEL: Record<StandardModuleKey, string> = {
  crm: "CRM",
  catalog: "Catalogue produits/services",
  stock: "Stock",
  delivery: "Livraisons",
  transport: "Transport",
  finance: "Finance",
  documents: "Documents",
};

export const VERTICAL_MODULE_LABEL: Record<VerticalModuleKey, string> = {
  importExport: "Import-export / containers",
  medicalDistribution: "Distribution médicale",
  healthcareEstablishments: "Gestion établissements de santé",
  legalCabinet: "Cabinet juridique",
  realEstate: "Immobilier",
};

export interface AdminTenantRow {
  id: string;
  slug: string;
  displayName: string;
  profile: string;
  status: string;
  legalName: string | null;
  features: TenantFeatures;
  businessModel: TenantBusinessModel | null;
  architectureConfig: TenantArchitectureConfig | null;
  quotaUsers: number | null;
  quotaStorageMb: number | null;
  quotaLlmTokensDaily: number | null;
  locale: string | null;
  timezone: string | null;
  updatedAt: string | null;
  userCount: number;
}
