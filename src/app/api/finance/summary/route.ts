// V1.1.D Phase 1 — Proxy mince /api/finance/summary → mybotia-business
// /api/v1/finance/summary?year=YYYY.
//
// Endpoint distinct de /api/finance/kpis (Bloc 6C — KPI multi-sources Dolibarr
// + business_model). `summary` = ARR/MRR/oneshot calculés par business, sans
// retraitement côté app. Doctrine "JAMAIS de mock" : si tenant non câblé sur
// mybotia_business → 501 explicite.

import { businessGetJson, BusinessClientError } from "@/lib/business-client";
import { getCrmProvider, CrmRouterError, crmRouterErrorResponse } from "@/lib/crm-router";
import { resolveCockpitTenants } from "@/lib/tenant-resolver";
import { requireFeature } from "@/lib/tenant-features";

const NO_STORE = { "Cache-Control": "no-store, no-cache, must-revalidate" } as const;

export type FinanceSummary = {
  year: number;
  currency: string;
  mrr_active_ht: number;
  arr_active_ht: number;
  oneshot_ytd_ht: number;
  portfolio_total_ht: number;
  by_month: Array<{ month: number; mrr: number; oneshot: number }>;
};

export async function GET(request: Request) {
  try {
    const featureCheck = await requireFeature(request, "finance");
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
    const yearParam = url.searchParams.get("year");
    const path = yearParam
      ? `/api/v1/finance/summary?year=${encodeURIComponent(yearParam)}`
      : `/api/v1/finance/summary`;

    const data = await businessGetJson<FinanceSummary>(path, {
      tenantId: provider.tenantId,
      tenantSlug,
      scopes: ["crm:read", "finance:read"] as const,
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
      { error: e instanceof Error ? e.message : "Erreur finance summary" },
      { status: 502, headers: NO_STORE },
    );
  }
}
