// V1.1.D Phase 2 — Factures liées à une production (app-side proxy).
//
// GET /api/productions/[id]/invoices
//
// Pourquoi ce endpoint dérivé : biz /api/v1/invoices ne supporte que les
// filtres `client_id` et `status` (pas `production_id`). Pour récupérer les
// factures liées à une production, on :
//   1. fetch la production (pour obtenir client_id)
//   2. fetch les invoices du client (filtre client_id biz)
//   3. filter côté app : invoice.projectId === productionId
//
// projectId côté biz invoices = production_id (lifecycle_stage='production').

import {
  businessGetJson,
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

export type InvoiceRow = {
  id: string;
  number?: string;
  reference?: string;
  clientId?: string;
  client_id?: string;
  projectId?: string | null;
  project_id?: string | null;
  status: string;
  totalTtc?: string | number;
  total_ttc?: string | number;
  subject?: string | null;
  issuedAt?: string | null;
  issued_at?: string | null;
  dueDate?: string | null;
  due_date?: string | null;
  createdAt?: string;
  created_at?: string;
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

    const { id: productionId } = await params;
    const claims = {
      tenantId: provider.tenantId,
      tenantSlug: cockpit.slug,
      scopes: ["crm:read"] as const,
    };

    // 1. Récupérer la production pour avoir client_id
    const production = await businessGetJson<{ id: string; clientId?: string; client_id?: string }>(
      `/api/v1/productions/${encodeURIComponent(productionId)}`,
      claims,
    );
    const clientId = production.clientId ?? production.client_id ?? null;
    if (!clientId) {
      return Response.json([], { headers: NO_STORE });
    }

    // 2. Liste des invoices du client (biz filtre tenant via JWT + RLS)
    const invoices = await businessGetJson<InvoiceRow[]>(
      `/api/v1/invoices?client_id=${encodeURIComponent(clientId)}`,
      claims,
    );

    // 3. Filtrer côté app par production_id (= projectId)
    const filtered = invoices.filter((inv) => {
      const pid = inv.projectId ?? inv.project_id ?? null;
      return pid === productionId;
    });
    return Response.json(filtered, { headers: NO_STORE });
  } catch (e) {
    if (e instanceof CrmRouterError) return crmRouterErrorResponse(e);
    if (e instanceof BusinessClientError) {
      return Response.json(
        { error: e.code, message: e.message },
        { status: e.status, headers: NO_STORE },
      );
    }
    return Response.json(
      { error: e instanceof Error ? e.message : "Erreur factures" },
      { status: 502, headers: NO_STORE },
    );
  }
}
