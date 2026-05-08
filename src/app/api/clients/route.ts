// V1.1.B Phase 1 — /api/clients GET via crm-router.
// Le provider est résolu via `core.tenant_settings.architecture_config` :
//   mybotia → mybotia_business (HTTP signé Bearer service)
//   vlmedical / igh / cmb_lux → dolibarr (legacy, comportement V1.1.A)
//   esprit_loft → external (501 propre)

import { getThirdParties } from "@/lib/dolibarr";
import { mapThirdPartyToClient } from "@/lib/mappers";
import { resolveCockpitTenants } from "@/lib/tenant-resolver";
import { requireFeature } from "@/lib/tenant-features";
import {
  getCrmProvider,
  CrmRouterError,
  crmRouterErrorResponse,
} from "@/lib/crm-router";
import { businessGetJson, BusinessClientError } from "@/lib/business-client";
import {
  mapBusinessClientToCockpit,
  type BusinessClient,
} from "@/lib/business-mappers";
import type { Client } from "@/types";

const NO_STORE = { "Cache-Control": "no-store, no-cache, must-revalidate" } as const;

export async function GET(request: Request) {
  try {
    const featureCheck = await requireFeature(request, "crm");
    if (!featureCheck.ok) return featureCheck.response;

    const cockpit = await resolveCockpitTenants(request);
    if (!cockpit.ok) {
      return Response.json(
        { error: cockpit.error },
        { status: cockpit.status, headers: NO_STORE },
      );
    }
    const { tenant, slug: tenantSlug } = cockpit;

    const provider = await getCrmProvider(tenantSlug);

    if (provider.kind === "external") {
      return Response.json(
        { error: "crm_provider_not_configured", tenant: tenantSlug },
        { status: 501, headers: NO_STORE },
      );
    }

    let clients: Client[];

    if (provider.kind === "mybotia_business") {
      const list = await businessGetJson<BusinessClient[]>("/api/v1/clients", {
        tenantId: provider.tenantId,
        tenantSlug,
        scopes: ["crm:read"],
      });
      clients = list.map((c) => mapBusinessClientToCockpit(c, tenantSlug));
    } else {
      // dolibarr (legacy)
      const tps = await getThirdParties(100, tenant).catch(() => []);
      clients = tps
        .filter((tp) => tp.status !== "0" || !tp.name.includes("TEST"))
        .map((tp) => ({ ...mapThirdPartyToClient(tp), tenantSlug }));
    }

    return Response.json(clients, { headers: NO_STORE });
  } catch (e) {
    if (e instanceof CrmRouterError) return crmRouterErrorResponse(e);
    if (e instanceof BusinessClientError) {
      return Response.json(
        { error: e.code, message: e.message },
        { status: e.status, headers: NO_STORE },
      );
    }
    return Response.json(
      { error: e instanceof Error ? e.message : "Erreur CRM" },
      { status: 502, headers: NO_STORE },
    );
  }
}
