// V1.1.D Phase 2 — Subscriptions liées à une production (app-side proxy).
//
// GET  /api/productions/[id]/subscriptions  → biz /api/v1/productions/[id]/subscriptions
// POST /api/productions/[id]/subscriptions  → biz /api/v1/productions/[id]/subscriptions
//
// Body POST : { label, mrrHt, billingCycle, startedAt?, endDate? }.
// Source unique core.subscriptions (doctrine_v3_usage_billing).

import {
  businessGetJson,
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

export type SubscriptionRow = {
  id: string;
  tenant_id: string;
  client_id: string | null;
  production_id: string | null;
  client_name: string | null;
  status: string;
  monthly_amount: string;
  currency: string;
  billing_period: string;
  start_date: string | null;
  end_date: string | null;
  is_recurring: boolean;
  label: string | null;
};

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
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

    const provider = await getCrmProvider(cockpit.slug);
    if (provider.kind !== "mybotia_business") {
      return Response.json(
        { error: "crm_provider_not_business", tenant: cockpit.slug, provider: provider.kind },
        { status: 501, headers: NO_STORE },
      );
    }

    const { id } = await params;
    const data = await businessGetJson<SubscriptionRow[]>(
      `/api/v1/productions/${encodeURIComponent(id)}/subscriptions`,
      {
        tenantId: provider.tenantId,
        tenantSlug: cockpit.slug,
        scopes: ["crm:read"] as const,
      },
    );
    return Response.json(data, { headers: NO_STORE });
  } catch (e) {
    return mapErrorToResponse(e);
  }
}

export async function POST(request: Request, { params }: Params) {
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

    const provider = await getCrmProvider(cockpit.slug);
    if (provider.kind !== "mybotia_business") {
      return Response.json(
        { error: "crm_provider_not_business", tenant: cockpit.slug, provider: provider.kind },
        { status: 501, headers: NO_STORE },
      );
    }

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const data = await businessSendJson<SubscriptionRow>(
      "POST",
      `/api/v1/productions/${encodeURIComponent(id)}/subscriptions`,
      body,
      {
        tenantId: provider.tenantId,
        tenantSlug: cockpit.slug,
        scopes: ["crm:write"] as const,
      },
    );
    return Response.json(data, { status: 201, headers: NO_STORE });
  } catch (e) {
    return mapErrorToResponse(e);
  }
}

function mapErrorToResponse(e: unknown): Response {
  if (e instanceof CrmRouterError) return crmRouterErrorResponse(e);
  if (e instanceof BusinessClientError) {
    return Response.json(
      { error: e.code, message: e.message },
      { status: e.status, headers: NO_STORE },
    );
  }
  return Response.json(
    { error: e instanceof Error ? e.message : "Erreur subscription" },
    { status: 502, headers: NO_STORE },
  );
}
