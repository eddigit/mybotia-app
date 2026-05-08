// V1.1.C — /api/contacts via crm-router (business-first sur tenant mybotia).
//
// Avant V1.1.C : POST/PUT verrouillaient déjà l'auth + tenant courant mais
// appelaient `createContact` / `updateContact` Dolibarr en dur.
// Conséquence : sur tenant `mybotia` (provider mybotia_business), tout POST
// renvoyait 502/500 (Dolibarr URL absent). Bug confirmé Business Scenario
// Simulator 2026-05-08.
//
// V1.1.C : route routée via `getCrmProvider`. Sur `mybotia_business` :
//   - GET (optionnel `?clientId=…`) → `/api/v1/contacts[?client_id=…]` business
//   - POST → `/api/v1/contacts` business (mapping Dolibarr-style toléré)
//   - PUT  → `/api/v1/contacts/[id]` business (PATCH côté business)
// Sur `dolibarr` (vlmedical / igh / cmb_lux) : flow legacy inchangé.
// Sur `external` (esprit_loft) : 501 propre.

import crypto from "node:crypto";

import { createContact, updateContact, getThirdParty } from "@/lib/dolibarr";
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

const NO_STORE = { "Cache-Control": "no-store, no-cache, must-revalidate" } as const;
const ROUTE_GET = "/api/contacts";
const ROUTE_POST = "/api/contacts";
const ROUTE_PUT = "/api/contacts";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type BusinessContactRow = {
  id: string;
  clientId: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: string | null;
};

function mapBusinessContactToCockpit(c: BusinessContactRow) {
  return {
    id: c.id,
    clientId: c.clientId,
    name: c.name,
    // Compat Dolibarr-style (UI legacy) : split heuristique (best effort).
    // Le canon V1.1.C est `name` (single field), aligné DB business.
    firstname: c.name?.split(" ")?.slice(0, -1).join(" ") || "",
    lastname: c.name?.split(" ")?.slice(-1).join(" ") || c.name,
    email: c.email ?? "",
    phone: c.phone ?? "",
    role: c.role ?? "",
  };
}

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
      response = Response.json({ error: cockpit.error }, { status: cockpit.status, headers: NO_STORE });
      return response;
    }
    const { slug } = cockpit;
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

    if (provider.kind === "mybotia_business") {
      const url = new URL(request.url);
      const clientIdRaw = url.searchParams.get("clientId") ?? url.searchParams.get("client_id");
      const clientIdQs = clientIdRaw && UUID_RE.test(clientIdRaw)
        ? `?client_id=${encodeURIComponent(clientIdRaw)}`
        : "";
      const list = await businessGetJson<BusinessContactRow[]>(
        `/api/v1/contacts${clientIdQs}`,
        {
          tenantId: provider.tenantId,
          tenantSlug,
          scopes: ["crm:read"],
        },
      );
      response = Response.json(list.map(mapBusinessContactToCockpit), { headers: NO_STORE });
      return response;
    }

    // dolibarr (legacy) — pas de GET legacy historique sur cette route
    // (avant V1.1.C, GET inexistant). On retourne 405 pour signaler clairement.
    status = 405;
    errorCode = "method_not_allowed_dolibarr";
    response = Response.json(
      { error: "GET /api/contacts non implémenté pour provider dolibarr" },
      { status, headers: NO_STORE },
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
      route: ROUTE_GET,
      crm_provider: providerKind,
      source: providerKind,
      status,
      duration_ms: Date.now() - startedAt,
      error_code: errorCode,
    });
  }
}

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
      response = Response.json({ error: cockpit.error }, { status: cockpit.status, headers: NO_STORE });
      return response;
    }
    const { slug } = cockpit;
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

    const body = await request.json();

    if (provider.kind === "mybotia_business") {
      // Mapping permissif : accepte (name, clientId) [V1.1.C] ou
      // (firstname, lastname, socid) [Dolibarr legacy reçu par Léa MCP].
      const clientIdInput = body.clientId ?? body.client_id ?? body.socid;
      const nameInput =
        body.name ||
        `${body.firstname ?? ""} ${body.lastname ?? ""}`.trim() ||
        body.lastname ||
        "";

      if (!nameInput || !clientIdInput) {
        status = 400;
        errorCode = "missing_required_fields";
        response = Response.json(
          {
            error: errorCode,
            required: ["name (or firstname+lastname)", "clientId (or socid)"],
          },
          { status, headers: NO_STORE },
        );
        return response;
      }
      if (!UUID_RE.test(String(clientIdInput))) {
        status = 400;
        errorCode = "invalid_client_id";
        response = Response.json(
          { error: errorCode, hint: "clientId/socid doit être un UUID business" },
          { status, headers: NO_STORE },
        );
        return response;
      }

      const created = await businessSendJson<{ id: string; name: string }>(
        "POST",
        "/api/v1/contacts",
        {
          clientId: String(clientIdInput),
          name: String(nameInput),
          email: body.email || null,
          phone: body.phone || body.phone_pro || body.phone_mobile || null,
          role: body.role || body.poste || null,
        },
        {
          tenantId: provider.tenantId,
          tenantSlug,
          scopes: ["crm:read", "crm:write"],
        },
      );
      status = 201;
      response = Response.json(
        { id: created.id, tenant_slug: tenantSlug, name: created.name },
        { status, headers: NO_STORE },
      );
      return response;
    }

    // dolibarr (legacy) — flow inchangé
    if (!body.lastname || !body.socid) {
      status = 400;
      errorCode = "missing_required_fields";
      response = Response.json(
        { error: "lastname et socid sont requis" },
        { status, headers: NO_STORE },
      );
      return response;
    }

    // Vérifier que le socid appartient au tenant courant
    try {
      await getThirdParty(String(body.socid), cockpit.tenant);
    } catch {
      status = 404;
      errorCode = "socid_not_in_tenant";
      response = Response.json(
        { error: "socid introuvable dans le tenant courant" },
        { status, headers: NO_STORE },
      );
      return response;
    }

    const newId = await createContact(
      {
        firstname: body.firstname || "",
        lastname: body.lastname,
        socid: body.socid,
        email: body.email || "",
        phone_pro: body.phone_pro || "",
        phone_mobile: body.phone_mobile || "",
        poste: body.poste || "",
      },
      cockpit.tenant,
    );

    status = 201;
    response = Response.json({ id: newId }, { status, headers: NO_STORE });
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
      { error: e instanceof Error ? e.message : "Erreur creation contact" },
      { status, headers: NO_STORE },
    );
    return response;
  } finally {
    logCrmRoute({
      evt: "crm_route",
      request_id: requestId,
      tenant_id: tenantId,
      tenant_slug: tenantSlug,
      route: ROUTE_POST,
      crm_provider: providerKind,
      source: providerKind,
      status,
      duration_ms: Date.now() - startedAt,
      error_code: errorCode,
    });
  }
}

