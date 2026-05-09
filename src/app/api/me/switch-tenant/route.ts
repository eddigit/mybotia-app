// Bloc 7F — endpoint POST /api/me/switch-tenant
// Pose le cookie httpOnly `cockpit_tenant=<slug>` pour un superadmin.
// Ce cookie est lu en priorité par `tenant-resolver.ts`.
//
// Sécurité :
//   - Reservé aux superadmins (sinon 403, pas de cookie posé, log warning).
//   - Slug validé contre la whitelist `KNOWN_TENANT_SLUGS`.
//   - Cookie httpOnly + secure + sameSite=lax. Path=/. TTL=24h.
//   - Le cookie est aussi vérifié à la lecture par `resolveCockpitTenants`
//     (défense en profondeur : si la session n'est plus superadmin, le cookie
//     est ignoré).

import { cookies } from "next/headers";
import { getSession } from "@/lib/session";
import { adminQuery } from "@/lib/admin-db";
import { COCKPIT_COOKIE_NAME, KNOWN_TENANT_SLUGS } from "@/lib/tenant-resolver";

const NO_STORE = { "Cache-Control": "no-store, no-cache, must-revalidate" } as const;
const COOKIE_MAX_AGE_SEC = 60 * 60 * 24; // 1 jour

interface SwitchBody {
  slug?: unknown;
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Non authentifie" }, { status: 401, headers: NO_STORE });
  }

  let body: SwitchBody;
  try {
    body = (await request.json()) as SwitchBody;
  } catch {
    return Response.json({ error: "Body JSON invalide" }, { status: 400, headers: NO_STORE });
  }

  const slug = typeof body.slug === "string" ? body.slug.trim() : "";
  if (!slug) {
    return Response.json({ error: "slug requis" }, { status: 400, headers: NO_STORE });
  }
  if (!KNOWN_TENANT_SLUGS.has(slug)) {
    return Response.json(
      { error: `Slug inconnu: ${slug}` },
      { status: 400, headers: NO_STORE }
    );
  }

  if (!session.isSuperadmin) {
    console.warn(
      "[switch-tenant] tentative de bascule par un non-superadmin",
      { user: session.userId, requested: slug, tenant: session.tenantSlug }
    );
    return Response.json(
      { error: "Bascule de cockpit reservee aux superadmins" },
      { status: 403, headers: NO_STORE }
    );
  }

  // Vérifier que le tenant existe et est actif (pas de bascule sur un tenant
  // inactif/archivé).
  try {
    const rows = await adminQuery<{ slug: string; status: string }>(
      `SELECT slug, status FROM core.tenant WHERE slug = $1`,
      [slug]
    );
    if (!rows[0]) {
      return Response.json({ error: "Tenant introuvable en base" }, { status: 404, headers: NO_STORE });
    }
    if (rows[0].status !== "active") {
      return Response.json(
        { error: `Tenant '${slug}' inactif (status=${rows[0].status})` },
        { status: 409, headers: NO_STORE }
      );
    }
  } catch (e) {
    console.error("[switch-tenant] db error", e instanceof Error ? e.message : e);
    return Response.json(
      { error: "Verification tenant impossible" },
      { status: 503, headers: NO_STORE }
    );
  }

  // Pose le cookie httpOnly. Secure en prod (HTTPS app.mybotia.com).
  const cookieStore = await cookies();
  cookieStore.set(COCKPIT_COOKIE_NAME, slug, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE_SEC,
  });

  return Response.json(
    { ok: true, slug },
    { headers: NO_STORE }
  );
}

/**
 * DELETE — efface le cookie cockpit (retour au cockpit hostname natif).
 * Utile si on veut un bouton "revenir au cockpit par défaut".
 */
export async function DELETE() {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Non authentifie" }, { status: 401, headers: NO_STORE });
  }
  const cookieStore = await cookies();
  cookieStore.set(COCKPIT_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return Response.json({ ok: true }, { headers: NO_STORE });
}
