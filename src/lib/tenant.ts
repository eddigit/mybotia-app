// Tenant resolution from JWT cookie — server-side only (API routes)
//
// SEC-1 (2026-05-04) : aligned with lib/session.ts — signature HS256 + issuer
// "mybotia-auth" obligatoires. Fail-closed : tout token absent / malformé /
// tenant_slug absent / slug inconnu → null (jamais de fallback silencieux vers
// mybotia). Les appelants doivent retourner 401 sur null.

import { cookies } from "next/headers";
import jwt, { type JwtPayload } from "jsonwebtoken";

export interface TenantScope {
  slug: string;
  /** Dolibarr category ID to filter thirdparties. null = no category filter (superadmin) */
  categoryId: number | null;
  /** Specific thirdparty IDs (for single-client tenants like IGH, Esprit Loft, CMB Lux) */
  thirdpartyIds?: string[];
  /** If true, see all data across all tenants */
  isSuperadmin: boolean;
}

// SEC-1 — mêmes constantes que lib/session.ts (alignement avec auth-service HS256).
const JWT_ISSUER = "mybotia-auth";
const JWT_ALGS: jwt.Algorithm[] = ["HS256"];

type AccessClaims = JwtPayload & {
  tenant_slug?: string;
  is_superadmin?: boolean;
};

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
 * Returns the scope for data filtering in API routes, or null on any auth failure.
 *
 * Fail-closed : token absent → null, signature invalide → null,
 * tenant_slug absent → null, slug inconnu → null, JWT_SECRET manquant → null.
 * Les appelants DOIVENT retourner 401 si null.
 */
export async function getTenantScope(): Promise<TenantScope | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("mybotia_access")?.value;

  // Fail-closed : token absent → null (401 attendu côté appelant).
  if (!token) return null;

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    console.error("[tenant] JWT_SECRET manquant — auth refusée par défaut");
    return null;
  }

  let payload: AccessClaims;
  try {
    payload = jwt.verify(token, secret, {
      algorithms: JWT_ALGS,
      issuer: JWT_ISSUER,
    }) as AccessClaims;
  } catch {
    // Token malformé, signature invalide, expiré, mauvais issuer → null.
    return null;
  }

  if (!payload || typeof payload !== "object") return null;

  // Fail-closed : tenant_slug absent dans le payload → null.
  const slug = payload.tenant_slug;
  if (!slug) return null;

  const isSuperadmin: boolean = payload.is_superadmin === true;

  if (isSuperadmin) {
    // Superadmin : pas de restriction de scope (categoryId null = tout voir).
    return { slug, categoryId: null, isSuperadmin: true };
  }

  // Fail-closed : slug inconnu dans la whitelist → null (pas de fallback mybotia).
  const scope = TENANT_SCOPES[slug];
  if (!scope) return null;

  return { slug, ...scope, isSuperadmin: false };
}
