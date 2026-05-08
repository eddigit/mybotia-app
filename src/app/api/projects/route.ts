// Bloc 5G — /api/projects verrouillé sur le cockpit hostname.
// Pas d'agrégation multi-tenant. POST écrit dans le tenant cockpit.
//
// V1.1.B Phase 1 : GET passe par crm-router. POST inchangé (Phase 2).
// V1.1.B Phase 1.1.A : log JSON `crm_route` à chaque sortie GET.

import crypto from "node:crypto";

import {
  getProjects,
  getThirdParties,
  createProject,
  validateProject,
} from "@/lib/dolibarr";
import { mapDolibarrProject } from "@/lib/mappers";
import { resolveCockpitTenants } from "@/lib/tenant-resolver";
import { requireFeature } from "@/lib/tenant-features";
import {
  getCrmProvider,
  CrmRouterError,
  crmRouterErrorResponse,
  logCrmRoute,
} from "@/lib/crm-router";
import { businessGetJson, BusinessClientError } from "@/lib/business-client";
import {
  mapBusinessProjectToCockpit,
  type BusinessProject,
  type BusinessClient,
} from "@/lib/business-mappers";
import type { Project } from "@/types";

const NO_STORE = { "Cache-Control": "no-store, no-cache, must-revalidate" } as const;
const ROUTE = "/api/projects";

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
    const featureCheck = await requireFeature(request, "pipeline");
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
      response = Response.json({ error: cockpit.error }, { status: cockpit.status, headers: NO_STORE });
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

    let mapped: Project[];

    if (provider.kind === "mybotia_business") {
      const claims = {
        tenantId: provider.tenantId,
        tenantSlug,
        scopes: ["crm:read"] as const,
      };
      const [projects, clients] = await Promise.all([
        businessGetJson<BusinessProject[]>("/api/v1/projects", claims),
        businessGetJson<BusinessClient[]>("/api/v1/clients", claims),
      ]);
      const clientNameById: Record<string, string> = {};
      for (const c of clients) clientNameById[c.id] = c.name;
      mapped = projects.map((p, i) =>
        mapBusinessProjectToCockpit(p, i, clientNameById[p.clientId], tenantSlug),
      );
    } else {
      // dolibarr (legacy)
      const [tps, projects] = await Promise.all([
        getThirdParties(100, tenant).catch(() => []),
        getProjects(100, tenant).catch(() => []),
      ]);
      const clientNameById: Record<string, string> = {};
      for (const t of tps) clientNameById[t.id] = t.name_alias || t.name;
      mapped = projects.map((dp, i) =>
        mapDolibarrProject(dp, i, clientNameById[dp.socid], tenantSlug),
      );
    }

    response = Response.json(mapped, { headers: NO_STORE });
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

export async function POST(request: Request) {
  try {
    const featureCheck = await requireFeature(request, "pipeline");
    if (!featureCheck.ok) return featureCheck.response;

    const cockpit = await resolveCockpitTenants(request);
    if (!cockpit.ok) {
      return Response.json({ error: cockpit.error }, { status: cockpit.status, headers: NO_STORE });
    }
    const { tenant } = cockpit;

    const body = await request.json();
    if (!body.title || !body.ref) {
      return Response.json(
        { error: "title et ref sont requis" },
        { status: 400, headers: NO_STORE }
      );
    }

    const newId = await createProject(
      {
        ref: body.ref,
        title: body.title,
        socid: body.socid || "",
        description: body.description || "",
        date_start: body.date_start || "",
        date_end: body.date_end || "",
        budget_amount: body.budget_amount || "",
        usage_task: 1,
        usage_opportunity: body.opp_amount ? 1 : 0,
        opp_amount: body.opp_amount || "",
        opp_percent: body.opp_percent || "",
      },
      tenant
    );

    try {
      await validateProject(String(newId), tenant);
    } catch {
      // créé mais non validé
    }

    return Response.json(
      { id: newId, tenant_slug: cockpit.slug },
      { status: 201, headers: NO_STORE }
    );
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Erreur creation projet" },
      { status: 502, headers: NO_STORE }
    );
  }
}
