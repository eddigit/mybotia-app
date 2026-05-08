import {
  getThirdParty,
  getThirdPartyContacts,
  getThirdPartyEvents,
  getThirdPartyInvoices,
  getThirdPartyProposals,
  getThirdPartyProjects,
} from "@/lib/dolibarr";
import { getSession } from "@/lib/session";
import {
  mapThirdPartyToClient,
  mapEventToActivity,
  mapProposal,
  mapDolibarrProject,
} from "@/lib/mappers";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const session = await getSession();
    const tenant = session?.tenant;

    const [tp, contacts, events, invoices, proposals, projects] =
      await Promise.all([
        getThirdParty(id, tenant),
        getThirdPartyContacts(id, tenant),
        getThirdPartyEvents(id, tenant),
        getThirdPartyInvoices(id, tenant),
        getThirdPartyProposals(id, tenant),
        getThirdPartyProjects(id, tenant),
      ]);

    const client = mapThirdPartyToClient(tp);

    const manualEvents = events.filter((e) => e.type_code !== "AC_OTH_AUTO");
    const autoEvents = events.filter((e) => e.type_code === "AC_OTH_AUTO");
    const sortedEvents = [...manualEvents, ...autoEvents];

    const activities = sortedEvents.slice(0, 15).map((e) => mapEventToActivity(e));

    return Response.json({
      client,
      contacts: contacts.map((c) => ({
        id: c.id,
        name: `${c.firstname || ""} ${c.lastname || ""}`.trim(),
        email: c.email,
        phone: c.phone_pro || c.phone_mobile,
        role: c.poste,
      })),
      activities,
      invoices: invoices.map((inv) => ({
        id: inv.id,
        ref: inv.ref,
        total: parseFloat(inv.total_ttc || "0"),
        status:
          inv.paye === "1" ? "paid" : inv.status === "0" ? "draft" : "sent",
        date: inv.date
          ? new Date(
              typeof inv.date === "number" ? inv.date * 1000 : inv.date
            )
              .toISOString()
              .slice(0, 10)
          : "",
      })),
      proposals: proposals.map((p) => mapProposal(p)),
      projects: projects.map((p, i) => mapDolibarrProject(p, i, client.name)),
    });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Erreur Dolibarr" },
      { status: 502 }
    );
  }
}

// V1.1.B Phase 2 — PATCH /api/clients/[id] : update via crm-router.
// mybotia → mybotia_business avec scope crm:write.
// Tenants legacy : Dolibarr Platform n'expose pas updateClient → 501.

import crypto from "node:crypto";

import { resolveCockpitTenants } from "@/lib/tenant-resolver";
import { requireFeature } from "@/lib/tenant-features";
import {
  getCrmProvider,
  CrmRouterError,
  crmRouterErrorResponse,
  logCrmRoute,
} from "@/lib/crm-router";
import { businessSendJson, BusinessClientError } from "@/lib/business-client";
import {
  mapBusinessClientToCockpit,
  type BusinessClient,
} from "@/lib/business-mappers";

const NO_STORE_PATCH = {
  "Cache-Control": "no-store, no-cache, must-revalidate",
} as const;
const ROUTE_PATCH = "/api/clients/[id]";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
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
        { status: cockpit.status, headers: NO_STORE_PATCH },
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
          : "update_not_supported_on_provider";
      response = Response.json(
        { error: errorCode, tenant: tenantSlug, provider: provider.kind },
        { status, headers: NO_STORE_PATCH },
      );
      return response;
    }

    const { id } = await params;
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      status = 400;
      errorCode = "bad_body";
      response = Response.json(
        { error: errorCode },
        { status: 400, headers: NO_STORE_PATCH },
      );
      return response;
    }

    const updated = await businessSendJson<BusinessClient>(
      "PUT",
      `/api/v1/clients/${encodeURIComponent(id)}`,
      body,
      {
        tenantId: provider.tenantId,
        tenantSlug,
        scopes: ["crm:read", "crm:write"],
      },
    );

    response = Response.json(
      mapBusinessClientToCockpit(updated, tenantSlug),
      { headers: NO_STORE_PATCH },
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
        { status: e.status, headers: NO_STORE_PATCH },
      );
      return response;
    }
    status = 502;
    errorCode = e instanceof Error ? e.name : "UnknownError";
    response = Response.json(
      { error: e instanceof Error ? e.message : "Erreur CRM" },
      { status: 502, headers: NO_STORE_PATCH },
    );
    return response;
  } finally {
    logCrmRoute({
      evt: "crm_route",
      request_id: requestId,
      tenant_id: tenantId,
      tenant_slug: tenantSlug,
      route: ROUTE_PATCH,
      crm_provider: providerKind,
      source: providerKind,
      status,
      duration_ms: Date.now() - startedAt,
      error_code: errorCode,
    });
  }
}
