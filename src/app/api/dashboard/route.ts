import { getThirdParties, getProjects, getInvoices, getEvents } from "@/lib/dolibarr";
import {
  mapThirdPartyToClient,
  mapDolibarrProject,
  mapProjectToDeal,
  mapEventToActivity,
  computeMetrics,
} from "@/lib/mappers";

export async function GET() {
  try {
    const [thirdparties, doliProjects, invoices, events] = await Promise.all([
      getThirdParties(),
      getProjects(),
      getInvoices(),
      getEvents(20),
    ]);

    const clients = thirdparties.map(mapThirdPartyToClient);
    const projects = doliProjects.map((dp, i) => mapDolibarrProject(dp, i));

    // Build client name lookup for deals
    const clientNameById: Record<string, string> = {};
    for (const tp of thirdparties) {
      clientNameById[tp.id] = tp.name;
    }

    const deals = doliProjects
      .map((dp) => mapProjectToDeal(dp, clientNameById[dp.socid] || ""))
      .filter((d): d is NonNullable<typeof d> => d !== null);

    // Include all events (AC_OTH_AUTO are the majority in Dolibarr)
    const activities = events
      .slice(0, 10)
      .map(mapEventToActivity);

    const metrics = computeMetrics(clients, projects, deals, invoices);

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
