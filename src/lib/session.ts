import { cookies } from "next/headers";
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

/**
 * Extraire le tenant du JWT cookie. Retourne la config Dolibarr correspondante.
 * Si superadmin sans tenant spécifique → retourne MyBotIA par défaut.
 */
export async function getSession(): Promise<SessionInfo | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("mybotia_access")?.value;

  if (!token) return null;

  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const payload = JSON.parse(
      Buffer.from(parts[1], "base64url").toString("utf-8")
    );

    if (payload.exp && payload.exp * 1000 < Date.now()) return null;

    const tenantSlug = payload.tenant_slug || "mybotia";
    const tenant = getTenantConfig(tenantSlug);

    return {
      userId: payload.sub,
      email: payload.email,
      tenantId: payload.tenant_id,
      tenantSlug,
      role: payload.role,
      isSuperadmin: payload.is_superadmin === true,
      tenant,
    };
  } catch {
    return null;
  }
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
