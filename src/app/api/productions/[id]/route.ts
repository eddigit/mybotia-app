// V1.1.D Phase 2 — Production by id (app-side proxy).
//
// GET   /api/productions/[id]   → mybotia-business GET /api/v1/productions/[id]
// PATCH /api/productions/[id]   → mybotia-business PATCH /api/v1/productions/[id]
//
// Doctrine app.mybotia = parité CRM (doctrine_app_mybotia_parite_crm) : la
// fiche production est la SEULE entrée pour les collaborateurs (UI Dolibarr
// bypassée, pas d'accès direct au business côté collaborateur).

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

export type ProductionRow = {
  id: string;
  tenantId: string;
  clientId: string;
  name?: string;
  title?: string;
  description?: string | null;
  status: string;
  lifecycleStage?: string;
  dueDate?: string | null;
  priority?: string | null;
  projectType?: string | null;
  nextAction?: string | null;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
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
    const data = await businessGetJson<ProductionRow>(
      `/api/v1/productions/${encodeURIComponent(id)}`,
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

export async function PATCH(request: Request, { params }: Params) {
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
    const data = await businessSendJson<ProductionRow>(
      "PATCH",
      `/api/v1/productions/${encodeURIComponent(id)}`,
      body,
      {
        tenantId: provider.tenantId,
        tenantSlug: cockpit.slug,
        scopes: ["crm:write"] as const,
      },
    );
    return Response.json(data, { headers: NO_STORE });
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
    { error: e instanceof Error ? e.message : "Erreur production" },
    { status: 502, headers: NO_STORE },
  );
}
