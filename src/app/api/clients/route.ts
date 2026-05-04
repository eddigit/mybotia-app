// Bloc 5G — /api/clients verrouillé sur le cockpit hostname.
// Pas d'agrégation multi-tenant ici.

import { getThirdParties } from "@/lib/dolibarr";
import { mapThirdPartyToClient } from "@/lib/mappers";
import { resolveCockpitTenants } from "@/lib/tenant-resolver";
import { requireFeature } from "@/lib/tenant-features";

const NO_STORE = { "Cache-Control": "no-store, no-cache, must-revalidate" } as const;

export async function GET(request: Request) {
  try {
    // Bloc 6B — feature gate
    const featureCheck = await requireFeature(request, "crm");
    if (!featureCheck.ok) return featureCheck.response;

    const cockpit = await resolveCockpitTenants(request);
    if (!cockpit.ok) {
      return Response.json({ error: cockpit.error }, { status: cockpit.status, headers: NO_STORE });
    }
    const { tenant, slug: tenantSlug } = cockpit;

    const tps = await getThirdParties(100, tenant).catch(() => []);
    const clients = tps
      .filter((tp) => tp.status !== "0" || !tp.name.includes("TEST"))
      .map((tp) => ({ ...mapThirdPartyToClient(tp), tenantSlug }));

    return Response.json(clients, { headers: NO_STORE });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Erreur Dolibarr" },
      { status: 502, headers: NO_STORE }
    );
  }
}
