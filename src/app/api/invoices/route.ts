// V1.1.F — Proxy /api/invoices → mybotia-business /api/v1/invoices.
//
// GET  : liste factures (filtres client_id, status). Le filtrage par
//        production_id est appliqué côté app (biz n'expose pas ce filtre,
//        cf. /api/productions/[id]/invoices).
// POST : création (scope crm:write).
//
// Doctrine V1.1.F : feature `finance` requise. Provider doit être
// `mybotia_business` (les tenants legacy Dolibarr restent sur leurs UI).

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

export type InvoiceRow = {
  id: string;
  tenantId?: string;
  tenant_id?: string;
  number: string;
  reference?: string;
  clientId?: string;
  client_id?: string;
  projectId?: string | null;
  project_id?: string | null;
  quoteId?: string | null;
  quote_id?: string | null;
  status: "draft" | "sent" | "paid" | "overdue" | "cancelled";
  subject?: string | null;
  notes?: string | null;
  issuedAt?: string | null;
  issued_at?: string | null;
  dueDate?: string | null;
  due_date?: string | null;
  subtotalHt?: string | number;
  subtotal_ht?: string | number;
  vatTotal?: string | number;
  vat_total?: string | number;
  totalTtc?: string | number;
  total_ttc?: string | number;
  paidAt?: string | null;
  paid_at?: string | null;
  createdAt?: string;
  created_at?: string;
  updatedAt?: string;
  updated_at?: string;
};

export async function GET(request: Request) {
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

    const url = new URL(request.url);
    const search = new URLSearchParams();
    // production_id est désormais supporté nativement par biz GET /api/v1/invoices
    // (cf. /opt/mybotia/mybotia-business/src/app/api/v1/invoices/route.ts) et
    // mappe sur projects.lifecycle_stage='production'. Le filtre app-side
    // historique est conservé en fallback pour les biz < V1.1.D.
    for (const k of ["client_id", "status", "production_id"]) {
      const v = url.searchParams.get(k);
      if (v !== null && v !== "") search.set(k, v);
    }
    const productionId = url.searchParams.get("production_id");
    const qs = search.toString();
    const path = `/api/v1/invoices${qs ? `?${qs}` : ""}`;

    let data = await businessGetJson<InvoiceRow[]>(path, {
      tenantId: provider.tenantId,
      tenantSlug: cockpit.slug,
      scopes: ["crm:read"] as const,
    });

    // Fallback app-side défensif : si le biz n'a pas honoré le filtre
    // (déploiement non synchro), on filtre ici par projectId.
    if (productionId) {
      data = data.filter((inv) => {
        const pid = inv.projectId ?? inv.project_id ?? null;
        return pid === productionId;
      });
    }

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
      { error: e instanceof Error ? e.message : "Erreur invoices" },
      { status: 502, headers: NO_STORE },
    );
  }
}

export async function POST(request: Request) {
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

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return Response.json(
        { error: "bad_body" },
        { status: 400, headers: NO_STORE },
      );
    }

    const created = await businessSendJson<InvoiceRow>(
      "POST",
      "/api/v1/invoices",
      body,
      {
        tenantId: provider.tenantId,
        tenantSlug: cockpit.slug,
        scopes: ["crm:read", "crm:write"] as const,
      },
    );
    return Response.json(created, { status: 201, headers: NO_STORE });
  } catch (e) {
    if (e instanceof CrmRouterError) return crmRouterErrorResponse(e);
    if (e instanceof BusinessClientError) {
      return Response.json(
        { error: e.code, message: e.message, details: e.details },
        { status: e.status, headers: NO_STORE },
      );
    }
    return Response.json(
      { error: e instanceof Error ? e.message : "Erreur invoices" },
      { status: 502, headers: NO_STORE },
    );
  }
}
