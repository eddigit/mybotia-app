// V1.1.B Phase 2 A3 — fiche client via crm-router.
// mybotia → mybotia_business : client + contacts + projects + quotes +
//   invoices + activities[] (vide, business V1 n'a pas d'events)
// legacy → Dolibarr (5 endpoints en parallèle, comportement V1.1.A)
//
// Le `id` est un UUID si provider=business, sinon un id numérique Dolibarr.
// On résout le provider d'abord, puis on dispatch.

import crypto from "node:crypto";

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
  mapBusinessProjectToCockpit,
  type BusinessClient,
  type BusinessProject,
} from "@/lib/business-mappers";

const NO_STORE = {
  "Cache-Control": "no-store, no-cache, must-revalidate",
} as const;
const ROUTE_GET = "/api/clients/[id]";
const ROUTE_PATCH = "/api/clients/[id]";

// Shapes business non couvertes par business-mappers : minimal local types.
type BusinessContactRow = {
  id: string;
  clientId: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  role: string | null;
};

type BusinessQuoteRow = {
  id: string;
  reference: string;
  clientId: string;
  status: string;
  totalTtc: string | number;
  issuedAt: string | null;
  createdAt: string;
};

type BusinessInvoiceRow = {
  id: string;
  reference: string;
  clientId: string;
  status: string;
  totalTtc: string | number;
  issuedAt: string | null;
  createdAt: string;
};

function safeNumber(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = parseFloat(v);
    return Number.isNaN(n) ? 0 : n;
  }
  return 0;
}

export async function GET(
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
    const { id } = await params;

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

    if (provider.kind === "external") {
      status = 501;
      errorCode = "crm_provider_not_configured";
      response = Response.json(
        { error: errorCode, tenant: tenantSlug },
        { status, headers: NO_STORE },
      );
      return response;
    }

    if (provider.kind === "mybotia_business") {
      const claims = {
        tenantId: provider.tenantId,
        tenantSlug,
        scopes: ["crm:read"] as const,
      };
      const idEnc = encodeURIComponent(id);
      const [bizClient, bizContacts, bizProjects, bizQuotes, bizInvoices] =
        await Promise.all([
          businessGetJson<BusinessClient>(`/api/v1/clients/${idEnc}`, claims),
          businessGetJson<BusinessContactRow[]>(
            `/api/v1/contacts?client_id=${idEnc}`,
            claims,
          ),
          businessGetJson<BusinessProject[]>(
            `/api/v1/projects?client_id=${idEnc}`,
            claims,
          ),
          businessGetJson<BusinessQuoteRow[]>(
            `/api/v1/quotes?client_id=${idEnc}`,
            claims,
          ),
          businessGetJson<BusinessInvoiceRow[]>(
            `/api/v1/invoices?client_id=${idEnc}`,
            claims,
          ),
        ]);

      const client = mapBusinessClientToCockpit(bizClient, tenantSlug);
      const projects = bizProjects.map((p, i) =>
        mapBusinessProjectToCockpit(p, i, client.name, tenantSlug),
      );

      response = Response.json(
        {
          client,
          contacts: bizContacts.map((c) => ({
            id: c.id,
            name: `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim(),
            email: c.email ?? "",
            phone: c.phone ?? undefined,
            role: c.role ?? undefined,
          })),
          activities: [],
          invoices: bizInvoices.map((inv) => ({
            id: inv.id,
            ref: inv.reference,
            total: safeNumber(inv.totalTtc),
            status:
              inv.status === "paid"
                ? "paid"
                : inv.status === "draft"
                  ? "draft"
                  : "sent",
            date: inv.issuedAt ?? inv.createdAt?.slice(0, 10) ?? "",
          })),
          proposals: bizQuotes.map((q) => ({
            id: q.id,
            ref: q.reference,
            total: safeNumber(q.totalTtc),
            status: q.status,
            date: q.issuedAt ?? q.createdAt?.slice(0, 10) ?? "",
          })),
          projects,
        },
        { headers: NO_STORE },
      );
      return response;
    }

    // dolibarr (legacy) — flow inchangé
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

    response = Response.json({
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
              typeof inv.date === "number" ? inv.date * 1000 : inv.date,
            )
              .toISOString()
              .slice(0, 10)
          : "",
      })),
      proposals: proposals.map((p) => mapProposal(p)),
      projects: projects.map((p, i) => mapDolibarrProject(p, i, client.name)),
    });
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
      route: ROUTE_GET,
      crm_provider: providerKind,
      source: providerKind,
      status,
      duration_ms: Date.now() - startedAt,
      error_code: errorCode,
    });
  }
}

// V1.1.B Phase 2 — PATCH /api/clients/[id] : update via crm-router.
// mybotia → mybotia_business avec scope crm:write.
// Tenants legacy : Dolibarr Platform n'expose pas updateClient → 501.

const NO_STORE_PATCH = NO_STORE;

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

// V1.1.B Phase 2 A5 — DELETE /api/clients/[id] via crm-router.
// mybotia → DELETE business (CASCADE supprime projects, tasks, contacts,
// quotes, invoices liés via FK ON DELETE CASCADE).
// Tenants legacy → 501 (Dolibarr Platform n'expose pas deleteClient).
const ROUTE_DELETE = "/api/clients/[id]";

export async function DELETE(
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
          : "delete_not_supported_on_provider";
      response = Response.json(
        { error: errorCode, tenant: tenantSlug, provider: provider.kind },
        { status, headers: NO_STORE },
      );
      return response;
    }

    const { id } = await params;
    const out = await businessSendJson<{ id: string; deleted: boolean }>(
      "DELETE",
      `/api/v1/clients/${encodeURIComponent(id)}`,
      undefined,
      {
        tenantId: provider.tenantId,
        tenantSlug,
        scopes: ["crm:read", "crm:write"],
      },
    );
    response = Response.json(
      { ok: true, id: out.id, tenant_slug: tenantSlug, deleted: out.deleted },
      { headers: NO_STORE },
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
      route: ROUTE_DELETE,
      crm_provider: providerKind,
      source: providerKind,
      status,
      duration_ms: Date.now() - startedAt,
      error_code: errorCode,
    });
  }
}
