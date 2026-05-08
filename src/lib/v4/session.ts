import { cookies } from "next/headers";
import jwt from "jsonwebtoken";

const JWT_ISSUER = "mybotia-auth";

export interface SessionV4 {
  userId: string;
  email: string;
  tenantSlug: string;
  role: string;
  isSuperadmin: boolean;
}

interface AccessClaims {
  sub?: string | number;
  email?: string;
  tenant_id?: string;
  tenant_slug?: string;
  role?: string;
  is_superadmin?: boolean;
}

export async function getSessionV4(): Promise<SessionV4 | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("mybotia_access")?.value;
  if (!token) return null;

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    console.error("[v4/session] JWT_SECRET manquant");
    return null;
  }

  let payload: AccessClaims;
  try {
    payload = jwt.verify(token, secret, {
      algorithms: ["HS256"],
      issuer: JWT_ISSUER,
    }) as AccessClaims;
  } catch {
    return null;
  }

  if (!payload || typeof payload !== "object") return null;
  if (!payload.sub || !payload.tenant_slug) return null;

  return {
    userId: String(payload.sub),
    email: payload.email ?? "",
    tenantSlug: payload.tenant_slug,
    role: payload.role ?? "",
    isSuperadmin: payload.is_superadmin === true,
  };
}
