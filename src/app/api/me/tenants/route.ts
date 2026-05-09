// Bloc 7F — endpoint GET /api/me/tenants
// Liste les tenants accessibles à l'utilisateur courant pour alimenter le
// switcher de cockpit dans la sidebar.
//
// Doctrine multi-tenant (`feedback_no_delete_igh_lucy`, `feedback_sidebar_cockpit_boundary`) :
//   - User normal     → 1 seul tenant (le sien). Le switcher s'affiche sans choix.
//   - Superadmin      → tous les tenants `core.tenant` actifs.
//   - Pas de fallback mock : si DB unreachable, on renvoie le tenant courant
//     uniquement (le front affichera le switcher en mode lecture seule).
//
// Source : core.tenant + core.tenant_branding (primary_color uniquement).
// Aucune donnée sensible exposée.

import { getSession } from "@/lib/session";
import { adminQuery } from "@/lib/admin-db";
import { resolveCockpitTenant, resolveHostnameOnly } from "@/lib/tenant-resolver";

const NO_STORE = { "Cache-Control": "no-store, no-cache, must-revalidate" } as const;

export interface MeTenantEntry {
  slug: string;
  displayName: string;
  profile: string;
  status: string;
  primaryColor: string | null;
  role: string | null;
  isCurrent: boolean;
}

export interface MeTenantsPayload {
  tenants: MeTenantEntry[];
  current: string;
  isSuperadmin: boolean;
  canSwitch: boolean;
}

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Non authentifie" }, { status: 401, headers: NO_STORE });
  }

  // Cockpit courant : pour un superadmin, on respecte le cookie si présent ;
  // sinon hostname. Pour un user normal, on force le hostname (le cookie ne
  // doit jamais lui faire dériver son cockpit).
  const cockpit = session.isSuperadmin
    ? resolveCockpitTenant(request)
    : resolveHostnameOnly(request);

  try {
    let rows: Array<{
      slug: string;
      display_name: string;
      profile: string;
      status: string;
      primary_color: string | null;
      role: string | null;
    }>;

    if (session.isSuperadmin) {
      // Superadmin : tous les tenants actifs.
      rows = await adminQuery(
        `SELECT t.slug, t.display_name, t.profile, t.status,
                b.primary_color,
                tu.role::text AS role
           FROM core.tenant t
           LEFT JOIN core.tenant_branding b ON b.tenant_id = t.id
           LEFT JOIN core.tenant_user tu
             ON tu.tenant_id = t.id AND tu.user_id = $1::uuid
          WHERE t.status = 'active'
          ORDER BY t.slug`,
        [session.userId]
      );
    } else {
      // User normal : strictement les tenants où il a une ligne tenant_user.
      rows = await adminQuery(
        `SELECT t.slug, t.display_name, t.profile, t.status,
                b.primary_color,
                tu.role::text AS role
           FROM core.tenant_user tu
           JOIN core.tenant t ON t.id = tu.tenant_id
           LEFT JOIN core.tenant_branding b ON b.tenant_id = t.id
          WHERE tu.user_id = $1::uuid AND t.status = 'active'
          ORDER BY t.slug`,
        [session.userId]
      );
    }

    const tenants: MeTenantEntry[] = rows.map((r) => ({
      slug: r.slug,
      displayName: r.display_name,
      profile: r.profile,
      status: r.status,
      primaryColor: r.primary_color,
      role: r.role,
      isCurrent: r.slug === cockpit.slug,
    }));

    // Si la liste ne contient pas le cockpit courant (cas rare : superadmin
    // sans ligne tenant_user mais cockpit valide), on injecte une entrée
    // minimale pour ne pas casser l'affichage.
    if (!tenants.some((t) => t.slug === cockpit.slug)) {
      tenants.unshift({
        slug: cockpit.slug,
        displayName: cockpit.slug,
        profile: "classic",
        status: "active",
        primaryColor: null,
        role: session.isSuperadmin ? "superadmin" : null,
        isCurrent: true,
      });
    }

    const payload: MeTenantsPayload = {
      tenants,
      current: cockpit.slug,
      isSuperadmin: session.isSuperadmin,
      canSwitch: session.isSuperadmin && tenants.length > 1,
    };

    return Response.json(payload, { headers: NO_STORE });
  } catch (e) {
    console.error("[api/me/tenants] db error", e instanceof Error ? e.message : e);
    // Pas de mock : en cas d'erreur DB on renvoie 503 avec contexte minimal.
    // Le front désactive alors le switcher avec tooltip explicite.
    return Response.json(
      {
        error: "tenant_lookup_failed",
        message: "Liste des tenants indisponible. Le switcher est temporairement désactivé.",
      },
      { status: 503, headers: NO_STORE }
    );
  }
}
