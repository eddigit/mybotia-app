// V1.1.B Phase 1 — /api/clients GET via crm-router.
// Le provider est résolu via `core.tenant_settings.architecture_config` :
//   mybotia → mybotia_business (HTTP signé Bearer service)
//   vlmedical / igh / cmb_lux → dolibarr (legacy, comportement V1.1.A)
//   esprit_loft → external (501 propre)
//
// Phase 1.1.A : log JSON `crm_route` à chaque sortie. Aucune valeur sensible
// loggée (pas de cookie, JWT, body client).

import crypto from "node:crypto";

import { getThirdParties } from "@/lib/dolibarr";
import { mapThirdPartyToClient } from "@/lib/mappers";
import { resolveCockpitTenants } from "@/lib/tenant-resolver";
import { requireFeature } from "@/lib/tenant-features";
import {
  getCrmProvider,
  CrmRouterError,
  crmRouterErrorResponse,
  logCrmRoute,
} from "@/lib/crm-router";
import {
  businessGetJson,
  businessSendJson,
  BusinessClientError,
} from "@/lib/business-client";
import {
  mapBusinessClientToCockpit,
  type BusinessClient,
} from "@/lib/business-mappers";
import type { Client } from "@/types";

const NO_STORE = { "Cache-Control": "no-store, no-cache, must-revalidate" } as const;
const ROUTE = "/api/clients";

export async function GET(request: Request) {
  const startedAt = Date.now();
  const requestId = crypto.randomUUID();
  let tenantId: string | null = null;
  let tenantSlug = "?";
  let providerKind: string | null = null;
  let status = 200;
  let errorCode: string | null = null;
  let response: Response;

  try {
    const featureCheck = await requireFeature(request, "crm");
    if (!featureCheck.ok) {
      response = featureCheck.response;
      status = response.status;
      errorCode = "feature_disabled";
      return response;
    }

    const cockpit = await resolveCockpitTenants(request);
    if (!cockpit.ok) {
      status = cockpit.status;
      errorCode = "cockpit_refused";
      response = Response.json(
        { error: cockpit.error },
        { status: cockpit.status, headers: NO_STORE },
      );
      return response;
    }
    const { tenant, slug } = cockpit;
    tenantSlug = slug;

    const provider = await getCrmProvider(tenantSlug);
    tenantId = provider.tenantId;
    providerKind = provider.kind;

    if (provider.kind === "external") {
      status = 501;
      errorCode = "crm_provider_not_configured";
      response = Response.json(
        { error: errorCode, tenant: tenantSlug },
        { status, headers: NO_STORE },
      );
      return response;
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
      // dolibarr (legacy). V1.1.B Phase 1.1.D : pas de .catch(() => []).
      // Une panne Dolibarr → erreur explicite (502 via le try/catch
      // route-level + log crm_route avec error_code), plutôt qu'un
      // cockpit silencieusement vide.
      const tps = await getThirdParties(100, tenant);
      clients = tps
        .filter((tp) => tp.status !== "0" || !tp.name.includes("TEST"))
        .map((tp) => ({ ...mapThirdPartyToClient(tp), tenantSlug }));
    }

    response = Response.json(clients, { headers: NO_STORE });
    return response;
  } catch (e) {
    if (e instanceof CrmRouterError) {
      status = e.status;
      errorCode = e.code;
      response = crmRouterErrorResponse(e);
      return response;
    }
    if (e instanceof BusinessClientError) {
      status = e.status;
      errorCode = e.code;
      response = Response.json(
        { error: e.code, message: e.message },
        { status: e.status, headers: NO_STORE },
      );
      return response;
    }
    status = 502;
    errorCode = e instanceof Error ? e.name : "UnknownError";
    response = Response.json(
      { error: e instanceof Error ? e.message : "Erreur CRM" },
      { status: 502, headers: NO_STORE },
    );
    return response;
  } finally {
    logCrmRoute({
      evt: "crm_route",
      request_id: requestId,
      tenant_id: tenantId,
      tenant_slug: tenantSlug,
      route: ROUTE,
      crm_provider: providerKind,
      source: providerKind,
      status,
      duration_ms: Date.now() - startedAt,
      error_code: errorCode,
    });
  }
}

// V1.1.B Phase 2 — POST /api/clients (création via crm-router).
// mybotia → mybotia_business avec scope crm:write.
// Tenants legacy : Dolibarr Platform n'expose pas createClient → 501.
export async function POST(request: Request) {
  const startedAt = Date.now();
  const requestId = crypto.randomUUID();
  let tenantId: string | null = null;
  let tenantSlug = "?";
  let providerKind: string | null = null;
  let status = 201;
  let errorCode: string | null = null;
  let response: Response;

  try {
    const featureCheck = await requireFeature(request, "crm");
    if (!featureCheck.ok) {
      response = featureCheck.response;
      status = response.status;
      errorCode = "feature_disabled";
      return response;
    }

    const cockpit = await resolveCockpitTenants(request);
    if (!cockpit.ok) {
      status = cockpit.status;
      errorCode = "cockpit_refused";
      response = Response.json(
        { error: cockpit.error },
        { status: cockpit.status, headers: NO_STORE },
      );
      return response;
    }
    tenantSlug = cockpit.slug;

    const provider = await getCrmProvider(tenantSlug);
    tenantId = provider.tenantId;
    providerKind = provider.kind;

    if (provider.kind !== "mybotia_business") {
      status = 501;
      errorCode =
        provider.kind === "external"
          ? "crm_provider_not_configured"
          : "create_not_supported_on_provider";
      response = Response.json(
        { error: errorCode, tenant: tenantSlug, provider: provider.kind },
        { status, headers: NO_STORE },
      );
      return response;
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      status = 400;
      errorCode = "bad_body";
      response = Response.json(
        { error: errorCode },
        { status: 400, headers: NO_STORE },
      );
      return response;
    }

    const created = await businessSendJson<BusinessClient>(
      "POST",
      "/api/v1/clients",
      body,
      {
        tenantId: provider.tenantId,
        tenantSlug,
        scopes: ["crm:read", "crm:write"],
      },
    );

    response = Response.json(
      mapBusinessClientToCockpit(created, tenantSlug),
      { status: 201, headers: NO_STORE },
    );
    return response;
  } catch (e) {
    if (e instanceof CrmRouterError) {
      status = e.status;
      errorCode = e.code;
      response = crmRouterErrorResponse(e);
      return response;
    }
    if (e instanceof BusinessClientError) {
      status = e.status;
      errorCode = e.code;
      response = Response.json(
        { error: e.code, message: e.message },
        { status: e.status, headers: NO_STORE },
      );
      return response;
    }
    status = 502;
    errorCode = e instanceof Error ? e.name : "UnknownError";
    response = Response.json(
      { error: e instanceof Error ? e.message : "Erreur CRM" },
      { status: 502, headers: NO_STORE },
    );
    return response;
  } finally {
    logCrmRoute({
      evt: "crm_route",
      request_id: requestId,
      tenant_id: tenantId,
      tenant_slug: tenantSlug,
      route: ROUTE,
      crm_provider: providerKind,
      source: providerKind,
      status,
      duration_ms: Date.now() - startedAt,
      error_code: errorCode,
    });
  }
}
