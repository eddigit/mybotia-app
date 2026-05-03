// Bloc 5G — /api/dashboard verrouillé sur le cockpit hostname.
// Plus jamais d'agrégation multi-tenant ici. Pour la future zone admin
// globale, créer une route dédiée /api/admin/dashboard.

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

const NO_STORE = { "Cache-Control": "no-store, no-cache, must-revalidate" } as const;

export async function GET(request: Request) {
  try {
    const cockpit = await resolveCockpitTenants(request);
    if (!cockpit.ok) {
      return Response.json({ error: cockpit.error }, { status: cockpit.status, headers: NO_STORE });
    }
    const { tenant, slug: tenantSlug } = cockpit;

    const [tps, projects, invoices, proposals, events] = await Promise.all([
      getThirdParties(200, tenant).catch(() => []),
      getProjects(200, tenant).catch(() => []),
      getInvoices(100, tenant).catch(() => []),
      getProposals(100, tenant).catch(() => []),
      getEvents(200, tenant).catch(() => []),
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
      },
      { headers: NO_STORE }
    );
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Erreur Dolibarr" },
      { status: 502, headers: NO_STORE }
    );
  }
}
