// V1.1.D Phase 2 — Proxy /api/quotes → mybotia-business /api/v1/quotes.
//
// Lecture seule pour le moment. Filtres acceptés : client_id, status.
// Le filtrage par projet/affaire (deal_id / projectId) est appliqué côté
// client : business ne l'expose pas encore en query, mais le champ est dans
// la row retournée. Documenté pour migration future.

import {
  businessGetJson,
  BusinessClientError,
} from "@/lib/business-client";
import {
  getCrmProvider,
  CrmRouterError,
  crmRouterErrorResponse,
} from "@/lib/crm-router";
import { resolveCockpitTenants } from "@/lib/tenant-resolver";
import { requireFeature } from "@/lib/tenant-features";

const NO_STORE = { "Cache-Control": "no-store, no-cache, must-revalidate" } as const;

export async function GET(request: Request) {
  try {
    const featureCheck = await requireFeature(request, "pipeline");
    if (!featureCheck.ok) return featureCheck.response;

    const cockpit = await resolveCockpitTenants(request);
    if (!cockpit.ok) {
      return Response.json(
        { error: cockpit.error },
        { status: cockpit.status, headers: NO_STORE },
      );
    }
    const provider = await getCrmProvider(cockpit.slug);
    if (provider.kind !== "mybotia_business") {
      return Response.json(
        {
          error: "crm_provider_not_business",
          tenant: cockpit.slug,
          provider: provider.kind,
        },
        { status: 501, headers: NO_STORE },
      );
    }

    const url = new URL(request.url);
    const search = new URLSearchParams();
    for (const k of ["client_id", "status"]) {
      const v = url.searchParams.get(k);
      if (v !== null && v !== "") search.set(k, v);
    }
    const qs = search.toString();
    const path = `/api/v1/quotes${qs ? `?${qs}` : ""}`;

    const data = await businessGetJson<unknown[]>(path, {
      tenantId: provider.tenantId,
      tenantSlug: cockpit.slug,
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
      { error: e instanceof Error ? e.message : "Erreur quotes" },
      { status: 502, headers: NO_STORE },
    );
  }
}
