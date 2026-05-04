// Bloc 6B — endpoint léger : features + métadonnées du cockpit courant.
// Bloc 6B-final — étendu avec businessModel, displayName, status, profile
// (lecture seule, source DB `core.tenant` + `core.tenant_settings`).
//
// Auth required (pas réservé superadmin). Aucun secret exposé.

import { getSession } from "@/lib/session";
import { getCockpitFeatures } from "@/lib/tenant-features";
import { adminQuery } from "@/lib/admin-db";
import type { TenantBusinessModel } from "@/lib/tenant-admin-config";

const NO_STORE = { "Cache-Control": "no-store, no-cache, must-revalidate" } as const;

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Non authentifie" }, { status: 401, headers: NO_STORE });
  }
  const { slug, features } = await getCockpitFeatures(request);

  // Bloc 6B-final — métadonnées tenant en lecture seule. Volontairement
  // limitées : displayName + status + profile + businessModel. Pas de
  // legal_name/siret/bank info ici (sensibles, restent /admin/tenants only).
  let displayName: string | null = null;
  let status: string | null = null;
  let profile: string | null = null;
  let businessModel: TenantBusinessModel | null = null;
  try {
    const rows = await adminQuery<{
      display_name: string;
      status: string;
      profile: string;
      business_model: TenantBusinessModel | null;
    }>(
      `SELECT t.display_name, t.status, t.profile, s.business_model
       FROM core.tenant t
       LEFT JOIN core.tenant_settings s ON s.tenant_id = t.id
       WHERE t.slug = $1`,
      [slug]
    );
    if (rows[0]) {
      displayName = rows[0].display_name;
      status = rows[0].status;
      profile = rows[0].profile;
      businessModel = rows[0].business_model;
    }
  } catch {
    // fallback safe : on retourne les features sans les méta
  }

  return Response.json(
    {
      tenant: slug,
      displayName,
      status,
      profile,
      features,
      businessModel,
      isSuperadmin: session.isSuperadmin,
    },
    { headers: NO_STORE }
  );
}
