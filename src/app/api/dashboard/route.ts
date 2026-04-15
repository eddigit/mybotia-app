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
      getEvents(200),
    ]);

    const clients = thirdparties.map(mapThirdPartyToClient);

    // Build client name lookup
    const clientNameById: Record<string, string> = {};
    for (const tp of thirdparties) {
      clientNameById[tp.id] = tp.name_alias || tp.name;
    }

    const projects = doliProjects.map((dp, i) =>
      mapDolibarrProject(dp, i, clientNameById[dp.socid])
    );

    const deals = doliProjects
      .map((dp) => mapProjectToDeal(dp, clientNameById[dp.socid] || ""))
      .filter((d): d is NonNullable<typeof d> => d !== null);

    // Prioritize manual events (AC_OTH, AC_EMAIL, AC_TEL, AC_RDV) over auto
    const manualEvents = events.filter((e) => e.type_code !== "AC_OTH_AUTO");
    const autoEvents = events.filter((e) => e.type_code === "AC_OTH_AUTO");
    const sortedEvents = [...manualEvents, ...autoEvents];

    const activities = sortedEvents
      .slice(0, 15)
      .map((e) => mapEventToActivity(e, clientNameById));

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
