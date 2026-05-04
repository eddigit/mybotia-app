import { cookies } from "next/headers";
import jwt, { type JwtPayload } from "jsonwebtoken";
import { getTenantConfig, getAllTenantConfigs, type TenantConfig } from "./dolibarr";

interface SessionInfo {
  userId: string;
  email: string;
  tenantId: string;
  tenantSlug: string;
  role: string;
  isSuperadmin: boolean;
  tenant: TenantConfig;
}

// SEC-1 (2026-05-04) : signature HS256 + issuer obligatoires.
// Aligné sur /opt/mybotia/auth-service/src/jwt.js (signAccessToken).
const JWT_ISSUER = "mybotia-auth";
const JWT_ALGS: jwt.Algorithm[] = ["HS256"];

type AccessClaims = JwtPayload & {
  email?: string;
  tenant_id?: string;
  tenant_slug?: string;
  role?: string;
  is_superadmin?: boolean;
};

/**
 * Extraire le tenant du JWT cookie. Retourne la config Dolibarr correspondante.
 * Si superadmin sans tenant spécifique → retourne MyBotIA par défaut.
 *
 * SEC-1 : la signature est vérifiée côté serveur avec JWT_SECRET partagé
 * avec auth-service. Tout token sans signature valide / issuer / exp → null.
 */
export async function getSession(): Promise<SessionInfo | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("mybotia_access")?.value;

  if (!token) return null;

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    console.error("[session] JWT_SECRET manquant — auth refusée par défaut");
    return null;
  }

  let payload: AccessClaims;
  try {
    payload = jwt.verify(token, secret, {
      algorithms: JWT_ALGS,
      issuer: JWT_ISSUER,
    }) as AccessClaims;
  } catch {
    return null;
  }

  if (!payload || typeof payload !== "object") return null;
  if (!payload.sub || !payload.tenant_slug) return null;

  const tenantSlug = payload.tenant_slug;
  const tenant = getTenantConfig(tenantSlug);

  return {
    userId: String(payload.sub),
    email: payload.email ?? "",
    tenantId: payload.tenant_id ?? "",
    tenantSlug,
    role: payload.role ?? "",
    isSuperadmin: payload.is_superadmin === true,
    tenant,
  };
}

/**
 * Pour un superadmin : retourne toutes les configs tenant.
 * Pour un user normal : retourne uniquement son tenant.
 */
export async function getSessionTenants(): Promise<TenantConfig[]> {
  const session = await getSession();
  if (!session) return [getTenantConfig()];
  if (session.isSuperadmin) return getAllTenantConfigs();
  return [session.tenant];
}
