// V1.1.F — Proxy POST /api/invoices/from-quote/[id]
//          → mybotia-business POST /api/v1/invoices/from-quote/[id]
//
// Convertit un devis en facture (snapshot des items, lien quote_id).
// Retourne la facture nouvellement créée (avec items).
//
// Doctrine : feature `finance` requise + provider `mybotia_business`.

import {
  businessSendJson,
  BusinessClientError,
} from "@/lib/business-client";
import {
  getCrmProvider,
  CrmRouterError,
  crmRouterErrorResponse,
} from "@/lib/crm-router";
import { resolveCockpitTenants } from "@/lib/tenant-resolver";
import { requireFeature } from "@/lib/tenant-features";

const NO_STORE = {
  "Cache-Control": "no-store, no-cache, must-revalidate",
} as const;

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
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

    const { id } = await params;
    const created = await businessSendJson<unknown>(
      "POST",
      `/api/v1/invoices/from-quote/${encodeURIComponent(id)}`,
      {},
      {
        tenantId: provider.tenantId,
        tenantSlug: cockpit.slug,
        scopes: ["crm:read", "crm:write"] as const,
      },
    );
    return Response.json(created, { status: 201, headers: NO_STORE });
  } catch (e) {
    if (e instanceof CrmRouterError) return crmRouterErrorResponse(e);
    if (e instanceof BusinessClientError) {
      return Response.json(
        { error: e.code, message: e.message, details: e.details },
        { status: e.status, headers: NO_STORE },
      );
    }
    return Response.json(
      { error: e instanceof Error ? e.message : "Erreur from-quote" },
      { status: 502, headers: NO_STORE },
    );
  }
}
