import {
  getThirdParties,
  getThirdPartiesByCategory,
  getThirdParty,
  getProjects,
  getInvoices,
  getEvents,
} from "@/lib/dolibarr";
import {
  mapThirdPartyToClient,
  mapDolibarrProject,
  mapProjectToDeal,
  mapEventToActivity,
  computeMetrics,
} from "@/lib/mappers";
import { getTenantScope } from "@/lib/tenant";

export async function GET() {
  try {
    const scope = await getTenantScope();

    // Get thirdparties according to tenant scope
    let thirdparties;
    if (scope.isSuperadmin) {
      thirdparties = await getThirdParties();
    } else if (scope.categoryId) {
      thirdparties = await getThirdPartiesByCategory(scope.categoryId);
    } else if (scope.thirdpartyIds) {
      thirdparties = await Promise.all(
        scope.thirdpartyIds.map((id) => getThirdParty(id))
      );
    } else {
      thirdparties = await getThirdParties();
    }

    // Build filter set
    const allowedSocids = new Set(thirdparties.map((tp) => tp.id));
    const clientNameById: Record<string, string> = {};
    for (const tp of thirdparties) {
      clientNameById[tp.id] = tp.name_alias || tp.name;
    }

    // Fetch global data
    const [doliProjects, invoices, events] = await Promise.all([
      getProjects(),
      getInvoices(),
      getEvents(200),
    ]);

    // Filter by tenant
    const filteredProjects = scope.isSuperadmin
      ? doliProjects
      : doliProjects.filter((dp) => allowedSocids.has(dp.socid));
    const filteredInvoices = scope.isSuperadmin
      ? invoices
      : invoices.filter((inv) => allowedSocids.has(inv.socid));
    const filteredEvents = scope.isSuperadmin
      ? events
      : events.filter(
          (ev) => !ev.socid || allowedSocids.has(ev.socid)
        );

    const clients = thirdparties.map(mapThirdPartyToClient);

    const projects = filteredProjects.map((dp, i) =>
      mapDolibarrProject(dp, i, clientNameById[dp.socid])
    );

    const deals = filteredProjects
      .map((dp) => mapProjectToDeal(dp, clientNameById[dp.socid] || ""))
      .filter((d): d is NonNullable<typeof d> => d !== null);

    // Prioritize manual events
    const manualEvents = filteredEvents.filter(
      (e) => e.type_code !== "AC_OTH_AUTO"
    );
    const autoEvents = filteredEvents.filter(
      (e) => e.type_code === "AC_OTH_AUTO"
    );
    const sortedEvents = [...manualEvents, ...autoEvents];

    const activities = sortedEvents
      .slice(0, 15)
      .map((e) => mapEventToActivity(e, clientNameById));

    const metrics = computeMetrics(clients, projects, deals, filteredInvoices);

    return Response.json({
      metrics,
      clients,
      projects,
      deals,
      activities,
    });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Erreur Dolibarr" },
      { status: 502 }
    );
  }
}