export async function PUT(request: Request) {
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
      response = Response.json({ error: cockpit.error }, { status: cockpit.status, headers: NO_STORE });
      return response;
    }
    const { slug } = cockpit;
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

    const body = await request.json();
    const { id, ...data } = body;
    if (!id) {
      status = 400;
      errorCode = "missing_id";
      response = Response.json({ error: "id requis" }, { status, headers: NO_STORE });
      return response;
    }

    if (provider.kind === "mybotia_business") {
      if (!UUID_RE.test(String(id))) {
        status = 400;
        errorCode = "invalid_id";
        response = Response.json(
          { error: errorCode, hint: "id doit être un UUID business" },
          { status, headers: NO_STORE },
        );
        return response;
      }
      const businessBody: Record<string, unknown> = {};
      if (data.name !== undefined) businessBody.name = data.name;
      else if (data.firstname !== undefined || data.lastname !== undefined) {
        businessBody.name = `${data.firstname ?? ""} ${data.lastname ?? ""}`.trim();
      }
      if (data.email !== undefined) businessBody.email = data.email || null;
      if (data.phone !== undefined) businessBody.phone = data.phone || null;
      else if (data.phone_pro !== undefined) businessBody.phone = data.phone_pro || null;
      else if (data.phone_mobile !== undefined) businessBody.phone = data.phone_mobile || null;
      if (data.role !== undefined) businessBody.role = data.role || null;
      else if (data.poste !== undefined) businessBody.role = data.poste || null;

      await businessSendJson<{ id: string }>(
        "PUT",
        `/api/v1/contacts/${encodeURIComponent(String(id))}`,
        businessBody,
        {
          tenantId: provider.tenantId,
          tenantSlug,
          scopes: ["crm:read", "crm:write"],
        },
      );
      status = 200;
      response = Response.json({ success: true, tenant_slug: tenantSlug }, { headers: NO_STORE });
      return response;
    }

    // dolibarr (legacy) — flow inchangé
    const checkRes = await fetch(
      `${cockpit.tenant.url}/contacts/${encodeURIComponent(String(id))}`,
      { headers: { DOLAPIKEY: cockpit.tenant.apiKey } },
    );
    if (!checkRes.ok) {
      status = checkRes.status === 404 ? 404 : 502;
      errorCode = "contact_not_in_tenant";
      response = Response.json(
        { error: "contact introuvable dans le tenant courant" },
        { status, headers: NO_STORE },
      );
      return response;
    }

    await updateContact(String(id), data, cockpit.tenant);
    status = 200;
    response = Response.json({ success: true }, { headers: NO_STORE });
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
      { error: e instanceof Error ? e.message : "Erreur mise a jour contact" },
      { status, headers: NO_STORE },
    );
    return response;
  } finally {
    logCrmRoute({
      evt: "crm_route",
      request_id: requestId,
      tenant_id: tenantId,
      tenant_slug: tenantSlug,
      route: ROUTE_PUT,
      crm_provider: providerKind,
      source: providerKind,
      status,
      duration_ms: Date.now() - startedAt,
      error_code: errorCode,
    });
  }
}
