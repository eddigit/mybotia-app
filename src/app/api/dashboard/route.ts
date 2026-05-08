// Bloc 5G — /api/dashboard verrouillé sur le cockpit hostname.
// Plus jamais d'agrégation multi-tenant ici. Pour la future zone admin
// globale, créer une route dédiée /api/admin/dashboard.
//
// V1.1.B Phase 3A anti-hybride silencieux : si crm_provider=mybotia_business,
// le dashboard agrège exclusivement les données business (pas de mélange).

import {
  getThirdParties,
  getProjects,
  getInvoices,
  getProposals,
  getEvents,
} from "@/lib/dolibarr";
import {
  mapThirdPartyToClient,
  mapDolibarrProject,
  mapProjectToDeal,
  mapEventToActivity,
  mapProposal,
  mapInvoice,
  computeMetrics,
} from "@/lib/mappers";
import { resolveCockpitTenants } from "@/lib/tenant-resolver";
import { getCockpitFeatures } from "@/lib/tenant-features";
import {
  getCrmProvider,
  CrmRouterError,
  crmRouterErrorResponse,
} from "@/lib/crm-router";
import { businessGetJson, BusinessClientError } from "@/lib/business-client";
import {
  mapBusinessClientToCockpit,
  mapBusinessProjectToCockpit,
  type BusinessClient,
  type BusinessProject,
} from "@/lib/business-mappers";

const NO_STORE = { "Cache-Control": "no-store, no-cache, must-revalidate" } as const;

type BusinessDashboardKpis = {
  clients_total: number;
  clients_active: number;
  projects_active: number;
  tasks_open: number;
  tasks_overdue: number;
  quotes_pending: number;
  invoices_unpaid: number;
  quoted_amount: number;
  invoiced_amount: number;
  paid_amount: number;
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

type BusinessInvoiceRow = BusinessQuoteRow;

function safeNumber(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = parseFloat(v);
    return Number.isNaN(n) ? 0 : n;
  }
  return 0;
}

