// V1.1.D Phase 2 — Proxy /api/affaires/[id] → mybotia-business /api/v1/affaires/[id].
//
// GET    : lecture d'une affaire (ProjectRow snake_case)
// PATCH  : édition partielle (titre, status, dueDate, ownerUserId, etc.)
// DELETE : soft = bascule status='abandoned' côté business
//
// Doctrine "JAMAIS de mock" : si business renvoie 401/403/feature_disabled,
// on propage le code/erreur pour que l'UI affiche un état actionnable.

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

async function resolveProvider(request: Request) {
  const featureCheck = await requireFeature(request, "pipeline");
  if (!featureCheck.ok) {
    return { ok: false as const, response: featureCheck.response };
  }
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
  return {
    ok: true as const,
    tenantSlug: cockpit.slug,
    tenantId: provider.tenantId,
  };
}

function mapError(e: unknown) {
  if (e instanceof CrmRouterError) return crmRouterErrorResponse(e);
  if (e instanceof BusinessClientError) {
    return Response.json(
      { error: e.code, message: e.message },
      { status: e.status, headers: NO_STORE },
    );
  }
  return Response.json(
    { error: e instanceof Error ? e.message : "Erreur affaire" },
    { status: 502, headers: NO_STORE },
  );
}

export async function GET(request: Request, { params }: Params) {
  const { id } = await params;
  try {
    const ctx = await resolveProvider(request);
    if (!ctx.ok) return ctx.response;
    const data = await businessGetJson<unknown>(
      `/api/v1/affaires/${encodeURIComponent(id)}`,
      {
        tenantId: ctx.tenantId,
        tenantSlug: ctx.tenantSlug,
        scopes: ["crm:read"] as const,
      },
    );
    return Response.json(data, { headers: NO_STORE });
  } catch (e) {
    return mapError(e);
  }
}

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  try {
    const ctx = await resolveProvider(request);
    if (!ctx.ok) return ctx.response;
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json(
        { error: "body_json_invalid" },
        { status: 400, headers: NO_STORE },
      );
    }
    const updated = await businessSendJson<unknown>(
      "PATCH",
      `/api/v1/affaires/${encodeURIComponent(id)}`,
      body,
      {
        tenantId: ctx.tenantId,
        tenantSlug: ctx.tenantSlug,
        scopes: ["crm:read", "crm:write"] as const,
      },
    );
    return Response.json(updated, { headers: NO_STORE });
  } catch (e) {
    return mapError(e);
  }
}

export async function DELETE(request: Request, { params }: Params) {
  const { id } = await params;
  try {
    const ctx = await resolveProvider(request);
    if (!ctx.ok) return ctx.response;
    const result = await businessSendJson<unknown>(
      "DELETE",
      `/api/v1/affaires/${encodeURIComponent(id)}`,
      undefined,
      {
        tenantId: ctx.tenantId,
        tenantSlug: ctx.tenantSlug,
        scopes: ["crm:read", "crm:write"] as const,
      },
    );
    return Response.json(result, { headers: NO_STORE });
  } catch (e) {
    return mapError(e);
  }
}
