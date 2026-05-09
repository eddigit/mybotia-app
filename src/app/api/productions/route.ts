// V1.1.D Phase 1 — Proxy /api/productions → mybotia-business /api/v1/productions.
//
// Doctrine "app.mybotia = parité CRM" : équivalent app du module Productions
// côté business. Lecture seule (création = bascule via POST /api/v1/affaires/[id]/sign).
//
// Feature gate côté app : `productions` (cf. tenant-admin-config.FEATURE_KEYS).
// Mappé sur le module business `productions` au niveau du tenant.

import { businessGetJson, BusinessClientError } from "@/lib/business-client";
import { getCrmProvider, CrmRouterError, crmRouterErrorResponse } from "@/lib/crm-router";
import { resolveCockpitTenants } from "@/lib/tenant-resolver";
import { requireFeature } from "@/lib/tenant-features";

const NO_STORE = { "Cache-Control": "no-store, no-cache, must-revalidate" } as const;

export type Production = {
  id: string;
  tenantId: string;
  clientId: string;
  title?: string;
  name?: string;
  status: string;
  lifecycleStage?: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
};

export async function GET(request: Request) {
  try {
    const featureCheck = await requireFeature(request, "productions");
    if (!featureCheck.ok) return featureCheck.response;

    const cockpit = await resolveCockpitTenants(request);
    if (!cockpit.ok) {
      return Response.json(
        { error: cockpit.error },
        { status: cockpit.status, headers: NO_STORE },
      );
    }
    const { slug: tenantSlug } = cockpit;
    const provider = await getCrmProvider(tenantSlug);

    if (provider.kind !== "mybotia_business") {
      return Response.json(
        {
          error: "crm_provider_not_business",
          tenant: tenantSlug,
          provider: provider.kind,
        },
        { status: 501, headers: NO_STORE },
      );
    }

    const url = new URL(request.url);
    const search = new URLSearchParams();
    for (const k of ["stage", "q", "limit", "offset", "owner_user_id"]) {
      const v = url.searchParams.get(k);
      if (v !== null && v !== "") search.set(k, v);
    }
    const qs = search.toString();
    const path = `/api/v1/productions${qs ? `?${qs}` : ""}`;

    const data = await businessGetJson<Production[]>(path, {
      tenantId: provider.tenantId,
      tenantSlug,
      scopes: ["crm:read"] as const,
    });
    return Response.json(data, { headers: NO_STORE });
  } catch (e) {
    if (e instanceof CrmRouterError) return crmRouterErrorResponse(e);
    if (e instanceof BusinessClientError) {
      return Response.json(
        { error: e.code, message: e.message },
        { status: e.status, headers: NO_STORE },
      );
    }
    return Response.json(
      { error: e instanceof Error ? e.message : "Erreur productions" },
      { status: 502, headers: NO_STORE },
    );
  }
}
