// V1.1.F — Proxy /api/quotes/[id] : GET (détail) + PATCH (update) +
// DELETE (soft) vers mybotia-business /api/v1/quotes/[id].
//
// Côté business, l'update est exposé en PUT (cf. `[id]/route.ts` business). On
// expose PATCH côté app (sémantique RESTful idiomatique en cockpit) et on
// délègue en PUT côté biz — body merge sémantique identique côté biz.
//
// Doctrine V1.1.F : feature gate `finance`, provider `mybotia_business`.
// Tenants legacy (Dolibarr / external) : 501 propre, jamais de 500 silencieux.

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

type Params = { params: Promise<{ id: string }> };

async function gate(request: Request) {
  const featureCheck = await requireFeature(request, "finance");
  if (!featureCheck.ok)
    return { ok: false as const, response: featureCheck.response };
  const cockpit = await resolveCockpitTenants(request);
  if (!cockpit.ok) {
    return {
      ok: false as const,
      response: Response.json(
        { error: cockpit.error },
        { status: cockpit.status, headers: NO_STORE },
      ),
    };
  }
  const provider = await getCrmProvider(cockpit.slug);
  if (provider.kind !== "mybotia_business") {
    return {
      ok: false as const,
      response: Response.json(
        {
          error: "crm_provider_not_business",
          tenant: cockpit.slug,
          provider: provider.kind,
        },
        { status: 501, headers: NO_STORE },
      ),
    };
  }
  return { ok: true as const, provider, slug: cockpit.slug };
}

function fromError(e: unknown): Response {
  if (e instanceof CrmRouterError) return crmRouterErrorResponse(e);
  if (e instanceof BusinessClientError) {
    return Response.json(
      { error: e.code, message: e.message, details: e.details },
      { status: e.status, headers: NO_STORE },
    );
  }
  return Response.json(
    { error: e instanceof Error ? e.message : "Erreur devis" },
    { status: 502, headers: NO_STORE },
  );
}

export async function GET(request: Request, { params }: Params) {
  try {
    const g = await gate(request);
    if (!g.ok) return g.response;
    const { id } = await params;
    const data = await businessGetJson<unknown>(
      `/api/v1/quotes/${encodeURIComponent(id)}`,
      {
        tenantId: g.provider.tenantId,
        tenantSlug: g.slug,
        scopes: ["crm:read"] as const,
      },
    );
    return Response.json(data, { headers: NO_STORE });
  } catch (e) {
    return fromError(e);
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const g = await gate(request);
    if (!g.ok) return g.response;
    const { id } = await params;
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return Response.json(
        { error: "bad_body" },
        { status: 400, headers: NO_STORE },
      );
    }
    // Business V1.1.D expose update en PUT (merge partiel side-server). On
    // garde PATCH côté app (sémantique idiomatique cockpit), forward en PUT.
    const data = await businessSendJson<unknown>(
      "PUT",
      `/api/v1/quotes/${encodeURIComponent(id)}`,
      body,
      {
        tenantId: g.provider.tenantId,
        tenantSlug: g.slug,
        scopes: ["crm:read", "crm:write"] as const,
      },
    );
    return Response.json(data, { headers: NO_STORE });
  } catch (e) {
    return fromError(e);
  }
}

export async function DELETE(request: Request, { params }: Params) {
  try {
    const g = await gate(request);
    if (!g.ok) return g.response;
    const { id } = await params;
    const data = await businessSendJson<unknown>(
      "DELETE",
      `/api/v1/quotes/${encodeURIComponent(id)}`,
      undefined,
      {
        tenantId: g.provider.tenantId,
        tenantSlug: g.slug,
        scopes: ["crm:read", "crm:write"] as const,
      },
    );
    return Response.json(data, { headers: NO_STORE });
  } catch (e) {
    return fromError(e);
  }
}
