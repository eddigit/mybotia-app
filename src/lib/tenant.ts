// Tenant resolution from JWT cookie — server-side only (API routes)

import { cookies } from "next/headers";

export interface TenantScope {
  slug: string;
  /** Dolibarr category ID to filter thirdparties. null = no category filter (superadmin) */
  categoryId: number | null;
  /** Specific thirdparty IDs (for single-client tenants like IGH, Esprit Loft, CMB Lux) */
  thirdpartyIds?: string[];
  /** If true, see all data across all tenants */
  isSuperadmin: boolean;
}

// Tenant → Dolibarr scope mapping
// Category 5 = Interne MaBoiteIA, Category 6 = VL Medical
const TENANT_SCOPES: Record<string, Omit<TenantScope, "slug" | "isSuperadmin">> = {
  mybotia: { categoryId: 5 },
  vlmedical: { categoryId: 6 },
  igh: { categoryId: null, thirdpartyIds: ["13"] },
  esprit_loft: { categoryId: null, thirdpartyIds: ["22"] },
  cmb_lux: { categoryId: null, thirdpartyIds: ["21"] },
};

/**
 * Extract tenant scope from the JWT cookie.
 * Returns the scope for data filtering in API routes.
 */
export async function getTenantScope(): Promise<TenantScope> {
  const cookieStore = await cookies();
  const token = cookieStore.get("mybotia_access")?.value;

  if (!token) {
    // No auth → default to mybotia scope (safe default)
    return { slug: "mybotia", categoryId: 5, isSuperadmin: false };
  }

  try {
    const parts = token.split(".");
    if (parts.length !== 3) {
      return { slug: "mybotia", categoryId: 5, isSuperadmin: false };
    }

    const payload = JSON.parse(
      Buffer.from(parts[1], "base64url").toString("utf-8")
    );

    const slug: string = payload.tenant_slug || "mybotia";
    const isSuperadmin: boolean = payload.is_superadmin === true;

    if (isSuperadmin) {
      return { slug, categoryId: null, isSuperadmin: true };
    }

    const scope = TENANT_SCOPES[slug];
    if (!scope) {
      // Unknown tenant → default to mybotia
      return { slug: "mybotia", categoryId: 5, isSuperadmin: false };
    }

    return { slug, ...scope, isSuperadmin: false };
  } catch {
    return { slug: "mybotia", categoryId: 5, isSuperadmin: false };
  }
}