export async function GET(request: Request) {
  try {
    const cockpit = await resolveCockpitTenants(request);
    if (!cockpit.ok) {
      return Response.json({ error: cockpit.error }, { status: cockpit.status, headers: NO_STORE });
    }
    const { tenant, slug: tenantSlug } = cockpit;

    const provider = await getCrmProvider(tenantSlug);

    // V1.1.B Phase 3A — branche business-first
    if (provider.kind === "mybotia_business") {
      const claims = {
        tenantId: provider.tenantId,
        tenantSlug,
        scopes: ["crm:read"] as const,
      };
      const [bizDash, bizClients, bizProjects, bizQuotes, bizInvoices] = await Promise.all([
        businessGetJson<{ kpis: BusinessDashboardKpis }>("/api/v1/dashboard", claims),
        businessGetJson<BusinessClient[]>("/api/v1/clients", claims),
        businessGetJson<BusinessProject[]>("/api/v1/projects", claims),
        businessGetJson<BusinessQuoteRow[]>("/api/v1/quotes", claims).catch(() => []),
        businessGetJson<BusinessInvoiceRow[]>("/api/v1/invoices", claims).catch(() => []),
      ]);

      const clientNameById: Record<string, string> = {};
      for (const c of bizClients) clientNameById[c.id] = c.name;

      const clients = bizClients.map((c) => mapBusinessClientToCockpit(c, tenantSlug));
      const projects = bizProjects.map((p, i) =>
        mapBusinessProjectToCockpit(p, i, clientNameById[p.clientId], tenantSlug),
      );

      const metrics = [
        {
          id: "metric-clients",
          label: "Clients actifs",
          value: bizDash.kpis.clients_active,
          trend: "stable" as const,
        },
        {
          id: "metric-pipeline",
          label: "Pipeline commercial",
          value: `${Math.round(bizDash.kpis.quoted_amount).toLocaleString("fr-FR")} EUR`,
          trend: "up" as const,
        },
        {
          id: "metric-projects",
          label: "Projets actifs",
          value: bizDash.kpis.projects_active,
          trend: "stable" as const,
        },
        {
          id: "metric-revenue",
          label: "CA encaissé",
          value: `${Math.round(bizDash.kpis.paid_amount).toLocaleString("fr-FR")} EUR`,
          trend: "stable" as const,
        },
      ];

      return Response.json(
        {
          metrics,
          clients,
          projects,
          deals: [], // business V1 n'a pas de pipeline opp_status
          proposals: bizQuotes.map((q) => ({
            id: q.id,
            ref: q.reference,
            total: safeNumber(q.totalTtc),
            status: q.status,
            date: q.issuedAt ?? q.createdAt?.slice(0, 10) ?? "",
            expiryDate: "",
            clientId: q.clientId,
            clientName: clientNameById[q.clientId],
            tenantSlug,
          })),
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
            clientId: inv.clientId,
            clientName: clientNameById[inv.clientId],
            tenantSlug,
          })),
          activities: [],
          tenant: tenantSlug,
          source: "mybotia_business",
          partial: true,
          missingFeatures: ["deals_pipeline", "activities_events"],
        },
        { headers: NO_STORE },
      );
    }

    if (provider.kind === "external") {
      return Response.json(
        {
          error: "crm_provider_not_configured",
          tenant: tenantSlug,
          metrics: [],
          clients: [],
          projects: [],
          deals: [],
          proposals: [],
          invoices: [],
          activities: [],
          partial: true,
        },
        { status: 501, headers: NO_STORE },
      );
    }

    // dolibarr (legacy) — flow inchangé
    // Bloc 6B — soft feature gate : dashboard reste accessible mais filtre
    // ses sections selon les features. Ne casse jamais le rendu.
    const { features } = await getCockpitFeatures(request);
    const fCrm = features.crm === true;
    const fPipeline = features.pipeline === true;
    const fDocs = features.documents === true;

    const [tps, projects, invoices, proposals, events] = await Promise.all([
      fCrm ? getThirdParties(200, tenant).catch(() => []) : Promise.resolve([]),
      fPipeline ? getProjects(200, tenant).catch(() => []) : Promise.resolve([]),
      fDocs ? getInvoices(100, tenant).catch(() => []) : Promise.resolve([]),
      fDocs ? getProposals(100, tenant).catch(() => []) : Promise.resolve([]),
      getEvents(200, tenant).catch(() => []), // activities toujours autorisées
    ]);

    const clients = tps.map((tp) => ({
      ...mapThirdPartyToClient(tp),
      tenantSlug,
    }));

    const clientNameById: Record<string, string> = {};
    for (const tp of tps) clientNameById[tp.id] = tp.name_alias || tp.name;

    const mappedProjects = projects.map((dp, i) =>
      mapDolibarrProject(dp, i, clientNameById[dp.socid], tenantSlug)
    );

    const deals = projects
      .map((dp) =>
        mapProjectToDeal(dp, clientNameById[dp.socid] || "", tenantSlug)
      )
      .filter((d): d is NonNullable<typeof d> => d !== null);

    const manualEvents = events.filter((e) => e.type_code !== "AC_OTH_AUTO");
    const autoEvents = events.filter((e) => e.type_code === "AC_OTH_AUTO");
    const sortedEvents = [...manualEvents, ...autoEvents];

    const activities = sortedEvents
      .slice(0, 15)
      .map((ev) => mapEventToActivity(ev, clientNameById, undefined, undefined, tenantSlug));

    const mappedProposals = proposals.map((p) =>
      mapProposal(p, tenantSlug, clientNameById[p.socid])
    );
    const mappedInvoices = invoices.map((inv) =>
      mapInvoice(inv, tenantSlug, clientNameById[inv.socid])
    );

    const metrics = computeMetrics(clients, mappedProjects, deals, invoices);

    return Response.json(
      {
        metrics,
        clients,
        projects: mappedProjects,
        deals,
        proposals: mappedProposals,
        invoices: mappedInvoices,
        activities,
        tenant: tenantSlug,
        source: "dolibarr",
      },
      { headers: NO_STORE }
    );
  } catch (e) {
    if (e instanceof CrmRouterError) return crmRouterErrorResponse(e);
    if (e instanceof BusinessClientError) {
      return Response.json(
        { error: e.code, message: e.message },
        { status: e.status, headers: NO_STORE },
      );
    }
    return Response.json(
      { error: e instanceof Error ? e.message : "Erreur CRM" },
      { status: 502, headers: NO_STORE }
    );
  }
}
