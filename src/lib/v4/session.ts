import { cookies } from "next/headers";
import jwt from "jsonwebtoken";
import {
  resolveCockpitTenant,
  KNOWN_TENANT_SLUGS,
} from "@/lib/tenant-resolver";
import {
  getDefaultAgent,
  isKnownTenant,
  UnknownTenantError,
} from "@/lib/v4/tenant-registry";

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

// V1.1.G — Conversations strictement tenant-scoped.
// Le filtre des routes /api/v4/conversations|folders|messages doit suivre
// le COCKPIT courant (cookie cockpit_tenant pour superadmin + hostname),
// pas le tenant_slug du JWT seul. Sans ça, Gilles (JWT=mybotia) qui bascule
// sur VLMedical voit toujours les conversations de Léa.
//
// Règle ACL :
//   - Superadmin : peut accéder au cockpit cible (cookie/hostname).
//   - User normal : son tenant JWT doit matcher le cockpit. Sinon 403.
//   - Le `user_email` reste filtré côté SQL pour préserver l'isolation
//     intra-tenant (chaque user voit ses propres conversations).
//
// Renvoie aussi l'`agentId` attendu pour le cockpit, utilisé pour scope
// les conversations à l'agent IA dédié au tenant (lea/max/lucy/...).

export type ChatCockpit =
  | {
      ok: true;
      session: SessionV4;
      tenantSlug: string;
      agentId: string;
      source: "cookie" | "hostname" | "fallback-dev" | "default";
    }
  | { ok: false; status: number; error: string };

export async function resolveChatCockpit(
  request: Request
): Promise<ChatCockpit> {
  const session = await getSessionV4();
  if (!session) return { ok: false, status: 401, error: "Non authentifié" };

  const cockpit = resolveCockpitTenant(request);

  // Sécurité : un cookie cockpit n'est honoré que pour superadmin.
  // Si non-superadmin avec cookie, on retombe sur le hostname.
  let effectiveSlug = cockpit.slug;
  let effectiveSource = cockpit.source;
  if (cockpit.source === "cookie" && !session.isSuperadmin) {
    console.warn(
      "[v4/session] cookie cockpit présent pour user non-superadmin",
      { user: session.userId, requested: cockpit.slug, tenant: session.tenantSlug }
    );
    // Fallback hostname-only : on ignore le cookie.
    const xfh = request.headers.get("x-forwarded-host");
    const host = (xfh || request.headers.get("host") || "").split(":")[0].toLowerCase();
    const HOSTNAME_TO_TENANT: Record<string, string> = {
      "app.mybotia.com": "mybotia",
      "vlmedical.mybotia.com": "vlmedical",
      "igh.mybotia.com": "igh",
      "cmb.mybotia.com": "cmb_lux",
    };
    effectiveSlug = HOSTNAME_TO_TENANT[host] ?? session.tenantSlug;
    effectiveSource = HOSTNAME_TO_TENANT[host] ? "hostname" : "default";
  }

  // Garde-fou : whitelist stricte (refus de tout slug arbitraire).
  if (!KNOWN_TENANT_SLUGS.has(effectiveSlug)) {
    return {
      ok: false,
      status: 400,
      error: `tenant cockpit inconnu: ${effectiveSlug}`,
    };
  }

  // ACL : user normal doit matcher.
  if (!session.isSuperadmin && effectiveSlug !== session.tenantSlug) {
    return {
      ok: false,
      status: 403,
      error: `Acces refuse : votre compte appartient au tenant '${session.tenantSlug}', le cockpit demande '${effectiveSlug}'.`,
    };
  }

  // Resolver l'agent par défaut du cockpit (lea/max/lucy/raphael/maria).
  // Fail-closed si tenant inconnu du registry V4.
  if (!isKnownTenant(effectiveSlug)) {
    return {
      ok: false,
      status: 400,
      error: `tenant cockpit non configuré V4: ${effectiveSlug}`,
    };
  }
  let agentId: string;
  try {
    agentId = getDefaultAgent(effectiveSlug);
  } catch (err) {
    if (err instanceof UnknownTenantError) {
      return {
        ok: false,
        status: 400,
        error: `tenant cockpit non configuré: ${err.tenantSlug}`,
      };
    }
    throw err;
  }

  return {
    ok: true,
    session,
    tenantSlug: effectiveSlug,
    agentId,
    source: effectiveSource,
  };
}
