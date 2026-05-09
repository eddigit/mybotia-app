// V1.1.D Phase 2 — Proxy /api/affaires/[id]/sign → business /api/v1/affaires/[id]/sign.
//
// Bascule lifecycle_stage 'affaire' -> 'production'. Idempotent : si déjà
// production, business renvoie 409 already_signed et le proxy le propage.
//
// Body camelCase attendu (cf. business sign route) :
//   {
//     acceptedQuoteId: uuid,
//     billingMode: "one_shot" | "recurring" | "mixed",
//     oneshotAmountHt?: string,
//     mrrHt?: string,
//     recurringSubscriptions?: Array<{
//       label: string,
//       mrrHt: string,
//       billingCycle: "monthly" | "quarterly" | "yearly",
//       startedAt?: string,
//     }>,
//   }

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

const NO_STORE = { "Cache-Control": "no-store, no-cache, must-revalidate" } as const;

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
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

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json(
        { error: "body_json_invalid" },
        { status: 400, headers: NO_STORE },
      );
    }

    const result = await businessSendJson<unknown>(
      "POST",
      `/api/v1/affaires/${encodeURIComponent(id)}/sign`,
      body,
      {
        tenantId: provider.tenantId,
        tenantSlug: cockpit.slug,
        scopes: ["crm:read", "crm:write"] as const,
      },
    );
    return Response.json(result, { status: 201, headers: NO_STORE });
  } catch (e) {
    if (e instanceof CrmRouterError) return crmRouterErrorResponse(e);
    if (e instanceof BusinessClientError) {
      return Response.json(
        { error: e.code, message: e.message },
        { status: e.status, headers: NO_STORE },
      );
    }
    return Response.json(
      { error: e instanceof Error ? e.message : "Erreur signature" },
      { status: 502, headers: NO_STORE },
    );
  }
}
