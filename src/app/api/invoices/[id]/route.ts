// V1.1.F — Proxy /api/invoices/[id] → mybotia-business /api/v1/invoices/[id].
//
// GET    : fiche facture (avec items[]).
// PATCH  : mise à jour (mappé sur PUT côté biz — la route biz utilise PUT).
// DELETE : suppression.
//
// Doctrine : feature `finance` requise + provider `mybotia_business`.

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

const NO_STORE = {
  "Cache-Control": "no-store, no-cache, must-revalidate",
} as const;

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
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
    const data = await businessGetJson<unknown>(
      `/api/v1/invoices/${encodeURIComponent(id)}`,
      {
        tenantId: provider.tenantId,
        tenantSlug: cockpit.slug,
        scopes: ["crm:read"] as const,
      },
    );
    return Response.json(data, { headers: NO_STORE });
  } catch (e) {
    if (e instanceof CrmRouterError) return crmRouterErrorResponse(e);
    if (e instanceof BusinessClientError) {
      return Response.json(
        { error: e.code, message: e.message, details: e.details },
        { status: e.status, headers: NO_STORE },
      );
    }
    return Response.json(
      { error: e instanceof Error ? e.message : "Erreur invoice" },
      { status: 502, headers: NO_STORE },
    );
  }
}

export async function PATCH(request: Request, { params }: Params) {
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
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return Response.json(
        { error: "bad_body" },
        { status: 400, headers: NO_STORE },
      );
    }

    // Côté biz, l'update factures expose PUT (pas PATCH). Le client app
    // utilise PATCH pour rester cohérent avec /api/clients/[id], donc on
    // bridge vers PUT côté business.
    const updated = await businessSendJson<unknown>(
      "PUT",
      `/api/v1/invoices/${encodeURIComponent(id)}`,
      body,
      {
        tenantId: provider.tenantId,
        tenantSlug: cockpit.slug,
        scopes: ["crm:read", "crm:write"] as const,
      },
    );
    return Response.json(updated, { headers: NO_STORE });
  } catch (e) {
    if (e instanceof CrmRouterError) return crmRouterErrorResponse(e);
    if (e instanceof BusinessClientError) {
      return Response.json(
        { error: e.code, message: e.message, details: e.details },
        { status: e.status, headers: NO_STORE },
      );
    }
    return Response.json(
      { error: e instanceof Error ? e.message : "Erreur invoice" },
      { status: 502, headers: NO_STORE },
    );
  }
}

export async function DELETE(request: Request, { params }: Params) {
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
    const out = await businessSendJson<{ id: string; deleted: boolean }>(
      "DELETE",
      `/api/v1/invoices/${encodeURIComponent(id)}`,
      undefined,
      {
        tenantId: provider.tenantId,
        tenantSlug: cockpit.slug,
        scopes: ["crm:read", "crm:write"] as const,
      },
    );
    return Response.json(
      { ok: true, id: out.id, deleted: out.deleted },
      { headers: NO_STORE },
    );
  } catch (e) {
    if (e instanceof CrmRouterError) return crmRouterErrorResponse(e);
    if (e instanceof BusinessClientError) {
      return Response.json(
        { error: e.code, message: e.message, details: e.details },
        { status: e.status, headers: NO_STORE },
      );
    }
    return Response.json(
      { error: e instanceof Error ? e.message : "Erreur invoice" },
      { status: 502, headers: NO_STORE },
    );
  }
}
