// V1.1.D Phase 1 — Proxy /api/affaires → mybotia-business /api/v1/affaires.
//
// Doctrine "app.mybotia = parité CRM" : toute fonction biz exposée côté
// cockpit. Cette route est l'équivalent app du module Affaires côté business.
//
// - Tenant résolu par hostname (resolveCockpitTenants).
// - Provider business obligatoire : si tenant cockpit n'est pas câblé sur
//   mybotia_business, 501 explicite (jamais de fallback Dolibarr ici, les
//   affaires sont une notion business V1.1.D).
// - Doctrine "JAMAIS de mock" : si business renvoie 401/403/feature_disabled,
//   on propage le code/erreur — l'UI affichera un empty state actionnable.

import {
  businessGetJson,
  businessSendJson,
  BusinessClientError,
} from "@/lib/business-client";
import { getCrmProvider, CrmRouterError, crmRouterErrorResponse } from "@/lib/crm-router";
import { resolveCockpitTenants } from "@/lib/tenant-resolver";
import { requireFeature } from "@/lib/tenant-features";

const NO_STORE = { "Cache-Control": "no-store, no-cache, must-revalidate" } as const;

export type Affaire = {
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
    const featureCheck = await requireFeature(request, "pipeline");
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

    // Forward query params utiles (stage, q, limit, offset)
    const url = new URL(request.url);
    const search = new URLSearchParams();
    for (const k of ["stage", "q", "limit", "offset", "owner_user_id"]) {
      const v = url.searchParams.get(k);
      if (v !== null && v !== "") search.set(k, v);
    }
    const qs = search.toString();
    const path = `/api/v1/affaires${qs ? `?${qs}` : ""}`;

    const data = await businessGetJson<Affaire[]>(path, {
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
      { error: e instanceof Error ? e.message : "Erreur affaires" },
      { status: 502, headers: NO_STORE },
    );
  }
}

export async function POST(request: Request) {
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

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json(
        { error: "body_json_invalid" },
        { status: 400, headers: NO_STORE },
      );
    }

    const created = await businessSendJson<Affaire>(
      "POST",
      "/api/v1/affaires",
      body,
      {
        tenantId: provider.tenantId,
        tenantSlug,
        scopes: ["crm:read", "crm:write"] as const,
      },
    );
    return Response.json(created, { status: 201, headers: NO_STORE });
  } catch (e) {
    if (e instanceof CrmRouterError) return crmRouterErrorResponse(e);
    if (e instanceof BusinessClientError) {
      return Response.json(
        { error: e.code, message: e.message },
        { status: e.status, headers: NO_STORE },
      );
    }
    return Response.json(
      { error: e instanceof Error ? e.message : "Erreur creation affaire" },
      { status: 502, headers: NO_STORE },
    );
  }
}
